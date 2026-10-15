import { and, eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { AcondicionamentoOcupacao } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";

import { carregarContexto, lerParametro, registrarEvento } from "./comum";
import { conferirNota, type Veredito } from "./conferencia";
import { registrarNaoRecebimento } from "./desvios";
import { gravarNfs, pesoDeclarado, type NfLida } from "./agendar";
import type { NfeLida } from "./nf-xml";
import { abrirPendenciaTx, exigirPedidoAprovado, registrarChegadaTx } from "./descarga";
import { dataDoInstante } from "./datas";
import { planejarRemarcacaoPorAtraso } from "./estado";
import { proximaVaga, type Vaga } from "./ocupacao";

/** Atraso (RF1-20, D27) e caminhão sem agendamento (RF1-21, D28). Nunca automático: só por ação do responsável ou da portaria. */

/** Um clique do responsável: remarca o atrasado para o próximo horário livre e grava o aviso ao fornecedor. */
export function remarcarPorAtraso(db: Db, id: number, autor: string, agoraISO: string): { proxima: Vaga } {
  return db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
      if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
      if (ag.aprovacao !== "aprovado") throw new ErroDeRegra("Este pedido ainda não foi aprovado por Compras.", { status: 409 });
      const bruto = Number(lerParametro(tx, "tolerancia_min", "30"));
      const tolerancia = Number.isFinite(bruto) && bruto >= 0 ? bruto : 30;
      const plano = planejarRemarcacaoPorAtraso(
        { id: ag.id, status: ag.status, data: ag.data, horario: ag.horario, chegadaEm: ag.chegadaEm, acondicionamento: ag.acondicionamentoOcupacao },
        carregarContexto(tx, agoraISO),
        tolerancia,
      );
      if (!plano.atraso.atrasado) throw new ErroDeRegra(`Este agendamento não está atrasado (tolerância de ${tolerancia} min).`);
      if (!plano.proxima) throw new ErroDeRegra("Não há horário livre nos próximos dias. Combine uma nova data com o fornecedor.");
      tx.update(schema.agendamento)
        .set({ data: plano.proxima.data, horario: plano.proxima.horario, remarcacoes: ag.remarcacoes + 1, atualizadoEm: agoraISO })
        .where(eq(schema.agendamento.id, id))
        .run();
      registrarEvento(tx, id, "atraso", autor, agoraISO, { minutos: plano.atraso.minutos });
      registrarEvento(tx, id, "remarcado", autor, agoraISO, { motivo: "atraso", de: { data: ag.data, horario: ag.horario }, para: plano.proxima });
      tx.insert(schema.aviso)
        .values({ agendamentoId: id, destinatario: "fornecedor", tipo: "atraso_remarcado", mensagem: plano.aviso, dataReferencia: plano.proxima.data, criadoEm: agoraISO })
        .run();
      return { proxima: plano.proxima };
    },
    { behavior: "immediate" },
  );
}

/** Avisos ao fornecedor de um agendamento (aparecem na tela do link; sem e-mail real). */
export function listarAvisos(db: Db, agendamentoId: number) {
  return db.select().from(schema.aviso).where(eq(schema.aviso.agendamentoId, agendamentoId)).all();
}

export interface SemAgendamento {
  fornecedorId: number;
  /** A NF-e lida do XML: o pedido criado na hora já nasce com a nota, o peso e a observação preenchidos. */
  nota?: NfLida;
  /** Peso declarado digitado na portaria; vale mais que o da nota. */
  pesoKg?: string | null;
  placa?: string | null;
  acondicionamento: AcondicionamentoOcupacao;
}

