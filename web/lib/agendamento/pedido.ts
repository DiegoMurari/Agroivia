import { and, desc, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";

import { agendamentoAtivoDaChave, gravarNfs, lerArquivosDoPedido, pesoDeclarado, type ArquivoEnviado } from "./agendar";
import { carregarContexto, registrarEvento, type DbOuTx } from "./comum";
import { dataBR } from "./datas";
import { somenteDigitos } from "./compra";
import { dimensionarCarga, lerNorma } from "./dimensionar";
import { acondicionamentoDeOcupacao } from "./estado";
import { numeroDoAgendamento } from "./numero";
import { verificarOcupacao } from "./ocupacao";

/** Pedidos do portal do fornecedor e a aprovação de Compras (D49). */

const REABRIVEIS = ["rascunho", "aguardando", "recusado"];

export interface DadosPedido {
  data: string;
  horario: string;
  /** Código do grupo de produto (ex.: `FER`) ou `OUTROS`. */
  tipoMercadoria?: string | null;
  /** Descrição, obrigatória quando o tipo é `OUTROS`. */
  tipoOutros?: string | null;
  observacao?: string | null;
  /** Vazio só na edição: mantém as notas atuais. */
  arquivos: ArquivoEnviado[];
  /** `true` envia para aprovação (ocupa a vaga); `false` salva rascunho. */
  enviar: boolean;
}

export interface FornecedorDoUsuario {
  fornecedorId: number;
  razaoSocial: string;
  tiposMercadoria: string[];
}

/** Linha de `fornecedor` do usuário (casa pelo CNPJ do cadastro; cria se ainda não existe). */
export function fornecedorDoUsuario(db: DbOuTx, usuarioId: number): FornecedorDoUsuario {
  const cad = db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.usuarioId, usuarioId)).get();
  if (!cad || cad.status !== "aprovado") throw new ErroDeRegra("Seu cadastro ainda não foi aprovado por Compras.", { status: 403 });
  const cnpj = somenteDigitos(cad.cnpj);
  let fornecedorId = cad.fornecedorId ?? (cnpj ? db.select({ id: schema.fornecedor.id }).from(schema.fornecedor).where(eq(schema.fornecedor.cnpj, cnpj)).get()?.id : undefined);
  if (fornecedorId === undefined) {
    fornecedorId = db
      .insert(schema.fornecedor)
      .values({ codigo: null, razaoSocial: cad.razaoSocial, cnpj, origem: origemPadrao() })
      .returning({ id: schema.fornecedor.id })
      .get().id;
  }
  let tipos: string[] = [];
  try {
    const bruto: unknown = JSON.parse(cad.tiposMercadoria ?? "[]");
    if (Array.isArray(bruto)) tipos = bruto.filter((t): t is string => typeof t === "string");
  } catch {
    tipos = [];
  }
  return { fornecedorId, razaoSocial: cad.razaoSocial, tiposMercadoria: tipos };
}

export const TIPO_OUTROS = "OUTROS";

export interface TipoMercadoria {
  valor: string;
  rotulo: string;
}

const ROTULO_GRUPO: Record<string, string> = { IRG: "Irrigação" };

