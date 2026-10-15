import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { ValidacaoStatus } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";
import { decOuNulo, maiorQue, paraTexto } from "@/lib/money";

import { listarArquivos, type ArquivoListado } from "./agendar";
import { lerParametro, registrarEvento, type DbOuTx } from "./comum";
import { recusaDeTransicao } from "./estado";
import { validarNfPedido, type ResultadoValidacao } from "./validacao";

/** Registro do dia da descarga: validação, autorização, destino, chegada, entrada e saída por armazém. */

function agendamentoOuErro(db: DbOuTx, id: number) {
  const ag = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
  if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
  return ag;
}

export function exigePesoBalanca(pesoDeclaradoKg: string | null, limiteKg: string): boolean {
  const peso = decOuNulo(pesoDeclaradoKg);
  return peso !== null && maiorQue(peso, limiteKg);
}

// ───────────────────────── leitura ─────────────────────────

export function obterDetalhe(db: Db, id: number) {
  const ag = agendamentoOuErro(db, id);
  const fornecedor = db.select().from(schema.fornecedor).where(eq(schema.fornecedor.id, ag.fornecedorId)).get()!;
  const compra = ag.compraId ? db.select().from(schema.compra).where(eq(schema.compra.id, ag.compraId)).get() ?? null : null;
  const itensCompra = compra
    ? db
        .select({
          id: schema.compraItem.id,
          produtoId: schema.compraItem.produtoId,
          descricao: schema.compraItem.descricao,
          quantidade: schema.compraItem.quantidade,
          unidade: schema.compraItem.unidade,
          pesoKg: schema.compraItem.pesoKg,
        })
        .from(schema.compraItem)
        .where(eq(schema.compraItem.compraId, compra.id))
        .all()
    : [];

  const nfLinhas = db
    .select({
      id: schema.notaFiscal.id,
      numero: schema.notaFiscal.numero,
      chaveAcesso: schema.notaFiscal.chaveAcesso,
      emitenteCnpj: schema.notaFiscal.emitenteCnpj,
      emitenteNome: schema.notaFiscal.emitenteNome,
      pesoLiquidoKg: schema.notaFiscal.pesoLiquidoKg,
      pesoBrutoKg: schema.notaFiscal.pesoBrutoKg,
      especie: schema.notaFiscal.especie,
      volumes: schema.notaFiscal.volumes,
      pedidoFornecedor: schema.notaFiscal.pedidoFornecedor,
      formaEntrada: schema.notaFiscal.formaEntrada,
      acondicionamento: schema.agendamentoNf.acondicionamento,
    })
    .from(schema.agendamentoNf)
    .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
    .where(eq(schema.agendamentoNf.agendamentoId, id))
    .all();
  const nfIds = nfLinhas.map((n) => n.id);
  const itensNf = nfIds.length
    ? db
        .select({
          notaFiscalId: schema.notaFiscalItem.notaFiscalId,
          descricao: schema.notaFiscalItem.descricao,
          quantidade: schema.notaFiscalItem.quantidade,
          unidade: schema.notaFiscalItem.unidade,
        })
        .from(schema.notaFiscalItem)
        .where(inArray(schema.notaFiscalItem.notaFiscalId, nfIds))
        .all()
    : [];
  const nfs = nfLinhas.map((n) => ({ ...n, itens: itensNf.filter((i) => i.notaFiscalId === n.id) }));
  const arquivos: ArquivoListado[] = listarArquivos(db, nfIds);

  const validacao: ResultadoValidacao = validarNfPedido(
    nfs.map((n) => ({ emitenteCnpj: n.emitenteCnpj, pesoLiquidoKg: n.pesoLiquidoKg, pesoBrutoKg: n.pesoBrutoKg, itens: n.itens })),
    { fornecedorCnpj: fornecedor.cnpj, itens: itensCompra },
  );

  const armazens = db
    .select({
      id: schema.agendamentoArmazem.id,
      armazemId: schema.agendamentoArmazem.armazemId,
      nome: schema.armazem.nome,
      ordem: schema.agendamentoArmazem.ordem,
      entradaEm: schema.agendamentoArmazem.entradaEm,
      saidaEm: schema.agendamentoArmazem.saidaEm,
      chapasQtd: schema.agendamentoArmazem.chapasQtd,
      pesoKg: schema.agendamentoArmazem.pesoKg,
    })
    .from(schema.agendamentoArmazem)
    .innerJoin(schema.armazem, eq(schema.armazem.id, schema.agendamentoArmazem.armazemId))
    .where(eq(schema.agendamentoArmazem.agendamentoId, id))
    .orderBy(asc(schema.agendamentoArmazem.ordem))
    .all();
  const equipUsados = armazens.length
    ? db
        .select()
        .from(schema.descargaEquipamento)
        .where(inArray(schema.descargaEquipamento.agendamentoArmazemId, armazens.map((a) => a.id)))
        .all()
    : [];

  const produtoIds = itensCompra.map((i) => i.produtoId).filter((p): p is number => p !== null);
  const sugestaoArmazemIds = produtoIds.length
    ? [
        ...new Set(
          db
            .select({ armazemId: schema.produto.armazemId })
            .from(schema.produto)
            .where(inArray(schema.produto.id, produtoIds))
            .all()
            .map((p) => p.armazemId)
            .filter((a): a is number => a !== null),
        ),
      ]
    : [];

  const pendencias = db.select().from(schema.pendencia).where(eq(schema.pendencia.agendamentoId, id)).orderBy(desc(schema.pendencia.id)).all();
  const eventos = db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, id)).orderBy(asc(schema.evento.id)).all();
  const limitePesoKg = lerParametro(db, "limite_peso_chapa_kg", "500");

  return {
    agendamento: ag,
    fornecedor,
    compra,
    itensCompra,
    nfs,
    arquivos,
    validacao,
    armazens: armazens.map((a) => ({ ...a, equipamentoIds: equipUsados.filter((e) => e.agendamentoArmazemId === a.id).map((e) => e.equipamentoId) })),
    sugestaoArmazemIds,
    pendencias,
    eventos,
    limitePesoKg,
    exigePesoBalanca: exigePesoBalanca(ag.pesoDeclaradoKg, limitePesoKg),
  };
}

