import { describe, expect, it } from "vitest";

import { dec, igual } from "@/lib/money";
import { agruparFornecedores, nomeNormalizado } from "./agrupar-fornecedores";

describe("nomeNormalizado", () => {
  it("S/A, S.A e SA viram o mesmo nome, sem caixa nem pontuação", () => {
    const a = nomeNormalizado("Nutrimix Brasil Fertilizantes S/A");
    expect(nomeNormalizado("NUTRIMIX BRASIL FERTILIZANTES S.A")).toBe(a);
    expect(nomeNormalizado("nutrimix brasil fertilizantes SA")).toBe(a);
  });
  it("não junta empresas diferentes", () => {
    expect(nomeNormalizado("Mosaic Fertilizantes")).not.toBe(nomeNormalizado("Mosaic Agro"));
  });
});

describe("agruparFornecedores", () => {
  it("soma o peso da mesma empresa e ordena do maior para o menor", () => {
    const r = agruparFornecedores([
      { nome: "Nutrimix Brasil Fertilizantes S/A", pesoKg: dec("1000.5") },
      { nome: "Agronelli", pesoKg: dec("1500") },
      { nome: "NUTRIMIX BRASIL FERTILIZANTES S.A", pesoKg: dec("800.25") },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].nome).toBe("Nutrimix Brasil Fertilizantes S/A");
    expect(igual(r[0].pesoKg, "1800.75")).toBe(true);
    expect(r[1].nome).toBe("Agronelli");
  });
});
