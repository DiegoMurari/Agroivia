import { and, eq, inArray, ne } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { AcondicionamentoNf } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";
import { decOuNulo, paraTexto, somar, type Valor } from "@/lib/money";
import { origemPadrao } from "@/lib/origem";

import { APROVACAO_OCUPA, carregarContexto, registrarEvento, type DbOuTx } from "./comum";
import { somenteDigitos } from "./compra";
import { dimensionarCarga, lerNorma } from "./dimensionar";
import { acondicionamentoDeOcupacao } from "./estado";
import { ErroNfe, lerNfeXml, type NfeLida } from "./nf-xml";
import { chaveDoPdf, nfCompletaPelaChave, nfSoComChave } from "./nf-pdf";
import { verificarOcupacao } from "./ocupacao";

export interface ArquivoEnviado {
  nome: string;
  conteudo: Buffer;
  /** Escolha do fornecedor para esta NF. */
  acondicionamento: AcondicionamentoNf;
  /** PDF (DANFE): dados mínimos digitados no lugar do XML (D38). */
  manual?: DadosManuaisPdf;
}

export interface DadosManuaisPdf {
  chaveAcesso: string;
  numero?: string | null;
  emitenteCnpj?: string | null;
  valorTotal?: string | null;
  pesoLiquidoKg?: string | null;
}

/** Monta a NF a partir do PDF e dos dados digitados. A chave de 44 dígitos é obrigatória. */
export function nfDoPdf(nome: string, conteudo: Buffer, m: DadosManuaisPdf): NfeLida {
  if (conteudo.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ErroDeRegra(`${nome} não é um PDF. Anexe o DANFE em PDF ou o XML da NF-e.`, { status: 422 });
  }
  const chave = m.chaveAcesso.replace(/\D/g, "");
  if (!/^\d{44}$/.test(chave)) {
    throw new ErroDeRegra("A chave de acesso do DANFE precisa ter 44 dígitos. Confira o número impresso abaixo do código de barras.", {
      status: 422,
      campos: { chaveAcesso: "44 dígitos." },
    });
  }
  const dec = (v: string | null | undefined) => {
    const t = v?.trim().replace(",", ".");
    if (!t) return null;
    const d = decOuNulo(t);
    if (d === null || d.isNegative()) throw new ErroDeRegra("Valor ou peso inválido. Digite um número positivo.", { status: 422 });
    return paraTexto(d);
  };
  const completa = nfCompletaPelaChave(chave);
  if (completa) return { ...completa, pesoLiquidoKg: completa.pesoLiquidoKg ?? dec(m.pesoLiquidoKg) };
  return {
    chaveAcesso: chave,
    numero: m.numero?.trim() || null,
    serie: null,
    emitenteCnpj: somenteDigitos(m.emitenteCnpj),
    emitenteNome: null,
    emitidaEm: null,
    valorTotal: dec(m.valorTotal),
    volumes: null,
    especie: null,
    pesoLiquidoKg: dec(m.pesoLiquidoKg),
    pesoBrutoKg: null,
    placa: null,
    transportadora: null,
    pedidoFornecedor: null,
    itens: [],
    acondicionamentoSugerido: null,
  };
}

export interface AgendarEntrada {
  token: string;
  arquivos: ArquivoEnviado[];
  data: string;
  horario: string;
  autor: string;
}

export interface NfPrevia {
  nome: string;
  nf: NfeLida;
  /** PDF do DANFE: a chave sai do arquivo; os demais dados só vêm se a nota for achada pela chave. */
  formato: "xml" | "pdf";
  /** Nota completa lida (XML, ou PDF cuja chave achou o XML). Falso: só a chave (ou nem ela, chave vazia). */
  completa: boolean;
  /** Preenchido se a chave já está em um agendamento ativo. */
  jaAgendadaEm: number | null;
}

export const TAMANHO_MAXIMO_ARQUIVO = 2 * 1024 * 1024;

const ehPdf = (conteudo: Buffer) => conteudo.subarray(0, 5).toString("latin1") === "%PDF-";