export type DetalheDescarga = ReturnType<typeof obterDetalhe>;

export function listarArmazensEEquipamentos(db: Db) {
  const armazens = db
    .select()
    .from(schema.armazem)
    .where(and(eq(schema.armazem.ativo, true), eq(schema.armazem.recebeDescarga, true)))
    .orderBy(asc(schema.armazem.ordem)).all();
  const equipamentos = db
    .select({ id: schema.equipamento.id, armazemId: schema.equipamento.armazemId, nome: schema.equipamento.nome, disponivel: schema.equipamento.disponivel, status: schema.equipamento.status })
    .from(schema.equipamento)
    .all()
    // equipamento em manutenção conta como 0 disponível
    .map(({ status, ...e }) => ({ ...e, disponivel: status === "manutencao" ? 0 : e.disponivel }));
  return { armazens, equipamentos };
}

// ───────────────────────── validação, autorização e destino ─────────────────────────

/** Compras decide: conforme, divergente ou aguardando pedido (RF1-05). */
export function registrarValidacao(db: Db, id: number, dados: { status: ValidacaoStatus; obs?: string | null }, autor: string, agoraISO: string): void {
  db.transaction(
    (tx) => {
      const ag = agendamentoOuErro(tx, id);
      if (ag.status === "cancelado" || ag.status === "concluido" || ag.status === "nao_recebido") {
        throw new ErroDeRegra(`O agendamento está ${ag.status === "concluido" ? "concluído" : "encerrado"} e não pode mais ser validado.`);
      }
      tx.update(schema.agendamento)
        .set({ validacaoStatus: dados.status, validacaoObs: dados.obs?.trim() || null, validadoPor: autor, validadoEm: agoraISO, atualizadoEm: agoraISO })
        .where(eq(schema.agendamento.id, id))
        .run();
      registrarEvento(tx, id, "validado", autor, agoraISO, { de: ag.validacaoStatus, para: dados.status, obs: dados.obs ?? null });
    },
    { behavior: "immediate" },
  );
}

/**
 * O responsável confere a validação de Compras e autoriza (D24: qualquer resultado deixa autorizar).
 * Se a validação é divergente, a carga entra e abre uma pendência.
 */
export function autorizarCarga(db: Db, id: number, autor: string, agoraISO: string): { pendenciaId: number | null } {
  return db.transaction((tx) => autorizarCargaTx(tx, id, autor, agoraISO), { behavior: "immediate" });
}

