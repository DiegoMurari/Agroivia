import { describe, expect, it } from "vitest";

import {
  comparar,
  dec,
  decBR,
  decOuNulo,
  deInteiro,
  dividir,
  formatBRL,
  formatNumero,
  igual,
  maior,
  multiplicar,
  paraTexto,
  paraTextoCasas,
  somar,
  subtrair,
} from "./money";

describe("formatNumero e formatBRL (tabela Dinheiro do PRD)", () => {
  it.each([
    ["1.005", "1,01"],
    ["0.005", "0,01"],
    ["946.81755", "946,82"],
    ["1289.6", "1.289,60"],
  ])("%s exibe %s", (entrada, exibe) => {
    expect(formatNumero(entrada)).toBe(exibe);
    expect(formatBRL(entrada)).toBe(`R$ ${exibe}`);
  });

  it("milhar, negativo e zero", () => {
    expect(formatNumero("1234567.891")).toBe("1.234.567,89");
    expect(formatNumero("-1234.5")).toBe("-1.234,50");
    expect(formatBRL("-0.001")).toBe("R$ 0,00");
    expect(formatNumero("2848", 0)).toBe("2.848");
  });
});

describe("cálculo sem arredondar", () => {
  it("produção base do boletim é exata", () => {
    const producao = multiplicar(somar("2778", "30", "40"), "0.3224");
    expect(paraTexto(producao)).toBe("918.1952");
    const total = multiplicar("90.1731", deInteiro(11));
    expect(paraTexto(total)).toBe("991.9041");
    expect(paraTexto(subtrair(total, producao))).toBe("73.7089");
  });

  it("divisão que não termina guarda a precisão e exibe com casas", () => {
    const porDiaria = dividir("100", deInteiro(3));
    expect(paraTextoCasas(porDiaria, 10)).toBe("33.3333333333");
    expect(formatNumero(porDiaria)).toBe("33,33");
    expect(igual(multiplicar(dividir("918.1952", "10.5"), "10.5"), "918.1952")).toBe(true);
  });

  it("igualdade e comparação são de valor, não de texto", () => {
    expect(igual("54.8080", "54.808")).toBe(true);
    expect(comparar("100.5", "20")).toBe(1);
    expect(comparar("0.1", "0.10")).toBe(0);
    expect(paraTexto(maior("991.9041", "918.1952"))).toBe("991.9041");
    expect(paraTexto(somar("0.1", "0.2"))).toBe("0.3");
  });

  it("texto gravado não tem expoente nem zero à direita", () => {
    expect(paraTexto("54.8080")).toBe("54.808");
    expect(paraTexto("0.0000001")).toBe("0.0000001");
    expect(paraTexto(multiplicar("1000000000", "1000000000000"))).toBe("1000000000000000000000");
  });
});

describe("leitura", () => {
  it("recusa o que não é texto decimal", () => {
    for (const ruim of ["", "abc", "1,5", "1e3", "NaN", "Infinity"]) {
      expect(() => dec(ruim)).toThrow();
      expect(decOuNulo(ruim)).toBeNull();
    }
    expect(decOuNulo(null)).toBeNull();
    expect(() => deInteiro(1.5)).toThrow();
    expect(() => dividir("1", "0")).toThrow();
  });

  it("lê o padrão brasileiro digitado", () => {
    expect(paraTexto(decBR("1.289,60"))).toBe("1289.6");
    expect(paraTexto(decBR("0,3224"))).toBe("0.3224");
    expect(paraTexto(decBR("2778"))).toBe("2778");
    expect(paraTexto(decBR("2.778,00"))).toBe("2778");
    expect(() => decBR("2.778")).toThrow(/ambíguo/);
    expect(() => decBR("1,289.60")).toThrow(/ambíguo/);
  });
});
