import { describe, expect, it } from "vitest";
import { agruparPorDia, gradeDoMes, mesAnterior, mesSeguinte, somarBoletins, totaisDoMes, type BoletimParaSoma } from "./dia";

const b = (id: number, data: string, producao: string, total: string, complemento: string, chapas: number): BoletimParaSoma => ({ id, data, producaoTotal: producao, totalAPagar: total, complemento, chapas });

describe("somar os boletins do dia", () => {
  it("soma produção, total a pagar, complemento e funcionários sem arredondar", () => {
    const r = somarBoletins([b(1, "2026-10-02", "100.005", "180.3462", "80.3412", 2), b(2, "2026-10-02", "300.1", "300.1", "0", 3)]);
    expect(r).toEqual({ boletins: 2, producao: "400.105", totalAPagar: "480.4462", complemento: "80.3412", chapas: 5, abaixoDoPiso: true });
  });

  it("dia com um armazém só devolve os mesmos valores", () => {
    const r = somarBoletins([b(1, "2026-10-02", "500", "500", "0", 4)]);
    expect(r).toMatchObject({ boletins: 1, producao: "500", totalAPagar: "500", complemento: "0", chapas: 4, abaixoDoPiso: false });
  });

  it("complemento menor que R$ 1,00 não conta como abaixo do piso", () => {
    expect(somarBoletins([b(1, "2026-10-02", "100", "100.5", "0.5", 1)]).abaixoDoPiso).toBe(false);
    expect(somarBoletins([b(1, "2026-10-02", "100", "101", "1", 1)]).abaixoDoPiso).toBe(true);
  });

  it("dia sem boletim: tudo zero", () => {
    expect(somarBoletins([])).toEqual({ boletins: 0, producao: "0", totalAPagar: "0", complemento: "0", chapas: 0, abaixoDoPiso: false });
  });

  it("o mesmo boletim nunca entra duas vezes (boletim único de Todas as áreas)", () => {
    const unico = b(7, "2026-10-02", "900", "900", "0", 6);
    expect(somarBoletins([unico, unico, b(8, "2026-10-02", "100", "100", "0", 1)])).toMatchObject({ boletins: 2, producao: "1000", chapas: 7 });
  });
});

describe("mês em calendário", () => {
  it("agrupa por dia e totaliza o mês", () => {
    const dias = agruparPorDia([b(1, "2026-10-01", "100", "190", "90", 2), b(2, "2026-10-01", "50", "50", "0", 1), b(3, "2026-10-02", "400", "400", "0", 3)]);
    expect(Object.keys(dias)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(dias["2026-10-01"]).toMatchObject({ totalAPagar: "240", complemento: "90", abaixoDoPiso: true });
    expect(totaisDoMes(dias)).toEqual({ totalAPagar: "640", complemento: "90", diasComComplemento: 1 });
  });

  it("grade de outubro de 2026: semanas de domingo a sábado, com dias de fora como nulo", () => {
    const g = gradeDoMes("2026-10");
    expect(g.every((s) => s.length === 7)).toBe(true);
    expect(g[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(g[g.length - 1].filter(Boolean).pop()).toBe("2026-10-31");
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });

  it("navega entre meses, inclusive na virada do ano", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesSeguinte("2026-10")).toBe("2026-11");
  });
});