/** Corpo transacional de `autorizarCarga`: usado também pelas ações rápidas, na mesma transação. */
export function autorizarCargaTx(tx: DbOuTx, id: number, autor: string, agoraISO: string): { pendenciaId: number | null } {
  const ag = agendamentoOuErro(tx, id);
  if (ag.status === "cancelado" || ag.status === "nao_recebido" || ag.status === "concluido") {
    throw new ErroDeRegra("Este agendamento está encerrado e não pode ser autorizado.");
  }
  if (ag.autorizadoEm) throw new ErroDeRegra("A carga já foi autorizada.");
  tx.update(schema.agendamento)
    .set({ autorizadoPor: autor, autorizadoEm: agoraISO, atualizadoEm: agoraISO })
    .where(eq(schema.agendamento.id, id))
    .run();
  registrarEvento(tx, id, "autorizado", autor, agoraISO, { validacao: ag.validacaoStatus });

  let pendenciaId: number | null = null;
  if (ag.validacaoStatus === "divergente") {
    pendenciaId = abrirPendenciaTx(tx, id, "divergencia_nf_pedido", ag.validacaoObs ?? "Divergência entre a NF e o pedido.", autor, agoraISO);
  }
  return { pendenciaId };
}

export function abrirPendenciaTx(tx: DbOuTx, id: number, tipo: "divergencia_nf_pedido" | "outra", descricao: string, autor: string, agoraISO: string): number {
  const p = tx
    .insert(schema.pendencia)
    .values({ agendamentoId: id, tipo, descricao, status: "aberta", abertaPor: autor, abertaEm: agoraISO })
    .returning({ id: schema.pendencia.id })
    .get();
  registrarEvento(tx, id, "pendencia_aberta", autor, agoraISO, { pendenciaId: p.id, tipo, descricao });
  return p.id;
}

export function abrirPendencia(db: Db, id: number, dados: { tipo: "divergencia_nf_pedido" | "outra"; descricao: string }, autor: string, agoraISO: string): { pendenciaId: number } {
  if (dados.descricao.trim() === "") throw new ErroDeRegra("Descreva a pendência.", { status: 400, campos: { descricao: "Descreva o que ficou pendente." } });
  return db.transaction(
    (tx) => {
      agendamentoOuErro(tx, id);
      return { pendenciaId: abrirPendenciaTx(tx, id, dados.tipo, dados.descricao.trim(), autor, agoraISO) };
    },
    { behavior: "immediate" },
  );
}

export function resolverPendencia(db: Db, pendenciaId: number, resolucao: string, autor: string, agoraISO: string): void {
  if (resolucao.trim() === "") throw new ErroDeRegra("Informe como a pendência foi resolvida.", { status: 400, campos: { resolucao: "Descreva a resolução." } });
  db.transaction(
    (tx) => {
      const p = tx.select().from(schema.pendencia).where(eq(schema.pendencia.id, pendenciaId)).get();
      if (!p) throw new ErroDeRegra("Pendência não encontrada.", { status: 404 });
      if (p.status === "resolvida") throw new ErroDeRegra("Esta pendência já está resolvida.");
      tx.update(schema.pendencia)
        .set({ status: "resolvida", resolvidaPor: autor, resolvidaEm: agoraISO, resolucao: resolucao.trim() })
        .where(eq(schema.pendencia.id, pendenciaId))
        .run();
      registrarEvento(tx, p.agendamentoId, "pendencia_resolvida", autor, agoraISO, { pendenciaId, resolucao: resolucao.trim() });
    },
    { behavior: "immediate" },
  );
}

export function listarPendencias(db: Db) {
  return db
    .select({
      id: schema.pendencia.id,
      agendamentoId: schema.pendencia.agendamentoId,
      tipo: schema.pendencia.tipo,
      descricao: schema.pendencia.descricao,
      status: schema.pendencia.status,
      abertaPor: schema.pendencia.abertaPor,
      abertaEm: schema.pendencia.abertaEm,
      resolvidaPor: schema.pendencia.resolvidaPor,
      resolvidaEm: schema.pendencia.resolvidaEm,
      resolucao: schema.pendencia.resolucao,
      fornecedor: schema.fornecedor.razaoSocial,
      data: schema.agendamento.data,
      horario: schema.agendamento.horario,
    })
    .from(schema.pendencia)
    .innerJoin(schema.agendamento, eq(schema.agendamento.id, schema.pendencia.agendamentoId))
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(eq(schema.agendamento.aprovacao, "aprovado"))
    .orderBy(desc(schema.pendencia.id))
    .all();
}

