import { and, desc, eq, gte, isNull } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { NAO_RECEBIMENTO_MOTIVO, type AcondicionamentoOcupacao, type ExcecaoOcupacao, type NaoRecebimentoMotivo } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";

import { carregarContexto, registrarEvento, type DbOuTx } from "./comum";
import { dataDoInstante, dataBR } from "./datas";
import { recusaDeTransicao } from "./estado";
import { verificarOcupacao } from "./ocupacao";

/** Desvios do fluxo: cancelar, vaga liberada, reagendar, não recebimento. */

function agendamentoOuErro(db: DbOuTx, id: number) {
  const ag = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
  if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
  return ag;
}

// ───────────────────────── cancelar ─────────────────────────

export type QuemCancela = "fornecedor" | "armazem";

/** Cancela, grava motivo, autor e evento, e libera a vaga (RF1-14, 19). */
export function cancelarAgendamento(db: Db, id: number, dados: { motivo: string; por: QuemCancela }, autor: string, agoraISO: string): { vagaId: number } {
  const motivo = dados.motivo.trim();
  if (motivo === "") throw new ErroDeRegra("Informe o motivo do cancelamento.", { status: 400, campos: { motivo: "Descreva o motivo." } });
  return db.transaction(
    (tx) => {
      const ag = agendamentoOuErro(tx, id);
      const recusa = recusaDeTransicao(ag.status, "cancelado");
      if (recusa) throw new ErroDeRegra(recusa);
      tx.update(schema.agendamento)
        .set({ status: "cancelado", motivoCancelamento: motivo, canceladoPor: dados.por, canceladoEm: agoraISO, atualizadoEm: agoraISO })
        .where(eq(schema.agendamento.id, id))
        .run();
      if (ag.compraId) {
        tx.update(schema.compra).set({ status: "cancelada" }).where(eq(schema.compra.id, ag.compraId)).run();
      }
      const vaga = tx
        .insert(schema.vagaLiberada)
        .values({ data: ag.data, horario: ag.horario, origemAgendamentoId: id })
        .returning({ id: schema.vagaLiberada.id })
        .get();
      registrarEvento(tx, id, "cancelado", autor, agoraISO, { de: ag.status, para: "cancelado", motivo, por: dados.por });
      return { vagaId: vaga.id };
    },
    { behavior: "immediate" },
  );
}

/** O fornecedor cancela pela tela do link (o token não reabre). */
export function cancelarPeloLink(db: Db, token: string, motivo: string, agoraISO: string): { vagaId: number } {
  const compra = db.select().from(schema.compra).where(eq(schema.compra.token, token)).get();
  if (!compra) throw new ErroDeRegra("Link inválido.", { status: 404 });
  const ag = db.select().from(schema.agendamento).where(eq(schema.agendamento.compraId, compra.id)).get();
  if (!ag) throw new ErroDeRegra("Este link ainda não tem agendamento para cancelar.");
  return cancelarAgendamento(db, ag.id, { motivo, por: "fornecedor" }, "fornecedor", agoraISO);
}

// ───────────────────────── vaga liberada ─────────────────────────

export interface CandidatoVaga {
  agendamentoId: number;
  fornecedor: string;
  data: string;
  horario: string;
  acondicionamento: AcondicionamentoOcupacao;
}

