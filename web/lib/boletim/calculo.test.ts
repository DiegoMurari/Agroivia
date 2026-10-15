import { describe, expect, it } from "vitest";
import { formatNumero, igual } from "@/lib/money";
import { calcularBoletim, ErroBoletim, type EntradaBoletim } from "./calculo";
import { parametrosBoletim } from "./params";

const P = "0.3224";
const baseLinhas = [
  { preco: P, descarga: "2378", remocao: "400", transferencia: "0" }, // fertilizantes
  { preco: P, descarga: "30" }, // agroquímico
  { preco: P, remocao: "40" }, // serviços diversos
];
const completas = (n: number) => Array.from({ length: n }, (_, i) => ({ matricula: String(100 + i), tipo: "completa" as const }));
const entrada = (linhas: EntradaBoletim["linhas"], equipe: EntradaBoletim["equipe"]): EntradaBoletim => ({ linhas, equipe });

describe("parametros", () => {
  it("padrão e override da tabela", () => {
    expect(parametrosBoletim()).toEqual({ piso: "90.1731", fatorMeia: "0.5", maxChapas: 20 });
    expect(parametrosBoletim({ piso_diaria: "100", max_chapas_boletim: "5" })).toMatchObject({ piso: "100", maxChapas: 5 });
  });
});