/** Armazéns de destino (RF1-07). Só troca o que ainda não teve entrada. */
export function definirDestino(db: Db, id: number, armazemIds: number[], autor: string, agoraISO: string): void {
  const unicos = [...new Set(armazemIds)];
  if (unicos.length === 0) throw new ErroDeRegra("Escolha pelo menos um armazém.", { status: 400, campos: { armazemIds: "Escolha pelo menos um armazém." } });
  db.transaction((tx) => definirDestinoTx(tx, id, unicos, autor, agoraISO), { behavior: "immediate" });
}

/** Corpo transacional de `definirDestino`: usado também pelas ações rápidas, na mesma transação. */
export function definirDestinoTx(tx: DbOuTx, id: number, unicos: number[], autor: string, agoraISO: string): void {
  const ag = agendamentoOuErro(tx, id);
  if (ag.status === "cancelado" || ag.status === "nao_recebido" || ag.status === "concluido") {
    throw new ErroDeRegra("Este agendamento está encerrado: o destino não muda.");
  }
  const validos = tx.select().from(schema.armazem).where(inArray(schema.armazem.id, unicos)).all();
  if (validos.length !== unicos.length) throw new ErroDeRegra("Armazém não encontrado.", { status: 404 });
  const jaNoDestino = new Set(tx.select({ a: schema.agendamentoArmazem.armazemId }).from(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.agendamentoId, id)).all().map((x) => x.a));
  for (const arm of validos.filter((v) => !jaNoDestino.has(v.id))) {
    if (!arm.ativo) throw new ErroDeRegra(`O armazém ${arm.nome} está inativo. Escolha um armazém ativo ou reative-o em Cadastros.`, { status: 400 });
    if (!arm.recebeDescarga) {
      throw new ErroDeRegra(`O armazém ${arm.nome} não recebe descarga. Escolha um armazém que receba.`, { status: 400 });
    }
  }

  const atuais = tx.select().from(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.agendamentoId, id)).all();
  const comEntrada = atuais.filter((a) => a.entradaEm);
  for (const a of comEntrada) {
    if (!unicos.includes(a.armazemId)) throw new ErroDeRegra("Não dá para tirar um armazém em que a descarga já começou.");
  }
  for (const a of atuais.filter((x) => !x.entradaEm && !unicos.includes(x.armazemId))) {
    tx.delete(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.id, a.id)).run();
  }
  const jaTem = new Set(atuais.map((a) => a.armazemId));
  let ordem = atuais.length;
  for (const armazemId of unicos.filter((a) => !jaTem.has(a))) {
    tx.insert(schema.agendamentoArmazem).values({ agendamentoId: id, armazemId, ordem: ordem++ }).run();
  }
  registrarEvento(tx, id, "destino_definido", autor, agoraISO, { de: atuais.map((a) => a.armazemId), para: unicos });
}

// ───────────────────────── chegada, entrada e saída ─────────────────────────

/** Chegada única do caminhão. Peso da balança é exigido acima do limite (estritamente maior). */
export function registrarChegada(db: Db, id: number, dados: { placa?: string | null; pesoBalancaKg?: string | null }, autor: string, agoraISO: string): void {
  db.transaction((tx) => registrarChegadaTx(tx, id, dados, autor, agoraISO), { behavior: "immediate" });
}