/** Portaria: com vaga hoje, agenda na hora e já marca a chegada; sem vaga, registra o não recebimento e devolve a próxima data. */
export function caminhaoSemAgendamento(
  db: Db,
  dados: SemAgendamento,
  autor: string,
  agoraISO: string,
):
  | { agendado: true; agendamentoId: number; vaga: Vaga }
  | { agendado: false; naoRecebimentoId: number; proxima: Vaga | null } {
  return db.transaction(
    (tx) => {
      const forn = tx.select({ id: schema.fornecedor.id }).from(schema.fornecedor).where(eq(schema.fornecedor.id, dados.fornecedorId)).get();
      if (!forn) throw new ErroDeRegra("Escolha o fornecedor do cadastro.", { status: 400 });
      const hoje = dataDoInstante(agoraISO);
      const placa = dados.placa?.trim().toUpperCase() || null;
      const vaga = proximaVaga(carregarContexto(tx, agoraISO), { data: hoje, horario: "00:00", acondicionamento: dados.acondicionamento });

      if (vaga && vaga.data === hoje) {
        const id = tx
          .insert(schema.agendamento)
          .values({
            fornecedorId: dados.fornecedorId,
            data: vaga.data,
            horario: vaga.horario,
            placa,
            acondicionamentoOcupacao: dados.acondicionamento,
            pesoDeclaradoKg: dados.pesoKg?.trim() ? dados.pesoKg.trim().replace(",", ".") : dados.nota ? pesoDeclarado([dados.nota.nf]) : null,
            observacao: dados.nota ? `Sem agendamento. NF ${dados.nota.nf.numero ?? "sem número"}${dados.nota.nf.pedidoFornecedor ? `, pedido ${dados.nota.nf.pedidoFornecedor}` : ""}.` : null,
            status: "chegou",
            agendadoNaHora: true,
            chegadaEm: agoraISO,
            origem: origemPadrao(),
            criadoEm: agoraISO,
          })
          .returning({ id: schema.agendamento.id })
          .get().id;
        if (dados.nota) gravarNfs(tx, id, [dados.nota], agoraISO);
        registrarEvento(tx, id, "agendado", autor, agoraISO, { agendadoNaHora: true, para: vaga });
        registrarEvento(tx, id, "chegou", autor, agoraISO, { de: "agendado", para: "chegou", placa });
        return { agendado: true as const, agendamentoId: id, vaga };
      }
      const nr = tx
        .insert(schema.naoRecebimento)
        .values({
          agendamentoId: null,
          fornecedorId: dados.fornecedorId,
          placa,
          motivo: "sem_agendamento_sem_vaga",
          registradoPor: autor,
          registradoEm: agoraISO,
          origem: origemPadrao(),
        })
        .returning({ id: schema.naoRecebimento.id })
        .get().id;
      return { agendado: false as const, naoRecebimentoId: nr, proxima: vaga };
    },
    { behavior: "immediate" },
  );
}

export interface AtrasoManual {
  /** Previsão de chegada, `HH:MM`. */
  previsao: string;
  motivo: string;
  por: "fornecedor" | "portaria";
}

/** Registro de atraso avisado (grupo 6). Só grava evento: não muda estado, data nem horário (a remarcação segue sendo `remarcarPorAtraso`). */
export function registrarAtrasoManual(db: Db, id: number, dados: AtrasoManual, autor: string, agoraISO: string): void {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.previsao)) {
    throw new ErroDeRegra("Informe a previsão de chegada no formato HH:MM, por exemplo 09:30.", { status: 400, campos: { previsao: "Use HH:MM." } });
  }
  const motivo = dados.motivo.trim();
  if (motivo === "") throw new ErroDeRegra("Informe o motivo do atraso.", { status: 400, campos: { motivo: "Descreva o motivo." } });
  db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
      if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
      if (ag.status !== "agendado" || ag.chegadaEm) throw new ErroDeRegra("Só dá para avisar atraso de um caminhão que ainda não chegou.");
      registrarEvento(tx, id, "atraso", autor, agoraISO, { manual: true, previsao: dados.previsao, motivo, por: dados.por, origem: origemPadrao() });
    },
    { behavior: "immediate" },
  );
}

export function cadastrarAtrasoPeloLink(db: Db, token: string, dados: Omit<AtrasoManual, "por">, agoraISO: string): void {
  const compra = db.select().from(schema.compra).where(eq(schema.compra.token, token)).get();
  if (!compra) throw new ErroDeRegra("Link inválido.", { status: 404 });
  const ag = db.select({ id: schema.agendamento.id }).from(schema.agendamento).where(eq(schema.agendamento.compraId, compra.id)).get();
  if (!ag) throw new ErroDeRegra("Este link ainda não tem agendamento.");
  registrarAtrasoManual(db, ag.id, { ...dados, por: "fornecedor" }, "fornecedor", agoraISO);
}

export interface AtrasoAvisado {
  agendamentoId: number;
  previsao: string;
  motivo: string;
  por: string;
  avisadoEm: string;
}

/** Último atraso avisado de cada agendamento (só leitura). */
export function atrasosAvisados(db: Db, agendamentoIds?: number[]): Map<number, AtrasoAvisado> {
  const mapa = new Map<number, AtrasoAvisado>();
  const todos = (agendamentoIds && agendamentoIds.length === 0 ? [] : db.select().from(schema.evento).all())
    .filter((e) => !agendamentoIds || agendamentoIds.includes(e.agendamentoId))
    .sort((a, b) => a.id - b.id);
  // um evento de remarcação ou cancelamento depois do aviso torna o aviso obsoleto
  const eventos = todos.filter((e) => e.tipo === "atraso");
  const encerra = (e: { agendamentoId: number; id: number }) =>
    todos.some((x) => x.agendamentoId === e.agendamentoId && x.id > e.id && (x.tipo === "remarcado" || x.tipo === "cancelado"));
  for (const e of eventos) {
    if (encerra(e)) {
      mapa.delete(e.agendamentoId);
      continue;
    }
    let d: { manual?: boolean; previsao?: string; motivo?: string; por?: string } = {};
    try {
      d = e.detalhe ? JSON.parse(e.detalhe) : {};
    } catch {
      continue;
    }
    if (!d.manual) continue;
    mapa.set(e.agendamentoId, { agendamentoId: e.agendamentoId, previsao: d.previsao ?? "", motivo: d.motivo ?? "", por: d.por ?? "", avisadoEm: e.criadoEm });
  }
  return mapa;
}