/** Todas as mercadorias (grupos de produto, com a descrição legível) e, no fim, "Outros". */
export function listarTiposMercadoria(db: DbOuTx): TipoMercadoria[] {
  const grupos = db.select().from(schema.grupoProduto).all();
  const lista = grupos
    .map((g) => ({ valor: g.grupo, rotulo: ROTULO_GRUPO[g.grupo] ?? g.descricao ?? g.grupo }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return [...lista, { valor: TIPO_OUTROS, rotulo: "Outros" }];
}

/** Texto gravado do tipo escolhido. */
function rotuloDoTipo(db: DbOuTx, dados: DadosPedido): string | null {
  if (!dados.tipoMercadoria) return null;
  const tipo = listarTiposMercadoria(db).find((t) => t.valor === dados.tipoMercadoria);
  if (!tipo) throw new ErroDeRegra("Escolha um tipo de mercadoria da lista.", { status: 400, campos: { tipoMercadoria: "Escolha um tipo da lista." } });
  if (tipo.valor === TIPO_OUTROS) {
    const d = dados.tipoOutros?.trim();
    if (!d) throw new ErroDeRegra("Descreva a mercadoria em \"Outros\".", { status: 400, campos: { tipoOutros: "Descreva a mercadoria." } });
    return `Outros: ${d.slice(0, 80)}`;
  }
  return tipo.rotulo;
}

function conferirDados(dados: DadosPedido, exigirNf: boolean): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data) || !/^\d{2}:\d{2}$/.test(dados.horario)) {
    throw new ErroDeRegra("Escolha um dia no calendário e um horário da lista.", { status: 400 });
  }
  if (exigirNf && dados.arquivos.length === 0) {
    throw new ErroDeRegra("Todo pedido precisa da nota fiscal. Anexe o XML ou o PDF da nota.", { status: 400, campos: { arquivos: "Anexe a nota fiscal." } });
  }
  if (dados.enviar && !dados.tipoMercadoria) {
    throw new ErroDeRegra("Escolha o tipo de mercadoria.", { status: 400, campos: { tipoMercadoria: "Escolha um tipo." } });
  }
}

function previsao(tx: DbOuTx, lidas: ReturnType<typeof lerArquivosDoPedido>) {
  try {
    const { norma, perfil } = lerNorma(tx);
    const p = dimensionarCarga(
      lidas.map((l) => ({ acondicionamento: l.arquivo.acondicionamento, pesoKg: l.nf.pesoLiquidoKg ?? l.nf.pesoBrutoKg })),
      norma,
      perfil,
    );
    return { chapasPrevistas: p.chapas, empilhadeiraPrevista: p.empilhadeira, duracaoPrevistaMin: p.duracaoMin > 0 ? p.duracaoMin : null };
  } catch {
    return { chapasPrevistas: null, empilhadeiraPrevista: null, duracaoPrevistaMin: null };
  }
}

function extraDe(db: DbOuTx, dados: DadosPedido): string {
  return JSON.stringify({ tipoMercadoria: rotuloDoTipo(db, dados), tipoValor: dados.tipoMercadoria ?? null, tipoOutros: dados.tipoMercadoria === TIPO_OUTROS ? dados.tipoOutros?.trim() ?? null : null });
}

/** Cria o pedido do fornecedor: `aguardando` (ocupa a vaga) ou `rascunho` (não ocupa). Tudo numa transação (D43). */
export function criarPedido(db: Db, usuarioId: number, dados: DadosPedido, agoraISO: string): { agendamentoId: number } {
  const forn = fornecedorDoUsuario(db, usuarioId);
  conferirDados(dados, true);
  const lidas = lerArquivosDoPedido(dados.arquivos);
  return db.transaction(
    (tx) => {
      for (const l of lidas) {
        const em = agendamentoAtivoDaChave(tx, l.nf.chaveAcesso);
        if (em !== null) {
          throw new ErroDeRegra(`A NF ${l.nf.numero ?? l.nf.chaveAcesso} já está no pedido ${em}. Cada nota só pode estar em um pedido.`, { status: 409 });
        }
      }
      const acondicionamento = acondicionamentoDeOcupacao(lidas.map((l) => l.arquivo.acondicionamento));
      if (dados.enviar) {
        const r = verificarOcupacao(carregarContexto(tx, agoraISO), { data: dados.data, horario: dados.horario, acondicionamento });
        if (!r.aceita) throw new ErroDeRegra(r.mensagem, { status: 409, detalhe: { motivo: r.motivo, proxima: r.proxima } });
      }
      const nfs = lidas.map((l) => l.nf);
      const agendamentoId = tx
        .insert(schema.agendamento)
        .values({
          compraId: null,
          fornecedorId: forn.fornecedorId,
          data: dados.data,
          horario: dados.horario,
          placa: nfs.map((n) => n.placa).find((p) => p) ?? null,
          transportadora: nfs.map((n) => n.transportadora).find((t) => t) ?? null,
          acondicionamentoOcupacao: acondicionamento,
          pesoDeclaradoKg: pesoDeclarado(nfs),
          ...previsao(tx, lidas),
          status: "agendado",
          aprovacao: dados.enviar ? "aguardando" : "rascunho",
          criadoPorUsuarioId: usuarioId,
          observacao: dados.observacao?.trim() || null,
          extra: extraDe(tx, dados),
          origem: origemPadrao(),
          criadoEm: agoraISO,
        })
        .returning({ id: schema.agendamento.id })
        .get().id;
      gravarNfs(tx, agendamentoId, lidas, agoraISO);
      registrarEvento(tx, agendamentoId, "agendado", "fornecedor", agoraISO, {
        de: null,
        para: { data: dados.data, horario: dados.horario, acondicionamento },
        aprovacao: dados.enviar ? "aguardando" : "rascunho",
        nfs: lidas.map((l) => l.nf.chaveAcesso),
        origem: origemPadrao(),
      });
      return { agendamentoId };
    },
    { behavior: "immediate" },
  );
}