describe("calcularBoletim", () => {
  it("T1 base: 918,1952 com 11 funcionários", () => {
    const r = calcularBoletim(entrada(baseLinhas, completas(11)));
    expect(igual(r.producaoTotal, "918.1952")).toBe(true);
    expect(igual(r.diariasEquivalentes, "11")).toBe(true);
    expect(r.valorPorDiaria).toBe("83.4722909091");
    expect(igual(r.totalAPagar, "991.9041")).toBe(true);
    expect(igual(r.complemento, "73.7089")).toBe(true);
    expect(r.abaixoDoPiso).toBe(true);
    expect([r.producaoTotal, r.valorPorDiaria, r.totalAPagar, r.complemento].map((v) => formatNumero(v))).toEqual(["918,20", "83,47", "991,90", "73,71"]);
    expect(r.linhas[0].quantidade).toBe("2778");
  });

  it("T2: 10 completas + 1 meia", () => {
    const equipe = [...completas(10), { matricula: "999", tipo: "meia" as const }];
    const r = calcularBoletim(entrada(baseLinhas, equipe));
    expect(igual(r.diariasEquivalentes, "10.5")).toBe(true);
    expect(igual(r.totalAPagar, "946.81755")).toBe(true);
    expect(igual(r.complemento, "28.62235")).toBe(true);
    expect([r.valorPorDiaria, r.totalAPagar, r.complemento].map((v) => formatNumero(v))).toEqual(["87,45", "946,82", "28,62"]);
  });

  it("T3: acima do piso, complemento 0", () => {
    const r = calcularBoletim(entrada([{ preco: P, descarga: "4000" }], completas(11)));
    expect(igual(r.producaoTotal, "1289.6")).toBe(true);
    expect(r.valorPorDiaria).toBe("117.2363636364");
    expect(igual(r.totalAPagar, "1289.6")).toBe(true);
    expect(igual(r.complemento, "0")).toBe(true);
    expect(r.abaixoDoPiso).toBe(false);
    expect([r.valorPorDiaria, r.totalAPagar, r.complemento].map((v) => formatNumero(v))).toEqual(["117,24", "1.289,60", "0,00"]);
  });

  it("T4: limite do piso decide sem arredondar", () => {
    const com = (producao: string) => calcularBoletim(entrada([{ preco: producao, descarga: "1" }], completas(11)));
    const igualAoPiso = com("991.9041");
    expect(igual(igualAoPiso.complemento, "0")).toBe(true);
    expect(igualAoPiso.abaixoDoPiso).toBe(false);
    const abaixo = com("991.9040");
    expect(igual(abaixo.complemento, "0.0001")).toBe(true);
    expect(abaixo.abaixoDoPiso).toBe(true);
    expect(igual(com("991.9042").complemento, "0")).toBe(true);
  });

  it("T5: três modalidades somam", () => {
    const r = calcularBoletim(entrada([{ preco: P, descarga: "100", remocao: "50", transferencia: "20" }], completas(1)));
    expect(r.linhas[0].quantidade).toBe("170");
    expect(igual(r.linhas[0].valor, "54.808")).toBe(true);
    expect(formatNumero(r.linhas[0].valor)).toBe("54,81");
  });

  it("T6 e T7: 0 e 21 funcionários recusados com a causa", () => {
    expect(() => calcularBoletim(entrada(baseLinhas, []))).toThrow(/pelo menos 1 funcionário/i);
    expect(() => calcularBoletim(entrada(baseLinhas, completas(21)))).toThrow(/no máximo 20/i);
    expect(() => calcularBoletim(entrada(baseLinhas, []))).toThrow(ErroBoletim);
  });

  it("T9: dízima com 10 casas", () => {
    const r = calcularBoletim(entrada([{ preco: "100", descarga: "1" }], completas(3)));
    expect(r.valorPorDiaria).toBe("33.3333333333");
    expect(igual(r.totalAPagar, "270.5193")).toBe(true);
    expect(igual(r.complemento, "170.5193")).toBe(true);
    expect([r.valorPorDiaria, r.totalAPagar, r.complemento].map((v) => formatNumero(v))).toEqual(["33,33", "270,52", "170,52"]);
  });

  it("T10: só meias, 2 meias = 1 diária", () => {
    const equipe = [{ matricula: "1", tipo: "meia" as const }, { matricula: "2", tipo: "meia" as const }];
    const r = calcularBoletim(entrada([{ preco: "50", descarga: "1" }], equipe));
    expect(igual(r.diariasEquivalentes, "1")).toBe(true);
    expect(igual(r.totalAPagar, "90.1731")).toBe(true);
    expect(igual(r.complemento, "40.1731")).toBe(true);
    expect([r.totalAPagar, r.complemento].map((v) => formatNumero(v))).toEqual(["90,17", "40,17"]);
  });

  it("T11: linha Meia diária soma 45,0786 à produção", () => {
    const r = calcularBoletim(entrada([{ preco: "45.0786", descarga: "1" }], completas(1)));
    expect(igual(r.producaoTotal, "45.0786")).toBe(true);
    expect(formatNumero(r.producaoTotal)).toBe("45,08");
  });

  it("B1: 20 funcionários aceitas", () => {
    expect(calcularBoletim(entrada(baseLinhas, completas(20))).linhas).toHaveLength(3);
  });

  it("B2: produção 0, sem NaN", () => {
    const r = calcularBoletim(entrada([{ preco: P }], completas(11)));
    expect(igual(r.valorPorDiaria, "0")).toBe(true);
    expect(igual(r.totalAPagar, "991.9041")).toBe(true);
    expect(igual(r.complemento, "991.9041")).toBe(true);
    expect(r.valorPorDiaria).not.toMatch(/NaN|Infinity/);
  });

  it("B3: matrícula repetida recusada", () => {
    const equipe = [{ matricula: "158", tipo: "completa" as const }, { matricula: "158", tipo: "meia" as const }];
    expect(() => calcularBoletim(entrada(baseLinhas, equipe))).toThrow(/158.*mais de uma vez/i);
  });

  it("recusa quantidade negativa e usa o parâmetro recebido", () => {
    expect(() => calcularBoletim(entrada([{ preco: P, descarga: "-1" }], completas(1)))).toThrow(ErroBoletim);
    const r = calcularBoletim({ linhas: [{ preco: "1", descarga: "10" }], equipe: completas(1), parametros: { piso: "100", fatorMeia: "0.5", maxChapas: 20 } });
    expect(igual(r.totalAPagar, "100")).toBe(true);
  });
});