export interface ChegadaPorConferencia {
  agendamentoId: number;
  placa?: string | null;
  pesoBalancaKg?: string | null;
  observacao?: string | null;
  /** Chave da nota conferida. Obrigatória: a conferência é sempre refeita no servidor. */
  chave: string;
  /** A nota lida do XML, para refazer a conferência com os mesmos dados que a tela mostrou. */
  nf?: NfeLida | null;
}

/**
 * Chegada registrada pela portaria depois de conferir a nota (D53). O veredito é refeito aqui, no servidor.
 * Divergente exige a observação e abre uma pendência. Chegada, evento e pendência numa transação só.
 */
export function registrarChegadaDaConferencia(
  db: Db,
  dados: ChegadaPorConferencia,
  autor: string,
  agoraISO: string,
): { veredito: Veredito; pendenciaId: number | null; galpoes: string[] } {
  const observacao = dados.observacao?.trim() || null;
  if (digitosDe(dados.chave).length !== 44) {
    throw new ErroDeRegra("Confira a nota antes de registrar a chegada: falta a chave de 44 números.", { status: 400, campos: { chave: "Confira a nota primeiro." } });
  }
  return db.transaction(
    (tx) => {
      exigirPedidoAprovado(tx, dados.agendamentoId);
      const conferencia = conferirNota(tx, { nf: dados.nf, chave: dados.chave, placa: dados.placa, agendamentoId: dados.agendamentoId }, agoraISO);
      const veredito = conferencia.veredito;
      if (veredito === "divergente" && !observacao) {
        throw new ErroDeRegra("A nota não confere com o agendamento. Explique o motivo para registrar a chegada.", {
          status: 400,
          campos: { observacao: "Explique por que a chegada será registrada mesmo assim." },
        });
      }
      registrarChegadaTx(tx, dados.agendamentoId, { placa: dados.placa, pesoBalancaKg: dados.pesoBalancaKg }, autor, agoraISO, {
        conferencia: veredito,
        observacao,
        origem: origemPadrao(),
      });
      let pendenciaId: number | null = null;
      if (veredito === "divergente") {
        const diferencas = conferencia.itens.filter((i) => i.resultado === "nao_bate").map((i) => i.mensagem).join(" ");
        pendenciaId = abrirPendenciaTx(tx, dados.agendamentoId, "divergencia_nf_pedido", `Conferência na portaria: ${diferencas} Observação: ${observacao}`, autor, agoraISO);
      }
      const galpoes = tx
        .select({ nome: schema.armazem.nome })
        .from(schema.agendamentoArmazem)
        .innerJoin(schema.armazem, eq(schema.armazem.id, schema.agendamentoArmazem.armazemId))
        .where(eq(schema.agendamentoArmazem.agendamentoId, dados.agendamentoId))
        .all()
        .map((g) => g.nome);
      return { veredito, pendenciaId, galpoes };
    },
    { behavior: "immediate" },
  );
}

export interface AguardadoHoje {
  agendamentoId: number;
  horario: string;
  fornecedor: string;
  placa: string | null;
}

/** Agendamentos aprovados de hoje que ainda não chegaram, por horário. */
export function aguardadosHoje(db: Db, agoraISO: string): AguardadoHoje[] {
  return db
    .select({ agendamentoId: schema.agendamento.id, horario: schema.agendamento.horario, fornecedor: schema.fornecedor.razaoSocial, placa: schema.agendamento.placa })
    .from(schema.agendamento)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(and(eq(schema.agendamento.data, dataDoInstante(agoraISO)), eq(schema.agendamento.status, "agendado"), eq(schema.agendamento.aprovacao, "aprovado")))
    .all()
    .sort((a, b) => a.horario.localeCompare(b.horario) || a.agendamentoId - b.agendamentoId);
}

const digitosDe = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");

/** A portaria recusa o recebimento. Só vale para nota que a conferência (refeita aqui) diz que não confere. */
export function recusarRecebimentoDaConferencia(
  db: Db,
  dados: { agendamentoId: number; chave: string; nf?: NfeLida | null; placa?: string | null; descricao: string },
  autor: string,
  agoraISO: string,
): { id: number } {
  if (digitosDe(dados.chave).length !== 44) {
    throw new ErroDeRegra("Confira a nota antes de recusar o recebimento: falta a chave de 44 números.", { status: 400, campos: { chave: "Confira a nota primeiro." } });
  }
  exigirPedidoAprovado(db, dados.agendamentoId);
  const r = conferirNota(db, { nf: dados.nf, chave: dados.chave, placa: dados.placa, agendamentoId: dados.agendamentoId }, agoraISO);
  if (r.veredito !== "divergente") {
    throw new ErroDeRegra("A nota confere com o agendamento: não há divergência para recusar. Registre a chegada.", { status: 409 });
  }
  return registrarNaoRecebimento(db, { agendamentoId: dados.agendamentoId, motivo: "divergencia_nota_pedido", descricao: dados.descricao }, autor, agoraISO);
}