/** Edita pedido em aberto (rascunho, aguardando ou recusado). Enviar devolve para `aguardando` e confere a ocupação de novo. */
export function editarPedido(db: Db, usuarioId: number, id: number, dados: DadosPedido, agoraISO: string): void {
  fornecedorDoUsuario(db, usuarioId);
  conferirDados(dados, false);
  const lidas = dados.arquivos.length > 0 ? lerArquivosDoPedido(dados.arquivos) : null;
  db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
      if (!ag || ag.criadoPorUsuarioId !== usuarioId) throw new ErroDeRegra("Pedido não encontrado.", { status: 404 });
      if (!REABRIVEIS.includes(ag.aprovacao) || ag.status !== "agendado") {
        throw new ErroDeRegra("Este pedido já foi aprovado e não pode mais ser editado. Fale com Compras.", { status: 409 });
      }
      if (lidas) {
        for (const l of lidas) {
          const em = agendamentoAtivoDaChave(tx, l.nf.chaveAcesso, id);
          if (em !== null) {
            throw new ErroDeRegra(`A NF ${l.nf.numero ?? l.nf.chaveAcesso} já está no pedido ${em}. Cada nota só pode estar em um pedido.`, { status: 409 });
          }
        }
      }
      if (!lidas && dados.enviar) {
        // notas já gravadas neste pedido: outra pedido pode ter pego a mesma NF enquanto este estava em rascunho ou recusado
        const atuais = tx
          .select({ chave: schema.notaFiscal.chaveAcesso })
          .from(schema.agendamentoNf)
          .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
          .where(eq(schema.agendamentoNf.agendamentoId, id))
          .all();
        for (const n of atuais) {
          const em = agendamentoAtivoDaChave(tx, n.chave, id);
          if (em !== null) throw new ErroDeRegra(`A NF ${n.chave} já está no pedido ${em}. Anexe outra nota para enviar este pedido.`, { status: 409 });
        }
      }
      const acondicionamento = lidas ? acondicionamentoDeOcupacao(lidas.map((l) => l.arquivo.acondicionamento)) : ag.acondicionamentoOcupacao;
      if (dados.enviar) {
        const r = verificarOcupacao(carregarContexto(tx, agoraISO), {
          data: dados.data,
          horario: dados.horario,
          acondicionamento,
          ignorarAgendamentoId: id,
        });
        if (!r.aceita) throw new ErroDeRegra(r.mensagem, { status: 409, detalhe: { motivo: r.motivo, proxima: r.proxima } });
      }
      if (lidas) {
        tx.delete(schema.agendamentoNf).where(eq(schema.agendamentoNf.agendamentoId, id)).run();
        gravarNfs(tx, id, lidas, agoraISO);
      }
      tx.update(schema.agendamento)
        .set({
          data: dados.data,
          horario: dados.horario,
          acondicionamentoOcupacao: acondicionamento,
          ...(lidas ? { pesoDeclaradoKg: pesoDeclarado(lidas.map((l) => l.nf)), ...previsao(tx, lidas) } : {}),
          aprovacao: dados.enviar ? "aguardando" : "rascunho",
          recusaComentario: null,
          aprovacaoPor: null,
          aprovacaoEm: null,
          observacao: dados.observacao?.trim() || null,
          extra: extraDe(tx, dados),
          atualizadoEm: agoraISO,
        })
        .where(eq(schema.agendamento.id, id))
        .run();
      registrarEvento(tx, id, "remarcado", "fornecedor", agoraISO, {
        de: { data: ag.data, horario: ag.horario, aprovacao: ag.aprovacao },
        para: { data: dados.data, horario: dados.horario, aprovacao: dados.enviar ? "aguardando" : "rascunho" },
        pedido: "editado",
        origem: origemPadrao(),
      });
    },
    { behavior: "immediate" },
  );
}