/** Vagas abertas de hoje em diante e, para cada uma, os agendamentos `agendado` que cabem nela (RF1-15). */
export function listarVagasAbertas(db: Db, agoraISO: string) {
  const hoje = dataDoInstante(agoraISO);
  const vagas = db
    .select()
    .from(schema.vagaLiberada)
    .where(and(isNull(schema.vagaLiberada.ocupadaPorAgendamentoId), gte(schema.vagaLiberada.data, hoje)))
    .orderBy(desc(schema.vagaLiberada.id))
    .all();
  const ctx = carregarContexto(db, agoraISO);
  const agendados = db
    .select({
      id: schema.agendamento.id,
      data: schema.agendamento.data,
      horario: schema.agendamento.horario,
      acondicionamento: schema.agendamento.acondicionamentoOcupacao,
      fornecedor: schema.fornecedor.razaoSocial,
    })
    .from(schema.agendamento)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(and(eq(schema.agendamento.status, "agendado"), eq(schema.agendamento.aprovacao, "aprovado")))
    .all();

  return vagas.map((v) => {
    const livre = verificarOcupacao(ctx, { data: v.data!, horario: v.horario!, acondicionamento: "unitizado" }).aceita;
    const candidatos: CandidatoVaga[] = livre
      ? agendados
          .filter((a) => !(a.data === v.data && a.horario === v.horario))
          .filter((a) => verificarOcupacao(ctx, { data: v.data!, horario: v.horario!, acondicionamento: a.acondicionamento, ignorarAgendamentoId: a.id }).aceita)
          .map((a) => ({ agendamentoId: a.id, fornecedor: a.fornecedor, data: a.data, horario: a.horario, acondicionamento: a.acondicionamento }))
      : [];
    return { ...v, livre, candidatos };
  });
}

/**
 * O responsável escolhe quem ocupa a vaga (E5). A vaga só é ocupada se ainda estiver livre (D43).
 * O ocupante muda de data e horário (mesma linha) e a vaga antiga dele fica livre.
 */
export function ocuparVaga(db: Db, vagaId: number, agendamentoId: number, autor: string, agoraISO: string): void {
  db.transaction(
    (tx) => {
      const vaga = tx.select().from(schema.vagaLiberada).where(eq(schema.vagaLiberada.id, vagaId)).get();
      if (!vaga) throw new ErroDeRegra("Vaga não encontrada.", { status: 404 });
      if (vaga.ocupadaPorAgendamentoId !== null) throw new ErroDeRegra("Esta vaga já foi ocupada por outro agendamento.");
      const ag = agendamentoOuErro(tx, agendamentoId);
      if (ag.status !== "agendado") throw new ErroDeRegra("Só um agendamento ainda não chegado pode ocupar a vaga.");

      const r = verificarOcupacao(carregarContexto(tx, agoraISO), {
        data: vaga.data!,
        horario: vaga.horario!,
        acondicionamento: ag.acondicionamentoOcupacao,
        ignorarAgendamentoId: ag.id,
      });
      if (!r.aceita) throw new ErroDeRegra(`A vaga não está mais livre para este agendamento: ${r.mensagem}`, { detalhe: { motivo: r.motivo } });

      tx.update(schema.agendamento)
        .set({ data: vaga.data!, horario: vaga.horario!, remarcacoes: ag.remarcacoes + 1, atualizadoEm: agoraISO })
        .where(eq(schema.agendamento.id, ag.id))
        .run();
      tx.update(schema.vagaLiberada)
        .set({ ocupadaPorAgendamentoId: ag.id, definidoPor: autor, definidoEm: agoraISO })
        .where(eq(schema.vagaLiberada.id, vagaId))
        .run();
      registrarEvento(tx, ag.id, "vaga_ocupada", autor, agoraISO, {
        vagaId,
        de: { data: ag.data, horario: ag.horario },
        para: { data: vaga.data, horario: vaga.horario },
      });
    },
    { behavior: "immediate" },
  );
}

// ───────────────────────── reagendar ─────────────────────────

export interface Remarcacao {
  data: string;
  horario: string;
  /** `caso_fortuito` ou `prioridade` (D23, só defensivo ou fertilizante) ignoram só o limite de ocupação (O6, O14). */
  excecao?: ExcecaoOcupacao | null;
  motivo?: string | null;
}