/** Lê o XML ou o PDF do DANFE e conta quais chaves já estão em agendamento ativo. Não grava nada. */
export function lerNfs(db: Db, arquivos: { nome: string; conteudo: Buffer }[]): NfPrevia[] {
  const lidas = arquivos.map((a): Omit<NfPrevia, "jaAgendadaEm"> => {
    if (ehPdf(a.conteudo)) {
      const chave = chaveDoPdf(a.nome, a.conteudo);
      if (!chave) return { nome: a.nome, nf: { ...nfSoComChave("0".repeat(44)), chaveAcesso: "", numero: null, serie: null, emitenteCnpj: null }, formato: "pdf", completa: false };
      const completa = nfCompletaPelaChave(chave);
      return { nome: a.nome, nf: completa ?? nfSoComChave(chave), formato: "pdf", completa: completa !== null };
    }
    try {
      return { nome: a.nome, nf: lerNfeXml(a.conteudo.toString("utf8")), formato: "xml", completa: true };
    } catch (e) {
      if (e instanceof ErroNfe) throw new ErroDeRegra(`${a.nome}: ${e.message}`, { status: 422 });
      throw e;
    }
  });
  const chaves = lidas.map((l) => l.nf.chaveAcesso).filter((c) => c !== "");
  const repetida = chaves.find((c, i) => chaves.indexOf(c) !== i);
  if (repetida) {
    throw new ErroDeRegra(`A nota ${repetida} foi anexada mais de uma vez. Anexe cada NF uma única vez.`, { status: 422 });
  }
  return lidas.map((l) => ({ ...l, jaAgendadaEm: l.nf.chaveAcesso === "" ? null : agendamentoAtivoDaChave(db, l.nf.chaveAcesso) }));
}

/** Id do agendamento não cancelado que já traz a NF, ou nulo. */
export function agendamentoAtivoDaChave(db: DbOuTx, chave: string, ignorarId?: number): number | null {
  const nf = db.select({ id: schema.notaFiscal.id }).from(schema.notaFiscal).where(eq(schema.notaFiscal.chaveAcesso, chave)).get();
  if (!nf) return null;
  const ativo = db
    .select({ id: schema.agendamento.id })
    .from(schema.agendamentoNf)
    .innerJoin(schema.agendamento, eq(schema.agendamento.id, schema.agendamentoNf.agendamentoId))
    .where(and(eq(schema.agendamentoNf.notaFiscalId, nf.id), ne(schema.agendamento.status, "cancelado"), inArray(schema.agendamento.aprovacao, APROVACAO_OCUPA), ignorarId === undefined ? undefined : ne(schema.agendamento.id, ignorarId)))
    .get();
  return ativo?.id ?? null;
}

/** Peso declarado = soma do peso líquido das NF (bruto, se faltar o líquido). */
export function pesoDeclarado(nfs: readonly NfeLida[]): string | null {
  const pesos = nfs
    .map((nf) => decOuNulo(nf.pesoLiquidoKg) ?? decOuNulo(nf.pesoBrutoKg))
    .filter((p): p is Valor => p !== null);
  return pesos.length === 0 ? null : paraTexto(somar(...pesos));
}

function fornecedorDoCnpj(db: DbOuTx, cnpj: string | null): number | null {
  const d = somenteDigitos(cnpj);
  if (!d) return null;
  return db.select({ id: schema.fornecedor.id }).from(schema.fornecedor).where(eq(schema.fornecedor.cnpj, d)).get()?.id ?? null;
}

