import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import type { AgendamentoStatus } from "@/lib/db/enums";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { relatorioChegadas } from "./chegadas";

let t: TestDb;
afterEach(() => t?.apagar());
const HOJE = "2026-10-07"; // quarta; semana de 05/10 a 11/10

function base() {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ razaoSocial: "F", origem: "teste" }).returning().get();
  const adubo = t.db.select().from(schema.armazem).all().find((a) => a.nome === "Adubo")!;
  const insumos = t.db.select().from(schema.armazem).all().find((a) => a.nome === "Insumos")!;
  const novo = (data: string, horario: string, status: AgendamentoStatus, chegada: string | null, armazem = adubo.id, extra: Partial<typeof schema.agendamento.$inferInsert> = {}) => {
    const a = t.db.insert(schema.agendamento).values({ fornecedorId: f.id, data, horario, acondicionamentoOcupacao: "unitizado", status, chegadaEm: chegada, origem: "teste", criadoEm: `${data}T06:00:00-03:00`, ...extra }).returning().get();
    t.db.insert(schema.agendamentoArmazem).values({ agendamentoId: a.id, armazemId: armazem, ordem: 1 }).run();
    return a;
  };
  return { adubo, insumos, novo };
}
type Blocos = ReturnType<typeof relatorioChegadas>["dia"];
const bloco = (r: Blocos, nome: string) => r.find((b) => b.armazem === nome)!;

describe("relatório de chegadas", () => {
  it("30 min de atraso é no horário, 31 é atrasado; sem agendamento à parte", () => {
    const { novo } = base();
    novo(HOJE, "08:00", "concluido", `${HOJE}T08:30:00-03:00`);
    novo(HOJE, "08:00", "concluido", `${HOJE}T08:31:00-03:00`);
    novo(HOJE, "10:00", "concluido", `${HOJE}T09:50:00-03:00`);
    novo(HOJE, "13:00", "concluido", `${HOJE}T13:05:00-03:00`, undefined, { agendadoNaHora: true });
    const r = relatorioChegadas(t.db, HOJE, `${HOJE}T18:00:00-03:00`);
    expect(bloco(r.dia, "Adubo")).toMatchObject({ noHorario: 2, atrasado: 1, naoVeio: 0, semAgendamento: 1, contados: 3, pontualidadePct: "67" });
    expect(bloco(r.dia, "Todos os armazéns")).toMatchObject({ noHorario: 2, atrasado: 1, semAgendamento: 1 });
  });

  it("agendado sem chegada: dentro da tolerância não conta; vencido hoje é atrasado; dia passado é não veio", () => {
    const { novo } = base();
    novo(HOJE, "15:00", "agendado", null);
    novo(HOJE, "08:00", "agendado", null);
    novo("2026-10-06", "10:00", "agendado", null);
    const r = relatorioChegadas(t.db, HOJE, `${HOJE}T10:00:00-03:00`);
    expect(bloco(r.dia, "Adubo")).toMatchObject({ noHorario: 0, atrasado: 1, naoVeio: 0, contados: 1 });
    expect(bloco(r.semana, "Adubo")).toMatchObject({ atrasado: 1, naoVeio: 1, contados: 2 });
  });

  it("semana de segunda a domingo, cancelado fora, origem por bloco", () => {
    const { novo, insumos } = base();
    novo("2026-10-04", "08:00", "concluido", "2026-10-04T08:00:00-03:00");
    novo("2026-10-05", "08:00", "concluido", "2026-10-05T08:00:00-03:00");
    novo("2026-10-06", "08:00", "cancelado", null);
    novo(HOJE, "08:00", "concluido", `${HOJE}T08:00:00-03:00`, insumos.id, { origem: "operacao" });
    const r = relatorioChegadas(t.db, HOJE, `${HOJE}T18:00:00-03:00`);
    expect(r.semanaInicio).toBe("2026-10-05");
    expect(r.semanaFim).toBe("2026-10-11");
    expect(bloco(r.semana, "Adubo")).toMatchObject({ noHorario: 1, contados: 1, origens: { teste: 1 } });
    expect(bloco(r.semana, "Insumos").origens).toEqual({ operacao: 1 });
    expect(bloco(r.semana, "Todos os armazéns").origens).toEqual({ teste: 1, operacao: 1 });
  });

  it("chegada vem do evento chegou quando chegada_em está vazio; sem dados, pontualidade nula", () => {
    const { novo } = base();
    const a = novo(HOJE, "08:00", "concluido", null);
    t.db.insert(schema.evento).values({ agendamentoId: a.id, tipo: "chegou", criadoEm: `${HOJE}T08:10:00-03:00` }).run();
    const r = relatorioChegadas(t.db, HOJE, `${HOJE}T18:00:00-03:00`);
    expect(bloco(r.dia, "Adubo").noHorario).toBe(1);
    expect(bloco(r.dia, "Insumos").pontualidadePct).toBeNull();
  });
});