/** O estado do pedido em palavras, como o fornecedor lê. */
export function estadoDoPedido(a: { aprovacao: string; status: string }): string {
  if (a.status === "cancelado") return "Cancelado";
  if (a.status === "concluido") return "Concluído";
  if (a.status === "nao_recebido") return "Não recebido";
  if (a.status === "chegou") return "Chegou";
  if (a.status === "em_descarga") return "Em descarga";
  if (a.aprovacao === "rascunho") return "Rascunho";
  if (a.aprovacao === "aguardando") return "Aguardando aprovação";
  if (a.aprovacao === "recusado") return "Recusado";
  return "Aprovado";
}

export function pedidoAberto(a: { aprovacao: string; status: string }): boolean {
  return REABRIVEIS.includes(a.aprovacao) && a.status === "agendado";
}

function lerExtra(extra: string | null): { tipoMercadoria: string | null; tipoValor: string | null; tipoOutros: string | null } {
  try {
    const e = JSON.parse(extra ?? "{}") as { tipoMercadoria?: string | null; tipoValor?: string | null; tipoOutros?: string | null };
    return { tipoMercadoria: e.tipoMercadoria ?? null, tipoValor: e.tipoValor ?? null, tipoOutros: e.tipoOutros ?? null };
  } catch {
    return { tipoMercadoria: null, tipoValor: null, tipoOutros: null };
  }
}

export interface PedidoDoFornecedor {
  id: number;
  /** Número gerado pelo sistema, ex.: AG-2026-000123. */
  numero: string;
  data: string;
  horario: string;
  estado: string;
  aprovacao: string;
  emAberto: boolean;
  recusaComentario: string | null;
  tipoMercadoria: string | null;
  tipoValor: string | null;
  tipoOutros: string | null;
  observacao: string | null;
  notas: string[];
}

/** Pedidos criados por este usuário no portal, do mais novo ao mais antigo. */
export function listarPedidosDoFornecedor(db: DbOuTx, usuarioId: number): PedidoDoFornecedor[] {
  const linhas = db.select().from(schema.agendamento).where(eq(schema.agendamento.criadoPorUsuarioId, usuarioId)).orderBy(desc(schema.agendamento.id)).all();
  return linhas.map((a) => {
    const notas = db
      .select({ numero: schema.notaFiscal.numero, chave: schema.notaFiscal.chaveAcesso })
      .from(schema.agendamentoNf)
      .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
      .where(eq(schema.agendamentoNf.agendamentoId, a.id))
      .all()
      .map((n) => n.numero ?? n.chave);
    return {
      id: a.id,
      numero: numeroDoAgendamento(a.id, a.criadoEm),
      data: a.data,
      horario: a.horario,
      estado: estadoDoPedido(a),
      aprovacao: a.aprovacao,
      emAberto: pedidoAberto(a),
      recusaComentario: a.recusaComentario,
      observacao: a.observacao,
      notas,
      ...lerExtra(a.extra),
    };
  });
}