/** Grava NF, itens, vínculo com o agendamento e arquivo de cada nota lida. Reaproveita a NF só vista em agendamento cancelado ou recusado (a chave é única). */
export function gravarNfs(tx: DbOuTx, agendamentoId: number, lidas: readonly NfLida[], agoraISO: string): void {
  for (const l of lidas) {
    const existente = tx
      .select({ id: schema.notaFiscal.id })
      .from(schema.notaFiscal)
      .where(eq(schema.notaFiscal.chaveAcesso, l.nf.chaveAcesso))
      .get();
    let nfId: number;
    if (existente) {
      // só estava em agendamento cancelado: reaproveita a linha (a chave é única)
      nfId = existente.id;
    } else {
      nfId = tx
        .insert(schema.notaFiscal)
        .values({
          chaveAcesso: l.nf.chaveAcesso,
          numero: l.nf.numero,
          serie: l.nf.serie,
          emitenteCnpj: somenteDigitos(l.nf.emitenteCnpj),
          emitenteNome: l.nf.emitenteNome,
          fornecedorId: fornecedorDoCnpj(tx, l.nf.emitenteCnpj),
          emitidaEm: l.nf.emitidaEm,
          valorTotal: l.nf.valorTotal,
          pesoBrutoKg: l.nf.pesoBrutoKg,
          pesoLiquidoKg: l.nf.pesoLiquidoKg,
          volumes: l.nf.volumes,
          especie: l.nf.especie,
          placa: l.nf.placa,
          transportadora: l.nf.transportadora,
          pedidoFornecedor: l.nf.pedidoFornecedor,
          formaEntrada: l.arquivo.manual ? "manual" : "xml",
          origem: origemPadrao(),
          criadaEm: agoraISO,
        })
        .returning({ id: schema.notaFiscal.id })
        .get().id;
      for (const item of l.nf.itens) {
        tx.insert(schema.notaFiscalItem)
          .values({
            notaFiscalId: nfId,
            codigoFornecedor: item.codigo,
            descricao: item.descricao,
            quantidade: item.quantidade,
            unidade: item.unidade,
            valorUnitario: item.valorUnitario,
          })
          .run();
      }
    }
    tx.insert(schema.agendamentoNf).values({ agendamentoId, notaFiscalId: nfId, acondicionamento: l.arquivo.acondicionamento }).run();
    tx.insert(schema.notaFiscalArquivo)
      .values({
        notaFiscalId: nfId,
        nome: l.arquivo.nome,
        tipoMime: l.arquivo.manual ? "application/pdf" : "application/xml",
        tamanhoBytes: l.arquivo.conteudo.length,
        conteudo: l.arquivo.conteudo,
        criadoEm: agoraISO,
      })
      .run();
  }
}

export type NfLida = { arquivo: ArquivoEnviado; nf: NfeLida };

/** Lê e confere os arquivos de um pedido: XML da NF-e ou PDF com a chave, sem nota repetida. */
export function lerArquivosDoPedido(arquivos: readonly ArquivoEnviado[]): NfLida[] {
  const lidas = arquivos.map((a) => {
    if (a.manual) return { arquivo: a, nf: nfDoPdf(a.nome, a.conteudo, a.manual) };
    try {
      return { arquivo: a, nf: lerNfeXml(a.conteudo.toString("utf8")) };
    } catch (e) {
      if (e instanceof ErroNfe) throw new ErroDeRegra(`${a.nome}: ${e.message}`, { status: 422 });
      throw e;
    }
  });
  const chaves = lidas.map((l) => l.nf.chaveAcesso);
  const repetida = chaves.find((c, i) => chaves.indexOf(c) !== i);
  if (repetida) {
    throw new ErroDeRegra(`A nota ${repetida} foi anexada mais de uma vez. Anexe cada NF uma única vez.`, { status: 422 });
  }
  return lidas;
}

/** Tamanho máximo do corpo de um envio (todos os arquivos juntos). */
export const TAMANHO_MAXIMO_CORPO = 25 * 1024 * 1024;

/** Recusa com 413 antes de ler o corpo se o content-length declarado passar do limite. */
export function conferirTamanhoDoCorpo(contentLength: string | null): void {
  const n = Number(contentLength);
  if (contentLength !== null && Number.isFinite(n) && n > TAMANHO_MAXIMO_CORPO) {
    throw new ErroDeRegra("O envio passa de 25 MB. Anexe só o XML original de cada NF-e.", { status: 413 });
  }
}

/** O link existe e ainda aceita agendamento. Confere antes de ler e interpretar os arquivos. */
export function conferirLinkAtivo(db: DbOuTx, token: string): void {
  const compra = db.select({ status: schema.compra.status }).from(schema.compra).where(eq(schema.compra.token, token)).get();
  if (!compra) throw new ErroDeRegra("Link inválido. Peça um novo link a Compras.", { status: 404 });
  if (compra.status !== "criada") {
    throw new ErroDeRegra("Este link já foi usado. Para uma nova data, peça um novo link a Compras.", { status: 409 });
  }
}

/**
 * O fornecedor confirma o agendamento pelo link (RF1-17, 01, 02, 03, 04).
 * Numa transação: confere o token, as NF e a ocupação, e grava agendamento, NF, itens, arquivos,
 * evento e compra confirmada. Qualquer recusa não grava nada (D43).
 */