/** Remarca a mesma linha: muda data e horário, soma `remarcacoes` e grava o evento com o antes e o depois. */
export function remarcarAgendamento(db: Db, id: number, dados: Remarcacao, autor: string, agoraISO: string): void {
  if (dados.excecao === "caso_fortuito" && !dados.motivo?.trim()) {
    throw new ErroDeRegra("Informe o motivo do caso fortuito.", { status: 400, campos: { motivo: "Descreva o que aconteceu." } });
  }
  if (dados.excecao === "prioridade" && !dados.motivo?.trim()) {
    throw new ErroDeRegra("A prioridade exige justificativa. Explique por que esta carga passa na frente.", { status: 400, campos: { motivo: "Justificativa obrigatória." } });
  }
  db.transaction(
    (tx) => {
      const ag = agendamentoOuErro(tx, id);
      if (ag.status !== "agendado") throw new ErroDeRegra("Só dá para reagendar um agendamento que ainda não chegou.");
      if (ag.aprovacao !== "aprovado") throw new ErroDeRegra("Este pedido ainda não foi aprovado por Compras.", { status: 409 });
      if (dados.excecao === "prioridade" && !cargaElegivelPrioridade(tx, id)) {
        throw new ErroDeRegra("Só carga com defensivo ou fertilizante pode pedir prioridade. Esta carga não tem item desses grupos na compra.", { status: 400 });
      }
      const r = verificarOcupacao(carregarContexto(tx, agoraISO), {
        data: dados.data,
        horario: dados.horario,
        acondicionamento: ag.acondicionamentoOcupacao,
        excecao: dados.excecao ?? null,
        ignorarAgendamentoId: ag.id,
      });
      if (!r.aceita) throw new ErroDeRegra(r.mensagem, { detalhe: { motivo: r.motivo, proxima: r.proxima } });

      tx.update(schema.agendamento)
        .set({
          data: dados.data,
          horario: dados.horario,
          remarcacoes: ag.remarcacoes + 1,
          // a exceção só fica gravada se foi de fato usada; remarcação comum limpa a anterior (o evento guarda o histórico)
          excecaoOcupacao: r.excedeu ? dados.excecao! : null,
          excecaoMotivo: r.excedeu ? dados.motivo!.trim() : null,
          prioridade: r.excedeu && dados.excecao === "prioridade",
          atualizadoEm: agoraISO,
        })
        .where(eq(schema.agendamento.id, id))
        .run();
      registrarEvento(tx, id, "remarcado", autor, agoraISO, {
        de: { data: ag.data, horario: ag.horario },
        para: { data: dados.data, horario: dados.horario },
        excecao: dados.excecao ?? null,
        motivo: dados.motivo?.trim() || null,
        origem: origemPadrao(),
      });
    },
    { behavior: "immediate" },
  );
}

/** Grupos que podem pedir prioridade (D23): fertilizantes (FER) e defensivos/agroquímicos (AGR), pelos itens da compra. */
const GRUPOS_PRIORIDADE = ["FER", "AGR"];

export function cargaElegivelPrioridade(db: DbOuTx, agendamentoId: number): boolean {
  const ag = db.select({ compraId: schema.agendamento.compraId }).from(schema.agendamento).where(eq(schema.agendamento.id, agendamentoId)).get();
  if (!ag?.compraId) return false;
  const itens = db
    .select({ grupo: schema.produto.grupo })
    .from(schema.compraItem)
    .innerJoin(schema.produto, eq(schema.produto.id, schema.compraItem.produtoId))
    .where(eq(schema.compraItem.compraId, ag.compraId))
    .all();
  return itens.some((i) => i.grupo !== null && GRUPOS_PRIORIDADE.includes(i.grupo));
}

// ───────────────────────── não recebimento ─────────────────────────

export interface NaoRecebimentoEntrada {
  agendamentoId?: number | null;
  fornecedorId?: number | null;
  placa?: string | null;
  motivo: string;
  descricao?: string | null;
}

