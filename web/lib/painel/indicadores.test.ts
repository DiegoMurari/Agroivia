import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { dividir, igual } from "@/lib/money";
import { cargasPorDia, custoDoPeriodo, diasDeMaiorMovimento, fornecedoresPorPeso } from "./indicadores";

let t: TestDb;
afterEach(() => t?.apagar());

// Fixture sintética: 2 dias de recebimento em out/2025 (safra) e 1 em jun/2025 (entressafra).
// 02/10: 3 cargas (2 só Adubo, 1 em Adubo e Insumos). 03/10: 1 carga em Insumos. 04/06: 1 carga na Loja.
function montar() {
  t = createTestDb({ seed: true });
  const db = t.db;
  const ids = Object.fromEntries(db.select().from(schema.armazem).all().map((a) => [a.nome, a.id]));
  const cargas = [
    { id: 1, data: "2025-10-02" },
    { id: 2, data: "2025-10-02" },
    { id: 3, data: "2025-10-02" },
    { id: 4, data: "2025-10-03" },
    { id: 5, data: "2025-06-04" },
  ];
  db.insert(schema.histCarga).values(cargas.map((c) => ({ ...c, codPn: `F${c.id}`, notasQtd: 1, itensQtd: 1 }))).run();
  const lig = (histCargaId: number, armazem: string, producaoEstimada: string) => ({ histCargaId, armazemId: ids[armazem], itensQtd: 1, producaoEstimada });
  db.insert(schema.histCargaArmazem)
    .values([
      lig(1, "Adubo", "100"),
      lig(2, "Adubo", "100"),
      lig(3, "Adubo", "100"),
      lig(3, "Insumos", "50"),
      lig(4, "Insumos", "50"),
      lig(5, "Loja", "10"),
    ])
    .run();
  // folha: efetivo 2 nos dois dias de outubro (piso x efetivo = 180,3462)
  db.insert(schema.histChapasDia)
    .values([
      { data: "2025-10-02", presentes: 2, cafe: 0, qualidade: "", considerada: true },
      { data: "2025-10-03", presentes: 2, cafe: 0, qualidade: "", considerada: true },
    ])
    .run();
  return { db, ids };
}

describe("cargasPorDia (RF3-01)", () => {
  it("conta caminhões por dia; carga em dois armazéns conta uma vez no total e uma em cada armazém", () => {
    const { db, ids } = montar();
    const r = cargasPorDia(db, { tipo: "safra" })!;
    expect(r.origem).toBe("historico");
    expect(r.diasComRecebimento).toBe(2);
    expect(r.totalCargas).toBe(4);
    expect(igual(r.mediaPorDia, "2")).toBe(true);
    expect(r.maximoPorDia).toBe(3);
    const dia2 = r.dias.find((d) => d.data === "2025-10-02")!;
    expect(dia2.total).toBe(3);
    expect(dia2.porArmazem.find((a) => a.armazemId === ids["Adubo"])!.cargas).toBe(3);
    expect(dia2.porArmazem.find((a) => a.armazemId === ids["Insumos"])!.cargas).toBe(1);
    const adubo = r.porArmazem.find((a) => a.armazemId === ids["Adubo"])!;
    expect(adubo.cargas).toBe(3);
    expect(igual(adubo.mediaPorDia, "1.5")).toBe(true);
  });

  it("período sem recebimento devolve null, nunca zero", () => {
    const { db } = montar();
    expect(cargasPorDia(db, { tipo: "mes", anoMes: "2024-01" })).toBeNull();
  });

  it("a entressafra só enxerga a carga de junho", () => {
    const { db } = montar();
    const r = cargasPorDia(db, { tipo: "entressafra" })!;
    expect(r.totalCargas).toBe(1);
    expect(r.diasComRecebimento).toBe(1);
  });
});

describe("custoDoPeriodo (RF3-09)", () => {
  it("custo do dia = maior entre piso x efetivo e produção, somado e em média por dia", () => {
    const { db } = montar();
    const r = custoDoPeriodo(db, { tipo: "safra" })!;
    expect(r.origem).toBe("historico");
    expect(r.diasConsiderados).toBe(2);
    // 02/10: produção dos armazéns com boletim = 300 + 50 = 350 > piso x 2 = 180,3462: custo 350
    // 03/10: produção 50 < 180,3462: custo 180,3462
    expect(igual(r.custoTotal, "530.3462")).toBe(true);
    expect(igual(r.custoMedioPorDia, "265.1731")).toBe(true);
    expect(igual(r.complementoTotal, "130.3462")).toBe(true); // só 03/10: 180,3462 - 50
  });

  it("sem dia comparável devolve null", () => {
    const { db } = montar();
    expect(custoDoPeriodo(db, { tipo: "entressafra" })).toBeNull();
  });
});

describe("fornecedoresPorPeso (RF3-06) e diasDeMaiorMovimento (RF3-07)", () => {
  function comMovimentacao() {
    const m = montar();
    const base = { qtd: "1", unidade: "TON", qualidade: "" };
    let linha = 0;
    const l = (codPn: string, nomePn: string, data: string, pesoKg: string | null, considerada = true) => ({
      ...base, linhaPlanilha: ++linha, codPn, nomePn, dataRecebimento: data, pesoKg, considerada,
    });
    m.db.insert(schema.histMovimentacao).values([
      l("A", "Alfa", "2025-10-02", "1000"),
      l("A", "Alfa", "2025-10-03", "2500.5"),
      l("B", "Beta", "2025-10-02", "3000"),
      l("B", "Beta", "2025-10-02", null), // sem peso utilizável: contada à parte
      l("C", "Gama", "2025-10-02", "99999", false), // não considerada: fora
      l("D", "Delta", "2025-06-04", "10"), // entressafra
    ]).run();
    return m;
  }

  it("soma o peso por fornecedor em kg exatos, ordena e informa a participação e as linhas sem peso", () => {
    const { db } = comMovimentacao();
    const r = fornecedoresPorPeso(db, { tipo: "safra" })!;
    expect(r.origem).toBe("historico");
    expect(r.fornecedores.map((f) => f.codPn)).toEqual(["A", "B"]);
    expect(igual(r.fornecedores[0].pesoKg, "3500.5")).toBe(true);
    expect(igual(r.pesoTotalKg, "6500.5")).toBe(true);
    expect(igual(r.fornecedores[1].participacao, dividir("3000", "6500.5"))).toBe(true);
    expect(r.linhasSemPeso).toBe(1);
  });

  it("respeita o limite e devolve null sem peso no período", () => {
    const { db } = comMovimentacao();
    expect(fornecedoresPorPeso(db, { tipo: "safra" }, 1)!.fornecedores).toHaveLength(1);
    expect(fornecedoresPorPeso(db, { tipo: "mes", anoMes: "2024-01" })).toBeNull();
  });

  it("dias de maior movimento: mais cargas primeiro, e os horários são declarados sem dado", () => {
    const { db } = montar();
    const r = diasDeMaiorMovimento(db, { tipo: "tudo" }, 2)!;
    expect(r.dias).toEqual([
      { data: "2025-10-02", cargas: 3, diaDaSemana: 4 },
      { data: "2025-06-04", cargas: 1, diaDaSemana: 3 },
    ]);
    expect(r.horarios).toBe("sem_dado_no_historico");
  });
});
