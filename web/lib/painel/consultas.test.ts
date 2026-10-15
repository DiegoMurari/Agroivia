import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { formatNumero, igual } from "@/lib/money";
import { dataValida, filtroDaUrl, demandaPorArmazem, resumoBoletins, resumoCooperativaBoletins, resumoHistorico, serieHistorica } from "./consultas";

let t: TestDb;
afterEach(() => t?.apagar());

// Conjunto sintético pequeno. Folha: out/2025 (safra) e jun/2025 (entressafra) com 12 dias úteis cada;
// dezembro marcado sem dado. Uma carga por dia, em Adubo (boletim) e Loja (sem boletim).
function montar() {
  t = createTestDb({ seed: true });
  const db = t.db;
  const ids = Object.fromEntries(db.select().from(schema.armazem).all().map((a) => [a.nome, a.id]));
  const uteis = (anoMes: string, n: number) => {
    const dias: string[] = [];
    for (let d = 1; dias.length < n; d++) {
      const data = `${anoMes}-${String(d).padStart(2, "0")}`;
      const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
      if (dow !== 0 && dow !== 6) dias.push(data);
    }
    return dias;
  };
  const folha: { data: string; presentes: number; cafe: number }[] = [];
  let carga = 0;
  const cargas: { id: number; data: string }[] = [];
  const ligacoes: { histCargaId: number; armazemId: number; itensQtd: number; producaoEstimada: string }[] = [];
  // safra: efetivo 10, produção do Adubo de 12 diárias (falta de 2); Loja grande, fora da comparação
  for (const data of uteis("2025-10", 12)) {
    folha.push({ data, presentes: 10, cafe: 0 });
    cargas.push({ id: ++carga, data });
    ligacoes.push({ histCargaId: carga, armazemId: ids["Adubo"], itensQtd: 1, producaoEstimada: "1082.0772" }); // 12 x 90,1731
    ligacoes.push({ histCargaId: carga, armazemId: ids["Loja"], itensQtd: 1, producaoEstimada: "5000" });
  }
  // entressafra: efetivo 8, produção do Adubo de 4 diárias (excesso de 4)
  for (const data of uteis("2025-06", 12)) {
    folha.push({ data, presentes: 9, cafe: 1 });
    cargas.push({ id: ++carga, data });
    ligacoes.push({ histCargaId: carga, armazemId: ids["Adubo"], itensQtd: 1, producaoEstimada: "360.6924" }); // 4 x 90,1731
  }
  // um sábado com folha: fica fora da comparação
  folha.push({ data: "2025-06-07", presentes: 15, cafe: 0 });
  // dezembro: sem dado (marcado), com uma linha solta de folha que não pode entrar na média
  folha.push({ data: "2025-12-01", presentes: 3, cafe: 0 });

  db.insert(schema.histChapasDia).values(folha.map((f) => ({ ...f, qualidade: "", considerada: true }))).run();
  db.insert(schema.histCarga).values(cargas.map((c) => ({ id: c.id, codPn: "FD1", data: c.data, notasQtd: 1, itensQtd: 2 }))).run();
  db.insert(schema.histCargaArmazem).values(ligacoes).run();
  db.insert(schema.histPeriodoSemDado).values({ anoMes: "2025-12", tipo: "sem_dado", motivo: "teste" }).run();
  return { db, ids };
}

