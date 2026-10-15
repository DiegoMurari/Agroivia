import { and, eq, gte, inArray, ne } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { EventoTipo } from "@/lib/db/enums";

import { dataDoInstante } from "./datas";
import type { ContextoOcupacao } from "./ocupacao";

/** Pedidos que ocupam vaga (D49): rascunho e recusado não ocupam. */
export const APROVACAO_OCUPA: ("aguardando" | "aprovado")[] = ["aguardando", "aprovado"];

/** Conexão ou transação do Drizzle: o que as funções internas aceitam. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOuTx = Db | Tx;

export function lerParametro(db: DbOuTx, chave: string, padrao: string): string {
  const linha = db.select().from(schema.parametro).where(eq(schema.parametro.chave, chave)).get();
  return linha?.valor ?? padrao;
}

/** Contexto da regra de ocupação (C1) lido do banco: agendamentos não cancelados de hoje em diante, grade, feriados. */
export function carregarContexto(db: DbOuTx, agoraISO: string): ContextoOcupacao {
  const hoje = dataDoInstante(agoraISO);
  const agendamentos = db
    .select({
      id: schema.agendamento.id,
      data: schema.agendamento.data,
      horario: schema.agendamento.horario,
      acondicionamento: schema.agendamento.acondicionamentoOcupacao,
      status: schema.agendamento.status,
      excecaoOcupacao: schema.agendamento.excecaoOcupacao,
      excecaoMotivo: schema.agendamento.excecaoMotivo,
    })
    .from(schema.agendamento)
    // rascunho e recusado não ocupam vaga; aguardando e aprovado ocupam (D49)
    .where(and(gte(schema.agendamento.data, hoje), ne(schema.agendamento.status, "cancelado"), inArray(schema.agendamento.aprovacao, APROVACAO_OCUPA)))
    .all();
  const grade = db
    .select({ hora: schema.horarioGrade.hora, ordem: schema.horarioGrade.ordem })
    .from(schema.horarioGrade)
    .where(eq(schema.horarioGrade.ativo, true))
    .all()
    .sort((a, b) => a.ordem - b.ordem || a.hora.localeCompare(b.hora))
    .map((g) => g.hora);
  const feriados = db.select({ data: schema.feriado.data }).from(schema.feriado).all().map((f) => f.data);
  const bruto = Number(lerParametro(db, "capacidade_unitizado", "2"));
  const limiteUnitizados = Number.isInteger(bruto) && bruto > 0 ? bruto : 2;
  return { agendamentos, grade, feriados, limiteUnitizados, agora: agoraISO };
}

/** Toda mudança de estado grava um evento; `detalhe` em JSON com o de e o para. */
export function registrarEvento(
  db: DbOuTx,
  agendamentoId: number,
  tipo: EventoTipo,
  autor: string,
  agoraISO: string,
  detalhe?: Record<string, unknown>,
): void {
  db.insert(schema.evento)
    .values({
      agendamentoId,
      tipo,
      detalhe: detalhe ? JSON.stringify(detalhe) : null,
      autor,
      criadoEm: agoraISO,
    })
    .run();
}
