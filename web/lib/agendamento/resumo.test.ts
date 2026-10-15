import { describe, expect, it } from "vitest";

import { resumoNf, type NfParaResumo } from "./resumo";

const base: NfParaResumo = {
  numero: "9001",
  emitenteNome: "FORNECEDOR TESTE",
  pesoLiquidoKg: "20000",
  volumes: "20",
  especie: "PALETE",
  acondicionamento: "paletizado",
  itens: [{ descricao: "ADUBO NPK" }],
};

describe("resumo da NF", () => {
  it("uma linha com emitente, peso, volumes e espécie, acondicionamento e itens", () => {
    expect(resumoNf(base)).toBe("NF 9001 · FORNECEDOR TESTE · 20.000 kg · 20 PALETE · paletizado · ADUBO NPK");
  });

  it("peso com casas e big bag", () => {
    expect(resumoNf({ ...base, pesoLiquidoKg: "10000.5", acondicionamento: "big_bag" })).toContain("10.000,5 kg · 20 PALETE · big bag");
  });

  it("mostra os 2 primeiros itens e conta o resto", () => {
    const itens = ["A", "B", "C", "D"].map((descricao) => ({ descricao }));
    expect(resumoNf({ ...base, itens })).toMatch(/A, B e mais 2$/);
  });

  it("dados faltando não quebram", () => {
    const r = resumoNf({ numero: null, emitenteNome: null, pesoLiquidoKg: null, volumes: null, especie: null, acondicionamento: "batido", itens: [] });
    expect(r).toBe("NF sem número · emitente não informado · peso não informado · batido");
  });
});
