import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { schema } from "@/lib/db";

import { lerParametro, type DbOuTx } from "./comum";
import { instanteMarcado, minutosEntre } from "./datas";

/** Histórico do motorista por placa (grupo 4). Só leitura. */

/** `ABC-1d23` → `ABC1D23`; menos de 5 caracteres não é placa. */
export function normalizarPlaca(texto: string | null | undefined): string | null {
  const p = (texto ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p.length >= 5 ? p : null;
}

/** Minutos de atraso na chegada: 0 dentro da tolerância ou adiantado; nulo se não chegou. */
export function minutosDeAtraso(data: string, horario: string, chegadaEm: string | null, toleranciaMin: number): number | null {
  if (!chegadaEm) return null;
  const minutos = minutosEntre(instanteMarcado(data, horario), chegadaEm);
  return minutos > toleranciaMin ? minutos : 0;
}

export interface CargaDaPlaca {
  agendamentoId: number;
  data: string;
  horario: string;
  fornecedor: string;
  status: string;
  /** Minutos de atraso na chegada; 0 = no horário; nulo = não chegou. */
  atrasoMin: number | null;
  naoRecebimento: string | null;
}

/** `excluirId`: agendamento em curso (não entra no próprio histórico). Só cargas que chegaram ou terminaram. */
export function historicoDaPlaca(db: DbOuTx, placaBruta: string, limite = 5, excluirId?: number): CargaDaPlaca[] {
  const placa = normalizarPlaca(placaBruta);
  if (!placa) return [];
  const tolerancia = Number(lerParametro(db, "tolerancia_min", "30"));
  const linhas = db
    .select({
      id: schema.agendamento.id,
      data: schema.agendamento.data,
      horario: schema.agendamento.horario,
      status: schema.agendamento.status,
      chegadaEm: schema.agendamento.chegadaEm,
      fornecedor: schema.fornecedor.razaoSocial,
    })
    .from(schema.agendamento)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(
      and(
        // a placa é gravada como veio (com hífen ou não): compara sem hífen nem espaço
        sql`replace(replace(upper(${schema.agendamento.placa}), '-', ''), ' ', '') = ${placa}`,
        inArray(schema.agendamento.status, ["chegou", "em_descarga", "concluido", "nao_recebido"]),
        excluirId === undefined ? undefined : ne(schema.agendamento.id, excluirId),
      ),
    )
    .orderBy(desc(schema.agendamento.data), desc(schema.agendamento.horario), desc(schema.agendamento.id))
    .limit(limite)
    .all();
  return linhas.map((l) => {
    const nr = db
      .select({ motivo: schema.naoRecebimento.motivo })
      .from(schema.naoRecebimento)
      .where(eq(schema.naoRecebimento.agendamentoId, l.id))
      .get();
    return {
      agendamentoId: l.id,
      data: l.data,
      horario: l.horario,
      fornecedor: l.fornecedor,
      status: l.status,
      atrasoMin: minutosDeAtraso(l.data, l.horario, l.chegadaEm, Number.isFinite(tolerancia) ? tolerancia : 30),
      naoRecebimento: nr?.motivo ?? null,
    };
  });
}