/** Corpo transacional de `registrarChegada`. `detalhe` entra no evento `chegou` (ex.: o resultado da conferência da portaria). */
export function registrarChegadaTx(
  tx: DbOuTx,
  id: number,
  dados: { placa?: string | null; pesoBalancaKg?: string | null },
  autor: string,
  agoraISO: string,
  detalhe: Record<string, unknown> = {},
): void {
  const ag = agendamentoOuErro(tx, id);
  const recusa = recusaDeTransicao(ag.status, "chegou");
  if (recusa) throw new ErroDeRegra(recusa);
  const limite = lerParametro(tx, "limite_peso_chapa_kg", "500");
  let balanca: string | null = null;
  const informado = dados.pesoBalancaKg?.trim().replace(",", ".");
  if (informado) {
    const v = decOuNulo(informado);
    if (v === null || v.isNegative()) {
      throw new ErroDeRegra("Peso da balança inválido. Digite um número positivo, por exemplo 20500,5.", { status: 400, campos: { pesoBalancaKg: "Número positivo, com vírgula ou ponto." } });
    }
    balanca = paraTexto(v);
  }
  if (exigePesoBalanca(ag.pesoDeclaradoKg, limite) && balanca === null) {
    throw new ErroDeRegra(`Carga acima de ${limite} kg: registre o peso da balança na chegada.`, { status: 400, campos: { pesoBalancaKg: "Obrigatório para carga acima do limite." } });
  }
  const placa = dados.placa?.trim().toUpperCase() || ag.placa;
  tx.update(schema.agendamento)
    .set({ status: "chegou", chegadaEm: agoraISO, placa, pesoBalancaKg: balanca, atualizadoEm: agoraISO })
    .where(eq(schema.agendamento.id, id))
    .run();
  registrarEvento(tx, id, "chegou", autor, agoraISO, { de: ag.status, para: "chegou", placa, pesoBalancaKg: balanca, ...detalhe });
}

/** Entrada em um armazém. Exige chegada e autorização. A primeira entrada leva a `em_descarga`. */
export function registrarEntrada(db: Db, id: number, armazemId: number, autor: string, agoraISO: string): void {
  db.transaction((tx) => registrarEntradaTx(tx, id, armazemId, autor, agoraISO), { behavior: "immediate" });
}

/** Corpo transacional de `registrarEntrada`: usado também pelas ações rápidas, na mesma transação. */
export function registrarEntradaTx(tx: DbOuTx, id: number, armazemId: number, autor: string, agoraISO: string): void {
  const ag = agendamentoOuErro(tx, id);
  if (ag.status !== "chegou" && ag.status !== "em_descarga") {
    throw new ErroDeRegra(ag.status === "agendado" ? "O caminhão ainda não chegou. Registre a chegada antes da entrada." : "Este agendamento está encerrado.");
  }
  if (!ag.autorizadoEm) throw new ErroDeRegra("A carga ainda não foi autorizada pelo responsável. Autorize antes da entrada.");
  const linha = tx
    .select()
    .from(schema.agendamentoArmazem)
    .where(and(eq(schema.agendamentoArmazem.agendamentoId, id), eq(schema.agendamentoArmazem.armazemId, armazemId)))
    .get();
  if (!linha) throw new ErroDeRegra("Este armazém não está entre os destinos da carga. Defina o destino primeiro.");
  if (linha.entradaEm) throw new ErroDeRegra("A entrada neste armazém já foi registrada.");
  tx.update(schema.agendamentoArmazem).set({ entradaEm: agoraISO, responsavel: autor }).where(eq(schema.agendamentoArmazem.id, linha.id)).run();
  if (ag.status === "chegou") {
    tx.update(schema.agendamento).set({ status: "em_descarga", atualizadoEm: agoraISO }).where(eq(schema.agendamento.id, id)).run();
  }
  registrarEvento(tx, id, "entrada", autor, agoraISO, { armazemId });
}

export interface SaidaDados {
  chapasQtd: number;
  equipamentoIds: number[];
  pesoKg?: string | null;
}

/**
 * Saída de um armazém, com chapas e equipamentos usados. Quando todos os destinos têm saída,
 * o agendamento vai a `concluido` e `liberacao_em` recebe a última saída (única função que grava as duas).
 */
export function registrarSaida(db: Db, id: number, armazemId: number, dados: SaidaDados, autor: string, agoraISO: string): { concluido: boolean } {
  if (!Number.isInteger(dados.chapasQtd) || dados.chapasQtd < 0 || dados.chapasQtd > 20) {
    throw new ErroDeRegra("Informe quantos funcionários atuaram, de 0 a 20.", { status: 400, campos: { chapasQtd: "Número inteiro de 0 a 20." } });
  }
  return db.transaction((tx) => registrarSaidaTx(tx, id, armazemId, dados, autor, agoraISO), { behavior: "immediate" });
}

