import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { dividir, igual } from "@/lib/money";
import { faixaDaNormaNoPeriodo } from "./faixa-norma";

let t: TestDb;
afterEach(() => t?.apagar());

describe("faixaDaNormaNoPeriodo (régua complementar)", () => {
  function montar() {
    t = createTestDb({ seed: true });
    // Dia 1: carga A batido 1000 kg (5 chapas) e carga B sem acondicionamento, 1000 kg (de 1 a 5). Dia 2: só B. Dia 3: carga leve de 300 kg.
    t.db.insert(schema.histCarga).values([
      { id: 1, codPn: "A", data: "2025-10-02", notasQtd: 1, itensQtd: 1, pesoTotalKg: "1000", acondicionamentoXml: "batido" },
      { id: 2, codPn: "B", data: "2025-10-02", notasQtd: 1, itensQtd: 1, pesoTotalKg: "1000", acondicionamentoXml: null },
      { id: 3, codPn: "B", data: "2025-10-03", notasQtd: 1, itensQtd: 1, pesoTotalKg: "1000", acondicionamentoXml: null },
      { id: 4, codPn: "C", data: "2025-10-06", notasQtd: 1, itensQtd: 1, pesoTotalKg: "300", acondicionamentoXml: null },
    ]).run();
    return t.db;
  }

  it("monta a faixa por dia e tira a média; acima de 500 kg vale a norma, abaixo não precisa de funcionário", () => {
    const r = faixaDaNormaNoPeriodo(montar(), { tipo: "safra" })!;
    expect(r.origem).toBe("historico");
    expect(r.diasComCarga).toBe(3);
    // mínimos 5, 1, 0 e máximos 5, 5, 0
    expect(igual(r.minimoMedioChapas, "2")).toBe(true);
    expect(igual(r.maximoMedioChapas, dividir("10", "3"))).toBe(true);
    expect(r.diaDePico).toEqual({ data: "2025-10-02", cargas: 2, minimoChapas: 5, maximoChapas: 5 });
    expect(r.cargasComAcondicionamento).toBe(1);
    expect(r.totalCargas).toBe(4);
  });

  it("período sem carga devolve null", () => {
    expect(faixaDaNormaNoPeriodo(montar(), { tipo: "mes", anoMes: "2024-01" })).toBeNull();
  });
});