/** Nota já anexada a um pedido, para mostrar na edição. */
export interface NotaDoPedido {
  chave: string;
  numero: string | null;
  emitenteNome: string | null;
  pesoLiquidoKg: string | null;
  acondicionamento: string;
  itens: string[];
}

export function notasDoPedido(db: DbOuTx, agendamentoId: number): NotaDoPedido[] {
  const linhas = db
    .select({
      id: schema.notaFiscal.id,
      chave: schema.notaFiscal.chaveAcesso,
      numero: schema.notaFiscal.numero,
      emitenteNome: schema.notaFiscal.emitenteNome,
      pesoLiquidoKg: schema.notaFiscal.pesoLiquidoKg,
      acondicionamento: schema.agendamentoNf.acondicionamento,
    })
    .from(schema.agendamentoNf)
    .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
    .where(eq(schema.agendamentoNf.agendamentoId, agendamentoId))
    .all();
  return linhas.map(({ id, ...n }) => ({
    ...n,
    itens: db
      .select({ descricao: schema.notaFiscalItem.descricao })
      .from(schema.notaFiscalItem)
      .where(eq(schema.notaFiscalItem.notaFiscalId, id))
      .all()
      .map((i) => i.descricao ?? "")
      .filter((d) => d !== ""),
  }));
}

export interface PedidoParaAprovar {
  id: number;
  numero: string;
  data: string;
  horario: string;
  tipoMercadoria: string | null;
  observacao: string | null;
  acondicionamento: string;
  pesoKg: string | null;
  criadoEm: string;
  notas: NotaParaAprovar[];
}

/** A NF-e como Compras a vê ao analisar o pedido. */
export interface NotaParaAprovar {
  numero: string | null;
  serie: string | null;
  chave: string;
  emitente: string | null;
  emitenteCnpj: string | null;
  emitidaEm: string | null;
  valorTotal: string | null;
  pesoBrutoKg: string | null;
  transportadora: string | null;
  placa: string | null;
  itens: string[];
  linhas: { descricao: string; quantidade: string | null; unidade: string | null; valorUnitario: string | null }[];
}

export interface GrupoDeAprovacao {
  fornecedorId: number;
  fornecedor: string;
  pedidos: PedidoParaAprovar[];
}

/** Pedidos `aguardando`, agrupados por fornecedor (tela de aprovações de Compras). */
export function listarAprovacoes(db: DbOuTx): GrupoDeAprovacao[] {
  const linhas = db
    .select({ a: schema.agendamento, fornecedor: schema.fornecedor.razaoSocial })
    .from(schema.agendamento)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(and(eq(schema.agendamento.aprovacao, "aguardando"), eq(schema.agendamento.status, "agendado")))
    .all()
    .sort((x, y) => x.a.data.localeCompare(y.a.data) || x.a.horario.localeCompare(y.a.horario) || x.a.id - y.a.id);
  const grupos = new Map<number, GrupoDeAprovacao>();
  for (const { a, fornecedor } of linhas) {
    const nfs = db
      .select({ nf: schema.notaFiscal })
      .from(schema.agendamentoNf)
      .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
      .where(eq(schema.agendamentoNf.agendamentoId, a.id))
      .all();
    const notas: NotaParaAprovar[] = nfs.map(({ nf: n }) => {
      const linhas = db
        .select()
        .from(schema.notaFiscalItem)
        .where(eq(schema.notaFiscalItem.notaFiscalId, n.id))
        .all()
        .map((i) => ({ descricao: i.descricao ?? "item sem descrição", quantidade: i.quantidade, unidade: i.unidade, valorUnitario: i.valorUnitario }));
      return {
        numero: n.numero,
        serie: n.serie,
        chave: n.chaveAcesso,
        emitente: n.emitenteNome,
        emitenteCnpj: n.emitenteCnpj,
        emitidaEm: n.emitidaEm,
        valorTotal: n.valorTotal,
        pesoBrutoKg: n.pesoBrutoKg,
        transportadora: n.transportadora,
        placa: n.placa,
        itens: linhas.map((l) => l.descricao),
        linhas,
      };
    });
    const g = grupos.get(a.fornecedorId) ?? { fornecedorId: a.fornecedorId, fornecedor, pedidos: [] };
    g.pedidos.push({
      id: a.id,
      numero: numeroDoAgendamento(a.id, a.criadoEm),
      data: a.data,
      horario: a.horario,
      acondicionamento: a.acondicionamentoOcupacao,
      pesoKg: a.pesoDeclaradoKg,
      observacao: a.observacao,
      criadoEm: a.criadoEm,
      notas,
      ...lerExtra(a.extra),
    });
    grupos.set(a.fornecedorId, g);
  }
  return [...grupos.values()].sort((x, y) => x.fornecedor.localeCompare(y.fornecedor));
}

