import { describe, expect, it } from "vitest";

import { perfilPorDiaDaSemana, resumirProjecao, type DiaProjetado } from "./projecao";

const dia = (data: string, rec: number, ate = rec, origem: DiaProjetado["origem"] = "estimado"): DiaProjetado => ({
  data,
  diaSemana: "seg",
  origem,
  cargas: 3,
  recomendado: rec,
  de: rec,
  ate,
});

// 2026-09-07 é segunda; 08 e 09 completam a semana, 14 é a segunda seguinte
const SEMANA_1 = [dia("2026-09-07", 6), dia("2026-09-08", 5, 9, "agendado"), dia("2026-09-09", 4)];
const SEMANA_2 = [dia("2026-09-14", 8), dia("2026-09-15", 7)];

describe("resumirProjecao", () => {
  const r = resumirProjecao([...SEMANA_1, ...SEMANA_2], { piso: "100", escalaAtual: "6", semanas: 2 });

  it("custo recomendado = funcionários somadas × piso; máximo usa a ponta alta da faixa", () => {
    // 6+5+4+8+7 = 30 chapas; máximo 6+9+4+8+7 = 34
    expect(r.custoRecomendado).toBe("R$ 3.000,00");
    expect(r.custoMaximo).toBe("R$ 3.400,00");
    expect(r.chapasPorDia).toBe("6,0");
  });

  it("economia só conta os dias em que a escala de hoje passa do recomendado", () => {
    // escala 6: 0 + 1 + 2 + 0 + 0 = 3 diárias × 100
    expect(r.economia).toBe("R$ 300,00");
    expect(r.custoEscalaAtual).toBe("R$ 3.000,00"); // 6 × 5 dias × 100
    expect(r.diasDeReforco).toBe(2); // 8 e 7 passam de 6
    expect(r.diasDeSobra).toBe(2); // 5 e 4 ficam abaixo de 6
    expect(r.reforcoMedio).toBe("1,5"); // (2 + 1) ÷ 2
  });

  it("separa por semana de segunda a sexta e conta os dias agendados", () => {
    expect(r.semanasDetalhe).toHaveLength(2);
    expect(r.semanasDetalhe[0]).toMatchObject({ inicio: "2026-09-07", fim: "2026-09-09", dias: 3, agendados: 1, custo: "R$ 1.500,00", economia: "R$ 300,00" });
    expect(r.semanasDetalhe[1]).toMatchObject({ inicio: "2026-09-14", dias: 2, agendados: 0, custo: "R$ 1.500,00", economia: "R$ 0,00" });
    expect(r.agendados).toBe(1);
    expect(r.parciais).toBe(0);
    expect(r.estimados).toBe(4);
  });

  it("pico é o dia que mais pede funcionários", () => {
    expect(r.pico).toEqual({ data: "2026-09-14", chapas: 8 });
  });

  it("sem escala de referência no histórico, não inventa economia nem reforço", () => {
    const s = resumirProjecao(SEMANA_1, { piso: "100", escalaAtual: null, semanas: 2 });
    expect(s.economia).toBeNull();
    expect(s.custoEscalaAtual).toBeNull();
    expect(s.diasDeReforco).toBe(0);
    expect(s.semanasDetalhe[0].economia).toBeNull();
  });

  it("escala fracionária entra na conta sem arredondar", () => {
    const s = resumirProjecao([dia("2026-09-07", 5)], { piso: "90.1731", escalaAtual: "7.5", semanas: 2 });
    // (7,5 − 5) × 90,1731 = 225,43275 → exibido com 2 casas
    expect(s.economia).toBe("R$ 225,43");
    expect(s.custoEscalaAtual).toBe("R$ 676,30");
  });
});

describe("perfilPorDiaDaSemana", () => {
  it("recomendado é a média das diárias justificadas do dia da semana; faixa do 25º ao 75º percentil", () => {
    const seg = [2, 4, 6, 8, 10].map((diarias, i) => ({ data: `2026-03-${String(2 + i * 7).padStart(2, "0")}`, diarias })); // cinco segundas
    const perfil = perfilPorDiaDaSemana(seg, [{ data: "2026-03-02", cargas: 4 }, { data: "2026-03-09", cargas: 6 }]);
    expect(perfil.get(1)).toEqual({ cargas: 5, recomendado: 6, de: 4, ate: 8 });
    expect(perfil.get(2)).toBeUndefined();
  });

  it("nunca passa de 20 funcionários (limite do boletim) nem cai abaixo de 1", () => {
    const perfil = perfilPorDiaDaSemana(
      [{ data: "2026-03-02", diarias: 80 }, { data: "2026-03-09", diarias: 90 }, { data: "2026-03-03", diarias: 0.2 }],
      [],
    );
    expect(perfil.get(1)).toMatchObject({ recomendado: 20, ate: 20 });
    expect(perfil.get(2)).toMatchObject({ recomendado: 1, de: 1 });
  });
});
