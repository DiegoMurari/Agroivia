import { describe, expect, it } from "vitest";
import { chapasDaCarga, chapasDoDia, faixaDaCarga, faixaDoDia, type LinhaNorma } from "./norma";

// Mesmas linhas do seed fixo (D25): o teste não abre banco.
const NORMA: LinhaNorma[] = [
  { perfil: "agrovia", acondicionamento: "batido", pesoMinKgExclusivo: "500", chapas: 5, empilhadeira: false },
  { perfil: "agrovia", acondicionamento: "paletizado", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: true },
  { perfil: "agrovia", acondicionamento: "big_bag", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: true },
  { perfil: "agrovia", acondicionamento: "maquina", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: false },
  { perfil: "dossie", acondicionamento: "batido", pesoMinKgExclusivo: "500", chapas: 5, empilhadeira: false },
  { perfil: "dossie", acondicionamento: "paletizado", pesoMinKgExclusivo: "500", chapas: 2, empilhadeira: true },
  { perfil: "dossie", acondicionamento: "big_bag", pesoMinKgExclusivo: "500", chapas: 2, empilhadeira: true },
  { perfil: "dossie", acondicionamento: "maquina", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: false },
];

describe("N1 a N7: necessário de funcionários por carga e por dia", () => {
  it("N1: batido de 500 kg não precisa de funcionário (acima de 500 é estritamente maior)", () => {
    expect(chapasDaCarga([{ acondicionamento: "batido", pesoKg: "500" }], NORMA)).toEqual({ chapas: 0, empilhadeira: false });
  });

  it("N2: batido de 500,001 kg precisa de 5", () => {
    expect(chapasDaCarga([{ acondicionamento: "batido", pesoKg: "500.001" }], NORMA)).toEqual({ chapas: 5, empilhadeira: false });
  });

  it("N3: paletizado de 12 t é 1 funcionário mais empilhadeira", () => {
    expect(chapasDaCarga([{ acondicionamento: "paletizado", pesoKg: "12000" }], NORMA)).toEqual({ chapas: 1, empilhadeira: true });
  });

  it("N5: NF batida mais NF paletizada é o maior (5) com empilhadeira", () => {
    const r = chapasDaCarga(
      [
        { acondicionamento: "batido", pesoKg: "8000" },
        { acondicionamento: "paletizado", pesoKg: "12000" },
      ],
      NORMA,
    );
    expect(r).toEqual({ chapas: 5, empilhadeira: true });
  });

  it("N6: perfil dossie, paletizado, são 2 funcionários", () => {
    expect(chapasDaCarga([{ acondicionamento: "paletizado", pesoKg: "12000" }], NORMA, { perfil: "dossie" })).toEqual({
      chapas: 2,
      empilhadeira: true,
    });
  });

  it("N7: dia sem cargas precisa de 0", () => {
    expect(chapasDoDia([])).toEqual({ chapas: 0, empilhadeira: false });
  });
});

describe("regras de borda", () => {
  it("perfil padrão é o agrovia (big bag é 1, não 2)", () => {
    expect(chapasDaCarga([{ acondicionamento: "big_bag", pesoKg: "1000" }], NORMA).chapas).toBe(1);
    expect(chapasDaCarga([{ acondicionamento: "big_bag", pesoKg: "1000" }], NORMA, { perfil: "dossie" }).chapas).toBe(2);
  });

  it("máquina conta 1 funcionário (o operador não conta) e sem empilhadeira", () => {
    expect(chapasDaCarga([{ acondicionamento: "maquina", pesoKg: "3000" }], NORMA)).toEqual({ chapas: 1, empilhadeira: false });
  });

  it("até 500 kg paletizado também não precisa de nada, nem de empilhadeira", () => {
    expect(chapasDaCarga([{ acondicionamento: "paletizado", pesoKg: "400" }], NORMA)).toEqual({ chapas: 0, empilhadeira: false });
  });

  it("carga sem componentes precisa de 0", () => {
    expect(chapasDaCarga([], NORMA)).toEqual({ chapas: 0, empilhadeira: false });
  });

  it("falha com mensagem clara se a norma não tem o acondicionamento do perfil", () => {
    const sem = NORMA.filter((n) => !(n.perfil === "agrovia" && n.acondicionamento === "big_bag"));
    expect(() => chapasDaCarga([{ acondicionamento: "big_bag", pesoKg: "1000" }], sem)).toThrow(/big_bag/);
  });

  it("o dia é o maior entre as cargas (uma equipe em sequência), com empilhadeira se alguma pedir", () => {
    const r = chapasDoDia([
      { chapas: 5, empilhadeira: false },
      { chapas: 1, empilhadeira: true },
      { chapas: 0, empilhadeira: false },
    ]);
    expect(r).toEqual({ chapas: 5, empilhadeira: true });
  });
});

describe("faixa do histórico (D22): sem acondicionamento conhecido, do menor ao maior", () => {
  it("acondicionamento desconhecido acima de 500 kg vai de 1 a 5", () => {
    const f = faixaDaCarga([{ acondicionamento: null, pesoKg: "12000" }], NORMA);
    expect(f.minimo).toEqual({ chapas: 1, empilhadeira: false });
    expect(f.maximo).toEqual({ chapas: 5, empilhadeira: true });
  });

  it("com a espécie do XML o mínimo é igual ao máximo", () => {
    const f = faixaDaCarga([{ acondicionamento: "big_bag", pesoKg: "12000" }], NORMA);
    expect(f.minimo).toEqual(f.maximo);
    expect(f.maximo).toEqual({ chapas: 1, empilhadeira: true });
  });

  it("peso desconhecido vai de 0 ao máximo do acondicionamento", () => {
    const f = faixaDaCarga([{ acondicionamento: "batido", pesoKg: null }], NORMA);
    expect(f.minimo.chapas).toBe(0);
    expect(f.maximo.chapas).toBe(5);
  });

  it("abaixo de 500 kg a faixa é 0 a 0", () => {
    const f = faixaDaCarga([{ acondicionamento: null, pesoKg: "300" }], NORMA);
    expect(f.minimo.chapas).toBe(0);
    expect(f.maximo.chapas).toBe(0);
  });

  it("possiveis restringe os cenários (grupo de máquinas)", () => {
    const f = faixaDaCarga([{ acondicionamento: null, pesoKg: "3000", possiveis: ["maquina"] }], NORMA);
    expect(f.minimo.chapas).toBe(1);
    expect(f.maximo.chapas).toBe(1);
  });

  it("a faixa do dia é o maior mínimo e o maior máximo entre as cargas", () => {
    const d = faixaDoDia([
      { minimo: { chapas: 1, empilhadeira: false }, maximo: { chapas: 5, empilhadeira: true } },
      { minimo: { chapas: 0, empilhadeira: false }, maximo: { chapas: 1, empilhadeira: false } },
    ]);
    expect(d.minimo).toEqual({ chapas: 1, empilhadeira: false });
    expect(d.maximo).toEqual({ chapas: 5, empilhadeira: true });
  });
});