export function agendarPorToken(db: Db, entrada: AgendarEntrada, agoraISO: string): { agendamentoId: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.data) || !/^\d{2}:\d{2}$/.test(entrada.horario)) {
    throw new ErroDeRegra("Escolha uma data e um horário da lista.", { status: 400 });
  }
  if (entrada.arquivos.length === 0) {
    throw new ErroDeRegra("Anexe o XML de pelo menos uma nota fiscal.", { status: 400 });
  }
  for (const a of entrada.arquivos) {
    if (a.conteudo.length > TAMANHO_MAXIMO_ARQUIVO) {
      throw new ErroDeRegra(`${a.nome} passa de 2 MB. Anexe o XML original da NF-e.`, { status: 413 });
    }
  }

  conferirLinkAtivo(db, entrada.token);
  const lidas = lerArquivosDoPedido(entrada.arquivos);
  const chaves = lidas.map((l) => l.nf.chaveAcesso);

  return db.transaction(
    (tx) => {
      const compra = tx.select().from(schema.compra).where(eq(schema.compra.token, entrada.token)).get();
      if (!compra) throw new ErroDeRegra("Link inválido. Peça um novo link a Compras.", { status: 404 });
      if (compra.status !== "criada") {
        throw new ErroDeRegra("Este link já foi usado. Para uma nova data, peça um novo link a Compras.", { status: 409 });
      }

      for (const l of lidas) {
        const em = agendamentoAtivoDaChave(tx, l.nf.chaveAcesso);
        if (em !== null) {
          throw new ErroDeRegra(
            `A NF ${l.nf.numero ?? l.nf.chaveAcesso} já está no agendamento ${em}. Cada nota só pode estar em um agendamento ativo.`,
            { status: 409 },
          );
        }
      }

      const acondicionamento = acondicionamentoDeOcupacao(lidas.map((l) => l.arquivo.acondicionamento));
      const ocupacao = verificarOcupacao(carregarContexto(tx, agoraISO), {
        data: entrada.data,
        horario: entrada.horario,
        acondicionamento,
      });
      if (!ocupacao.aceita) {
        throw new ErroDeRegra(ocupacao.mensagem, { status: 409, detalhe: { motivo: ocupacao.motivo, proxima: ocupacao.proxima } });
      }

      const nfs = lidas.map((l) => l.nf);
      // fotografia da norma no momento do agendamento (grupo 2)
      let previsto: ReturnType<typeof dimensionarCarga> | null = null;
      try {
        const { norma, perfil } = lerNorma(tx);
        previsto = dimensionarCarga(
          lidas.map((l) => ({ acondicionamento: l.arquivo.acondicionamento, pesoKg: l.nf.pesoLiquidoKg ?? l.nf.pesoBrutoKg })),
          norma,
          perfil,
        );
      } catch {
        previsto = null; // norma ausente: o agendamento segue sem previsão
      }
      const agendamentoId = tx
        .insert(schema.agendamento)
        .values({
          compraId: compra.id,
          fornecedorId: compra.fornecedorId,
          data: entrada.data,
          horario: entrada.horario,
          placa: nfs.map((n) => n.placa).find((p) => p) ?? null,
          transportadora: nfs.map((n) => n.transportadora).find((t) => t) ?? null,
          acondicionamentoOcupacao: acondicionamento,
          pesoDeclaradoKg: pesoDeclarado(nfs),
          chapasPrevistas: previsto?.chapas ?? null,
          empilhadeiraPrevista: previsto?.empilhadeira ?? null,
          duracaoPrevistaMin: previsto && previsto.duracaoMin > 0 ? previsto.duracaoMin : null,
          status: "agendado",
          origem: origemPadrao(),
          criadoEm: agoraISO,
        })
        .returning({ id: schema.agendamento.id })
        .get().id;

      gravarNfs(tx, agendamentoId, lidas, agoraISO);

      registrarEvento(tx, agendamentoId, "agendado", entrada.autor, agoraISO, {
        de: null,
        para: { data: entrada.data, horario: entrada.horario, acondicionamento },
        nfs: chaves,
      });
      tx.update(schema.compra).set({ status: "confirmada", preenchidaEm: agoraISO }).where(eq(schema.compra.id, compra.id)).run();
      return { agendamentoId };
    },
    { behavior: "immediate" },
  );
}