/** Compras aprova ou recusa. Numa transação: muda o estado, grava quem decidiu e avisa o fornecedor. Recusar exige comentário. */
export function decidirPedido(
  db: Db,
  decisor: { id: number; nome: string },
  entrada: { id: number; decisao: "aprovado" | "recusado"; comentario?: string | null },
  agoraISO: string,
): void {
  const comentario = entrada.comentario?.trim() || null;
  if (entrada.decisao === "recusado" && !comentario) {
    throw new ErroDeRegra("Para recusar, explique o motivo. O fornecedor lê o comentário para corrigir o pedido.", {
      status: 400,
      campos: { comentario: "Escreva o motivo da recusa." },
    });
  }
  db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, entrada.id)).get();
      if (!ag) throw new ErroDeRegra("Pedido não encontrado.", { status: 404 });
      if (ag.aprovacao !== "aguardando" || ag.status !== "agendado") {
        throw new ErroDeRegra("Este pedido não está aguardando aprovação. Atualize a tela.", { status: 409 });
      }
      tx.update(schema.agendamento)
        .set({
          aprovacao: entrada.decisao,
          recusaComentario: entrada.decisao === "recusado" ? comentario : null,
          aprovacaoPor: decisor.id,
          aprovacaoEm: agoraISO,
          atualizadoEm: agoraISO,
        })
        .where(eq(schema.agendamento.id, entrada.id))
        .run();
      tx.insert(schema.logAprovacao)
        .values({ alvo: "pedido", alvoId: entrada.id, decisao: entrada.decisao, comentario, usuarioId: decisor.id, criadoEm: agoraISO })
        .run();
      if (ag.criadoPorUsuarioId !== null) {
        const quando = `${dataBR(ag.data)} às ${ag.horario}`;
        tx.insert(schema.notificacao)
          .values({
            usuarioId: ag.criadoPorUsuarioId,
            tipo: entrada.decisao === "aprovado" ? "pedido_aprovado" : "pedido_recusado",
            mensagem:
              entrada.decisao === "aprovado"
                ? `Seu pedido para ${quando} foi aprovado.`
                : `Seu pedido para ${quando} foi recusado. Motivo: ${comentario}`,
            link: "/fornecedor/pedidos",
            lida: false,
            criadoEm: agoraISO,
          })
          .run();
      }
    },
    { behavior: "immediate" },
  );
}

export function listarNotificacoes(db: DbOuTx, usuarioId: number, limite = 30) {
  return db
    .select()
    .from(schema.notificacao)
    .where(eq(schema.notificacao.usuarioId, usuarioId))
    .orderBy(desc(schema.notificacao.id))
    .limit(limite)
    .all();
}

/** Marca como lida uma notificação do usuário, ou todas as dele. */
export function marcarNotificacoesLidas(db: DbOuTx, usuarioId: number, ids?: number[]): void {
  const dele = eq(schema.notificacao.usuarioId, usuarioId);
  db.update(schema.notificacao)
    .set({ lida: true })
    .where(ids && ids.length > 0 ? and(dele, inArray(schema.notificacao.id, ids)) : dele)
    .run();
}
