import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { igual } from "@/lib/money";
import { indicadoresOperacao } from "./operacao";

let t: TestDb;
afterEach(() => t?.apagar());

// Dois agendamentos de teste em 2025-10-02 (um cancelado), um de operação em 2025-10-03.
function montar() {
  t = createTestDb({ seed: true });
  const db = t.db;
  const adubo = db.select().from(schema.armazem).all().find((a) => a.nome === "Adubo")!.id;
  const forn = db.insert(schema.fornecedor).values({ codigo: "T1", razaoSocial: "Fornecedor de teste", origem: "teste" }).returning().get().id;
  const base = { fornecedorId: forn, acondicionamentoOcupacao: "batido" as const, criadoEm: "2025-10-01T10:00:00-03:00" };
  const a1 = db.insert(schema.agendamento).values({ ...base, data: "2025-10-02", horario: "08:00", origem: "teste", status: "concluido", chegadaEm: "2025-10-02T08:00:00-03:00" }).returning().get().id;
  db.insert(schema.agendamento).values({ ...base, data: "2025-10-02", horario: "10:00", origem: "teste", status: "cancelado" }).run();
  db.insert(schema.agendamento).values({ ...base, data: "2025-10-03", horario: "08:00", origem: "operacao", status: "concluido" }).run();
  db.insert(schema.agendamentoArmazem).values({
    agendamentoId: a1, armazemId: adubo, entradaEm: "2025-10-02T08:30:00-03:00", saidaEm: "2025-10-02T09:30:00-03:00", chapasQtd: 4,
  }).run();
  db.insert(schema.naoRecebimento).values([
    { motivo: "caso_fortuito", registradoEm: "2025-10-02T11:00:00-03:00", origem: "teste" },
    { motivo: "caso_fortuito", registradoEm: "2025-10-02T12:00:00-03:00", origem: "teste" },
    { motivo: "outro", descricao: "x", registradoEm: "2025-10-02T13:00:00-03:00", origem: "teste" },
  ]).run();
  return db;
}

describe("indicadoresOperacao", () => {
  it("teste e operação ficam em blocos separados, cada um com a sua origem", () => {
    const r = indicadoresOperacao(montar(), { tipo: "tudo" });
    expect(r.map((b) => b.origem)).toEqual(["teste", "operacao"]);
    expect(r[0].agendamentos).toBe(1); // o cancelado não conta
    expect(r[1].agendamentos).toBe(1);
  });

  it("espera, descarga e colaboradores saem dos registros; sem registro é null, nunca zero", () => {
    const [teste, operacao] = indicadoresOperacao(montar(), { tipo: "tudo" });
    expect(igual(teste.esperaMediaMin!, "30")).toBe(true);
    expect(igual(teste.descargaMediaMin!, "60")).toBe(true);
    expect(igual(teste.colaboradoresPorRecebimento!, "4")).toBe(true);
    expect(operacao.esperaMediaMin).toBeNull();
    expect(operacao.descargaMediaMin).toBeNull();
    expect(operacao.colaboradoresPorRecebimento).toBeNull();
  });

  it("utilização = horários ocupados sobre os oferecidos pela grade; não recebimentos por motivo", () => {
    const db = montar();
    const grade = db.select().from(schema.horarioGrade).all().filter((h) => h.ativo).length;
    const [teste] = indicadoresOperacao(db, { tipo: "tudo" });
    expect(teste.utilizacao).toMatchObject({ dias: 1, horariosOcupados: 1, horariosOferecidos: grade });
    expect(igual(teste.utilizacao.percentual!, String(100 / grade))).toBe(true);
    expect(teste.naoRecebimentos).toEqual({
      total: 3,
      porMotivo: [
        { motivo: "caso_fortuito", quantidade: 2 },
        { motivo: "outro", quantidade: 1 },
      ],
    });
  });

  it("período sem agendamento devolve lista vazia", () => {
    expect(indicadoresOperacao(montar(), { tipo: "mes", anoMes: "2024-01" })).toEqual([]);
  });
});