describe("resumoHistorico", () => {
  it("safra e entressafra dão números diferentes, cada um com a origem historico", () => {
    const { db } = montar();
    const safra = resumoHistorico(db, { tipo: "safra" });
    const entre = resumoHistorico(db, { tipo: "entressafra" });
    expect(safra.origem).toBe("historico");
    expect(safra.resumo!.diasConsiderados).toBe(12);
    // safra: efetivo 10, justificadas 12 (só o Adubo conta; a Loja não faz boletim): falta de 2 chapas por dia
    expect(safra.resumo!.diasFalta).toBe(12);
    expect(igual(safra.resumo!.faltaMediaChapas, "2")).toBe(true);
    expect(igual(safra.resumo!.faltaReaisMedia, "180.3462")).toBe(true);
    // entressafra: efetivo 8, justificadas 4: excesso de 4 por dia, R$ 360,6924
    expect(entre.resumo!.diasExcesso).toBe(12);
    expect(igual(entre.resumo!.excessoMedioChapas, "4")).toBe(true);
    expect(igual(entre.resumo!.excessoReaisMedio, "360.6924")).toBe(true);
  });

  it("dezembro sem dado aparece como lacuna e a linha solta fica fora; nunca vira zero", () => {
    const { db } = montar();
    const dez = resumoHistorico(db, { tipo: "mes", anoMes: "2025-12" });
    expect(dez.resumo).toBeNull();
    expect(dez.meses).toEqual([{ anoMes: "2025-12", status: "sem_dado", resumo: null }]);
    const safra = resumoHistorico(db, { tipo: "safra" });
    expect(safra.meses.find((m) => m.anoMes === "2025-12")!.status).toBe("sem_dado");
    // dezembro (marcado) e novembro (sem nenhuma linha, mesmo sem marca) ficam fora das médias
    expect(safra.meses.find((m) => m.anoMes === "2025-11")!.status).toBe("sem_dado");
    expect(safra.mesesForaDasMedias).toBe(2);
  });

  it("sábado de folha fica fora da comparação e é contado", () => {
    const { db } = montar();
    const serie = serieHistorica(db);
    expect(serie.fimDeSemanaFora).toBe(1);
    expect(serie.dias.some((d) => d.data === "2025-06-07")).toBe(false);
  });

  it("semana: considera só os dias da semana de 7 dias", () => {
    const { db } = montar();
    const sem = resumoHistorico(db, { tipo: "semana", inicio: "2025-10-06" });
    expect(sem.resumo!.diasConsiderados).toBe(5);
  });

  it("a escolha de armazéns é explícita: com a Loja incluída a produção do dia muda", () => {
    const { db } = montar();
    const so = serieHistorica(db).dias.find((d) => d.data === "2025-10-01")!;
    const todos = serieHistorica(db, { somenteComBoletim: false }).dias.find((d) => d.data === "2025-10-01")!;
    expect(igual(so.producao!, "1082.0772")).toBe(true);
    expect(igual(todos.producao!, "6082.0772")).toBe(true);
  });
});

describe("demandaPorArmazem", () => {
  it("mostra a demanda de todos os armazéns e rateia o efetivo só entre os que fazem boletim, como premissa", () => {
    const { db } = montar();
    const d = demandaPorArmazem(db, { tipo: "safra" })!;
    expect(d.premissa).toMatch(/premissa/i);
    const adubo = d.armazens.find((a) => a.nome === "Adubo")!;
    const loja = d.armazens.find((a) => a.nome === "Loja")!;
    expect(igual(adubo.diariasPorDia, "12")).toBe(true);
    expect(igual(adubo.participacao!, "1")).toBe(true);
    expect(igual(adubo.efetivoRateado!, "10")).toBe(true);
    expect(loja.fazBoletim).toBe(false);
    expect(loja.efetivoRateado).toBeNull();
  });

  it("período sem dado devolve null", () => {
    const { db } = montar();
    expect(demandaPorArmazem(db, { tipo: "mes", anoMes: "2025-12" })).toBeNull();
  });
});

describe("resumoBoletins: medido por armazém, origem em cada linha (P5, P6)", () => {
  it("o armazém muda os números e as origens nunca se misturam", () => {
    const { db, ids } = montar();
    const base = { status: "fechado" as const, valorPorDiaria: "0", totalAPagar: "0", complemento: "0", pisoUsado: "90.1731", fatorMeiaUsado: "0.5", criadoEm: "2026-10-01T08:00:00-03:00" };
    db.insert(schema.boletim)
      .values([
        { ...base, armazemId: ids["Adubo"], data: "2026-10-05", producaoTotal: "918.1952", diariasEquivalentes: "11", origem: "teste" },
        { ...base, armazemId: ids["Insumos"], data: "2026-10-05", producaoTotal: "901.731", diariasEquivalentes: "8", origem: "teste" },
        { ...base, armazemId: ids["Adubo"], data: "2026-10-06", producaoTotal: "918.1952", diariasEquivalentes: "11", origem: "operacao" },
      ])
      .run();
    const r = resumoBoletins(db, { tipo: "safra" });
    const adubo = r.filter((x) => x.nome === "Adubo");
    expect(adubo.map((x) => x.origem).sort()).toEqual(["operacao", "teste"]);
    const aduboTeste = adubo.find((x) => x.origem === "teste")!;
    expect(formatNumero(aduboTeste.resumo.excessoMedioChapas)).toBe("0,82");
    expect(igual(aduboTeste.resumo.excessoReaisMedio, "73.7089")).toBe(true);
    const insumos = r.find((x) => x.nome === "Insumos")!;
    expect(insumos.resumo.diasFalta).toBe(1);
    expect(igual(insumos.resumo.faltaMediaChapas, "2")).toBe(true);
  });
});