// ───────────────────────── leitura para a tela do link ─────────────────────────

export interface ArquivoListado {
  id: number;
  notaFiscalId: number;
  nome: string | null;
  tipoMime: string | null;
  tamanhoBytes: number | null;
}

/** Lista anexos sem a coluna `conteudo` (BLOB). */
export function listarArquivos(db: DbOuTx, notaFiscalIds: number[]): ArquivoListado[] {
  if (notaFiscalIds.length === 0) return [];
  return db
    .select({
      id: schema.notaFiscalArquivo.id,
      notaFiscalId: schema.notaFiscalArquivo.notaFiscalId,
      nome: schema.notaFiscalArquivo.nome,
      tipoMime: schema.notaFiscalArquivo.tipoMime,
      tamanhoBytes: schema.notaFiscalArquivo.tamanhoBytes,
    })
    .from(schema.notaFiscalArquivo)
    .where(inArray(schema.notaFiscalArquivo.notaFiscalId, notaFiscalIds))
    .all();
}

/** Só no download o BLOB é lido. Tipo fixo por tipo de arquivo (D38). */
export function lerArquivoParaDownload(db: Db, id: number): { nome: string; tipoMime: string; conteudo: Buffer } | null {
  const a = db.select().from(schema.notaFiscalArquivo).where(eq(schema.notaFiscalArquivo.id, id)).get();
  if (!a || !a.conteudo) return null;
  const pdf = (a.tipoMime ?? "").includes("pdf");
  return { nome: a.nome ?? `anexo-${a.id}`, tipoMime: pdf ? "application/pdf" : "application/xml", conteudo: a.conteudo };
}

export interface VisaoDoLink {
  compra: { id: number; status: string; numeroPedido: string | null; fornecedor: string };
  agendamento: {
    id: number;
    data: string;
    horario: string;
    status: string;
    placa: string | null;
    motivoCancelamento: string | null;
    nfs: { id: number; numero: string | null; chaveAcesso: string; acondicionamento: string; especie: string | null; pesoLiquidoKg: string | null; emitenteNome: string | null; volumes: string | null; itens: { descricao: string | null }[] }[];
    arquivos: ArquivoListado[];
  } | null;
}

export function obterVisaoDoLink(db: Db, token: string): VisaoDoLink | null {
  const compra = db
    .select({
      id: schema.compra.id,
      status: schema.compra.status,
      numeroPedido: schema.compra.numeroPedido,
      fornecedor: schema.fornecedor.razaoSocial,
    })
    .from(schema.compra)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.compra.fornecedorId))
    .where(eq(schema.compra.token, token))
    .get();
  if (!compra) return null;

  const ag = db.select().from(schema.agendamento).where(eq(schema.agendamento.compraId, compra.id)).get();
  if (!ag) return { compra, agendamento: null };

  const nfs = db
    .select({
      id: schema.notaFiscal.id,
      numero: schema.notaFiscal.numero,
      chaveAcesso: schema.notaFiscal.chaveAcesso,
      acondicionamento: schema.agendamentoNf.acondicionamento,
      especie: schema.notaFiscal.especie,
      pesoLiquidoKg: schema.notaFiscal.pesoLiquidoKg,
      emitenteNome: schema.notaFiscal.emitenteNome,
      volumes: schema.notaFiscal.volumes,
    })
    .from(schema.agendamentoNf)
    .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
    .where(eq(schema.agendamentoNf.agendamentoId, ag.id))
    .all()
    .map((n) => ({
      ...n,
      itens: db.select({ descricao: schema.notaFiscalItem.descricao }).from(schema.notaFiscalItem).where(eq(schema.notaFiscalItem.notaFiscalId, n.id)).all(),
    }));
  return {
    compra,
    agendamento: {
      id: ag.id,
      data: ag.data,
      horario: ag.horario,
      status: ag.status,
      placa: ag.placa,
      motivoCancelamento: ag.motivoCancelamento,
      nfs,
      arquivos: listarArquivos(db, nfs.map((n) => n.id)),
    },
  };
}
