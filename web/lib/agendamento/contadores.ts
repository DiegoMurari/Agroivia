import { and, eq, gte } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";

import { somarDias } from "./datas";
import { listarVagasAbertas } from "./desvios";

/** Números dos quatro cartões da tela /agendamento. Só leitura. */
export interface ContadoresAgendamento {
  /** Cargas que chegaram sem agendamento e entraram numa vaga do dia, hoje. */
  semAgendamento: number;
  vagasLiberadas: number;
  pendenciasAbertas: number;
  /** Não recebimentos dos últimos 7 dias. */
  naoRecebimentos: number;
}

export function contadoresAgendamento(db: Db, agoraISO: string): ContadoresAgendamento {
  const hoje = agoraISO.slice(0, 10);
  return {
    semAgendamento: db
      .select({ id: schema.agendamento.id })
      .from(schema.agendamento)
      .where(and(eq(schema.agendamento.data, hoje), eq(schema.agendamento.agendadoNaHora, true)))
      .all().length,
    vagasLiberadas: listarVagasAbertas(db, agoraISO).length,
    pendenciasAbertas: db.select({ id: schema.pendencia.id }).from(schema.pendencia).where(eq(schema.pendencia.status, "aberta")).all().length,
    naoRecebimentos: db
      .select({ id: schema.naoRecebimento.id })
      .from(schema.naoRecebimento)
      .where(gte(schema.naoRecebimento.registradoEm, `${somarDias(hoje, -6)}T00:00:00`))
      .all().length,
  };
}