describe("D47: boletim em Todas as áreas é a cooperativa inteira e não vira linha de armazém", () => {
  const base = { status: "fechado" as const, valorPorDiaria: "0", totalAPagar: "0", complemento: "0", pisoUsado: "90.1731", fatorMeiaUsado: "0.5", criadoEm: "2026-10-01T08:00:00-03:00" };

  it("não aparece na tabela por armazém", () => {
    const { db, ids } = montar();
    const todas = db.select().from(schema.armazem).all().find((a) => a.nome === "Todas as áreas")!;
    db.insert(schema.boletim).values({ ...base, armazemId: todas.id, data: "2026-10-05", producaoTotal: "901.731", diariasEquivalentes: "10", origem: "teste" }).run();
    db.insert(schema.boletim).values({ ...base, armazemId: ids["Adubo"], data: "2026-10-06", producaoTotal: "918.1952", diariasEquivalentes: "11", origem: "teste" }).run();
    const r = resumoBoletins(db, { tipo: "safra" });
    expect(r.map((x) => x.nome)).toEqual(["Adubo"]);
  });

  it("conta na cooperativa: o boletim único entra sozinho e os boletins por armazém do mesmo dia somam", () => {
    const { db, ids } = montar();
    const todas = db.select().from(schema.armazem).all().find((a) => a.nome === "Todas as áreas")!;
    db.insert(schema.boletim)
      .values([
        // dia 05: boletim único, 10 diárias contra 10 justificadas: equilíbrio
        { ...base, armazemId: todas.id, data: "2026-10-05", producaoTotal: "901.731", diariasEquivalentes: "10", origem: "teste" },
        // dia 06: dois armazéns somam 19 diárias contra 1819,9262 / 90,1731 justificadas: falta
        { ...base, armazemId: ids["Adubo"], data: "2026-10-06", producaoTotal: "918.1952", diariasEquivalentes: "11", origem: "teste" },
        { ...base, armazemId: ids["Insumos"], data: "2026-10-06", producaoTotal: "901.731", diariasEquivalentes: "8", origem: "teste" },
      ])
      .run();
    const r = resumoCooperativaBoletins(db, { tipo: "safra" });
    expect(r).toHaveLength(1);
    expect(r[0].origem).toBe("teste");
    expect(r[0].resumo.diasConsiderados).toBe(2);
    expect(r[0].resumo.diasEquilibrio).toBe(1);
    expect(r[0].resumo.diasFalta).toBe(1);
    expect(igual(r[0].resumo.efetivoMedio, "14.5")).toBe(true); // (10 + 19) / 2
  });

  it("sem boletim fechado a cooperativa devolve lista vazia, nunca zero", () => {
    const { db } = montar();
    expect(resumoCooperativaBoletins(db, { tipo: "safra" })).toEqual([]);
  });
});

describe("dataValida", () => {
  it("recusa mês ou dia impossível sem lançar", () => {
    expect(dataValida("2025-13-45")).toBe(false);
    expect(dataValida("2025-02-30")).toBe(false);
    expect(dataValida("lixo")).toBe(false);
    expect(dataValida("2024-02-29")).toBe(true);
    expect(filtroDaUrl(undefined, "2025-13-45")).toEqual({ tipo: "safra" });
  });
});

describe("semana que cruza meses (achado 7 da A6)", () => {
  it("o mês em que a semana só tem sábado e domingo não aparece como lacuna", () => {
    const { db } = montar();
    // segunda 27/10/2025 a sexta 31/10 em outubro; o sábado 01/11 já é novembro (mês sem folha, que viraria lacuna)
    const w = resumoHistorico(db, { tipo: "semana", inicio: "2025-10-27" });
    expect(w.meses.map((m) => m.anoMes)).toEqual(["2025-10"]);
  });

  it("a semana que tem dias úteis nos dois meses mostra os dois", () => {
    const { db } = montar();
    // segunda 29/09 a sexta 03/10
    const w = resumoHistorico(db, { tipo: "semana", inicio: "2025-09-29" });
    expect(w.meses.map((m) => m.anoMes)).toEqual(["2025-09", "2025-10"]);
  });
});
