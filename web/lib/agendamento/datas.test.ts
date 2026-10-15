import { describe, expect, it } from "vitest";

import { dataBR, diaDaSemana, ehFimDeSemana, instanteMarcado, minutosEntre, somarDias } from "./datas";

describe("datas", () => {
  it("dia da semana sem deslocar pelo fuso", () => {
    expect(diaDaSemana("2026-10-05")).toBe(1); // segunda
    expect(diaDaSemana("2026-10-03")).toBe(6); // sábado
    expect(diaDaSemana("2026-10-04")).toBe(0);
    expect(ehFimDeSemana("2026-10-03")).toBe(true);
    expect(ehFimDeSemana("2026-10-09")).toBe(false);
  });

  it("soma dias entre meses e anos", () => {
    expect(somarDias("2026-10-30", 3)).toBe("2026-11-02");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("recusa data malformada", () => {
    expect(() => diaDaSemana("05/10/2026")).toThrow(/AAAA-MM-DD/);
  });

  it("minutos entre instantes e instante marcado", () => {
    expect(minutosEntre(instanteMarcado("2026-10-05", "08:00"), "2026-10-05T08:30:00-03:00")).toBe(30);
    expect(dataBR("2026-10-05")).toBe("05/10/2026");
  });
});

describe("datas inexistentes", () => {
  it("recusa 31 de fevereiro", () => {
    expect(() => diaDaSemana("2026-02-31")).toThrow(/não existe/);
  });
});