/** Não recebimento com um dos 4 motivos. Não cria pendência (R p. 2, D24). */
export function registrarNaoRecebimento(db: Db, dados: NaoRecebimentoEntrada, autor: string, agoraISO: string): { id: number } {
  if (!(NAO_RECEBIMENTO_MOTIVO as readonly string[]).includes(dados.motivo)) {
    throw new ErroDeRegra(`Motivo inválido. Use um destes: ${NAO_RECEBIMENTO_MOTIVO.join(", ")}.`, { status: 400, campos: { motivo: "Escolha um motivo da lista." } });
  }
  const motivo = dados.motivo as NaoRecebimentoMotivo;
  const descricao = dados.descricao?.trim() || null;
  if (motivo === "outro" && !descricao) {
    throw new ErroDeRegra("Motivo \"outro\" exige descrição.", { status: 400, campos: { descricao: "Descreva o motivo." } });
  }
  if (motivo === "sem_agendamento_sem_vaga" && dados.agendamentoId) {
    throw new ErroDeRegra("Caminhão sem agendamento não tem agendamento associado.", { status: 400 });
  }

  return db.transaction(
    (tx) => {
      let fornecedorId = dados.fornecedorId ?? null;
      let placa = dados.placa?.trim().toUpperCase() || null;
      if (dados.agendamentoId) {
        const ag = agendamentoOuErro(tx, dados.agendamentoId);
        const recusa = recusaDeTransicao(ag.status, "nao_recebido");
        if (recusa) throw new ErroDeRegra(recusa);
        const jaTem = tx.select({ id: schema.naoRecebimento.id }).from(schema.naoRecebimento).where(eq(schema.naoRecebimento.agendamentoId, ag.id)).get();
        if (jaTem) throw new ErroDeRegra("Este agendamento já tem um não recebimento registrado.");
        fornecedorId = ag.fornecedorId;
        placa = placa ?? ag.placa;
        tx.update(schema.agendamento).set({ status: "nao_recebido", atualizadoEm: agoraISO }).where(eq(schema.agendamento.id, ag.id)).run();
        registrarEvento(tx, ag.id, "nao_recebido", autor, agoraISO, { de: ag.status, para: "nao_recebido", motivo, descricao });
        // o fornecedor do portal precisa saber o que corrigir: o aviso leva o motivo e o caminho para agendar de novo
        if (ag.criadoPorUsuarioId !== null) {
          tx.insert(schema.notificacao)
            .values({
              usuarioId: ag.criadoPorUsuarioId,
              tipo: "pedido_nao_recebido",
              mensagem: `Seu pedido para ${dataBR(ag.data)} às ${ag.horario} não foi recebido na portaria.${descricao ? ` Motivo: ${descricao}` : ""} Agende de novo com a nota correta.`,
              link: "/fornecedor",
              lida: false,
              criadoEm: agoraISO,
            })
            .run();
        }
      }
      const linha = tx
        .insert(schema.naoRecebimento)
        .values({
          agendamentoId: dados.agendamentoId ?? null,
          fornecedorId,
          placa,
          motivo,
          descricao,
          registradoPor: autor,
          registradoEm: agoraISO,
          origem: origemPadrao(),
        })
        .returning({ id: schema.naoRecebimento.id })
        .get();
      return { id: linha.id };
    },
    { behavior: "immediate" },
  );
}

export function listarNaoRecebimentos(db: Db) {
  return db
    .select({
      id: schema.naoRecebimento.id,
      agendamentoId: schema.naoRecebimento.agendamentoId,
      motivo: schema.naoRecebimento.motivo,
      descricao: schema.naoRecebimento.descricao,
      placa: schema.naoRecebimento.placa,
      registradoPor: schema.naoRecebimento.registradoPor,
      registradoEm: schema.naoRecebimento.registradoEm,
      fornecedor: schema.fornecedor.razaoSocial,
    })
    .from(schema.naoRecebimento)
    .leftJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.naoRecebimento.fornecedorId))
    .orderBy(desc(schema.naoRecebimento.id))
    .limit(50)
    .all();
}