/** Corpo transacional de `registrarSaida`: usado também pelas ações rápidas, na mesma transação. */
export function registrarSaidaTx(tx: DbOuTx, id: number, armazemId: number, dados: SaidaDados, autor: string, agoraISO: string): { concluido: boolean } {
  const ag = agendamentoOuErro(tx, id);
  if (ag.status !== "em_descarga") throw new ErroDeRegra("A saída só vale depois da entrada em um armazém.");
  const linha = tx
    .select()
    .from(schema.agendamentoArmazem)
    .where(and(eq(schema.agendamentoArmazem.agendamentoId, id), eq(schema.agendamentoArmazem.armazemId, armazemId)))
    .get();
  if (!linha || !linha.entradaEm) throw new ErroDeRegra("Registre a entrada neste armazém antes da saída.");
  if (linha.saidaEm) throw new ErroDeRegra("A saída deste armazém já foi registrada.");

  const equipamentoIds = [...new Set(dados.equipamentoIds)];
  if (equipamentoIds.length) {
    const doArmazem = tx
      .select({ id: schema.equipamento.id, disponivel: schema.equipamento.disponivel, status: schema.equipamento.status })
      .from(schema.equipamento)
      .where(and(inArray(schema.equipamento.id, equipamentoIds), eq(schema.equipamento.armazemId, armazemId)))
      .all();
    if (doArmazem.some((e) => e.disponivel <= 0 || e.status === "manutencao")) throw new ErroDeRegra("Algum equipamento escolhido está indisponível. Desmarque-o ou atualize o cadastro.", { status: 400 });
    if (doArmazem.length !== equipamentoIds.length) throw new ErroDeRegra("Algum equipamento escolhido não pertence a este armazém.", { status: 400 });
  }
  let pesoKg: string | null = null;
  const informado = dados.pesoKg?.trim().replace(",", ".");
  if (informado) {
    const v = decOuNulo(informado);
    if (v === null || v.isNegative()) throw new ErroDeRegra("Peso inválido. Digite um número positivo.", { status: 400, campos: { pesoKg: "Número positivo." } });
    pesoKg = paraTexto(v);
  }

  tx.update(schema.agendamentoArmazem)
    .set({ saidaEm: agoraISO, chapasQtd: dados.chapasQtd, pesoKg, responsavel: autor })
    .where(eq(schema.agendamentoArmazem.id, linha.id))
    .run();
  for (const equipamentoId of equipamentoIds) {
    tx.insert(schema.descargaEquipamento).values({ agendamentoArmazemId: linha.id, equipamentoId }).run();
  }
  registrarEvento(tx, id, "saida", autor, agoraISO, { armazemId, chapasQtd: dados.chapasQtd, equipamentoIds });

  const todas = tx.select().from(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.agendamentoId, id)).all();
  const pendentes = todas.filter((a) => a.id !== linha.id && !a.saidaEm);
  if (pendentes.length > 0) return { concluido: false };

  // todos os destinos já saíram: a liberação é a última saída (instantes com -03:00 ordenam como texto)
  const ultima = todas.map((a) => (a.id === linha.id ? agoraISO : a.saidaEm!)).sort().at(-1)!;
  tx.update(schema.agendamento).set({ status: "concluido", liberacaoEm: ultima, atualizadoEm: agoraISO }).where(eq(schema.agendamento.id, id)).run();
  registrarEvento(tx, id, "concluido", autor, agoraISO, { de: "em_descarga", para: "concluido", liberacaoEm: ultima });
  return { concluido: true };
}

/** Lista para o responsável escolher um agendamento do dia (ou próximos). */
/** As telas de Compras só tratam pedido aprovado (D49). */
export function exigirPedidoAprovado(db: DbOuTx, id: number): void {
  const a = db.select({ aprovacao: schema.agendamento.aprovacao }).from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
  if (a && a.aprovacao !== "aprovado") {
    throw new ErroDeRegra("Este pedido ainda não foi aprovado por Compras. Aprove em Aprovações antes de seguir.", { status: 409 });
  }
}

export function listarAgendamentos(db: Db, aPartirDe: string) {
  return db
    .select({
      id: schema.agendamento.id,
      data: schema.agendamento.data,
      horario: schema.agendamento.horario,
      status: schema.agendamento.status,
      placa: schema.agendamento.placa,
      acondicionamento: schema.agendamento.acondicionamentoOcupacao,
      validacao: schema.agendamento.validacaoStatus,
      autorizadoEm: schema.agendamento.autorizadoEm,
      chegadaEm: schema.agendamento.chegadaEm,
      fornecedor: schema.fornecedor.razaoSocial,
    })
    .from(schema.agendamento)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(eq(schema.agendamento.aprovacao, "aprovado"))
    .all()
    .filter((a) => a.data >= aPartirDe)
    .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario) || a.id - b.id);
}
