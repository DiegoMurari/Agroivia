import { describe, expect, it } from "vitest";

import { minutosDeAtraso, normalizarPlaca } from "./historico";

describe("histórico por placa", () => {
  it("normaliza a placa", () => {
    expect(normalizarPlaca(" abc-1d23 ")).toBe("ABC1D23");
    expect(normalizarPlaca("ab")).toBeNull();
  });

  it("minutos de atraso na chegada: 0 se dentro da tolerância, senão os minutos passados do horário", () => {
    expect(minutosDeAtraso("2026-10-05", "08:00", "2026-10-05T08:30:00-03:00", 30)).toBe(0);
    expect(minutosDeAtraso("2026-10-05", "08:00", "2026-10-05T08:31:00-03:00", 30)).toBe(31);
    expect(minutosDeAtraso("2026-10-05", "08:00", "2026-10-05T07:50:00-03:00", 30)).toBe(0);
    expect(minutosDeAtraso("2026-10-05", "08:00", null, 30)).toBeNull();
  });
});

import { eq } from "drizzle-orm";
import { afterEach } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";

import { historicoDaPlaca } from "./historico";

let t: TestDb;
afterEach(() => t?.apagar());

describe("histórico da placa no banco", () => {
  it("lista as últimas cargas com atraso e não recebimento", () => {
    t = createTestDb({ seed: true });
    const f = t.db.insert(schema.fornecedor).values({ codigo: "F", razaoSocial: "FORN", cnpj: "1", origem: "teste" }).returning({ id: schema.fornecedor.id }).get();
    const novo = (data: string, horario: string, chegadaEm: string | null, status: "concluido" | "nao_recebido", placa = "ABC1D23") =>
      t.db.insert(schema.agendamento).values({ fornecedorId: f.id, data, horario, placa, acondicionamentoOcupacao: "unitizado", status, chegadaEm, origem: "teste", criadoEm: "2026-09-01T08:00:00-03:00" }).returning({ id: schema.agendamento.id }).get();
    novo("2026-09-14", "08:00", "2026-09-14T08:10:00-03:00", "concluido");
    novo("2026-09-15", "10:00", "2026-09-15T11:00:00-03:00", "concluido");
    const c = novo("2026-09-16", "13:00", null, "nao_recebido");
    novo("2026-09-16", "13:00", null, "concluido", "OUTRA99");
    t.db.insert(schema.naoRecebimento).values({ agendamentoId: c.id, fornecedorId: f.id, motivo: "caso_fortuito", registradoEm: "2026-09-16T14:00:00-03:00", origem: "teste" }).run();

    const h = historicoDaPlaca(t.db, "abc-1d23");
    expect(h.map((x) => x.data)).toEqual(["2026-09-16", "2026-09-15", "2026-09-14"]);
    expect(h[0]).toMatchObject({ naoRecebimento: "caso_fortuito", atrasoMin: null });
    expect(h[1].atrasoMin).toBe(60);
    expect(h[2].atrasoMin).toBe(0);
    expect(historicoDaPlaca(t.db, "x")).toEqual([]);
    expect(t.db.select().from(schema.agendamento).where(eq(schema.agendamento.placa, "OUTRA99")).all()).toHaveLength(1);
  });
});
