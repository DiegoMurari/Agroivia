import { describe, expect, it } from "vitest";

import { alertasDoDia, dimensionarCarga, type LinhaNormaDuracao } from "./dimensionar";

const norma: LinhaNormaDuracao[] = [
  { perfil: "agrovia", acondicionamento: "batido", pesoMinKgExclusivo: "500", chapas: 5, empilhadeira: false, duracaoMin: 45 },
  { perfil: "agrovia", acondicionamento: "paletizado", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: true, duracaoMin: 15 },
  { perfil: "agrovia", acondicionamento: "big_bag", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: true, duracaoMin: 30 },
  { perfil: "agrovia", acondicionamento: "maquina", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: false, duracaoMin: 20 },
  { perfil: "dossie", acondicionamento: "batido", pesoMinKgExclusivo: "500", chapas: 5, empilhadeira: false, duracaoMin: 45 },
  { perfil: "dossie", acondicionamento: "paletizado", pesoMinKgExclusivo: "500", chapas: 2, empilhadeira: true, duracaoMin: 15 },
  { perfil: "dossie", acondicionamento: "big_bag", pesoMinKgExclusivo: "500", chapas: 2, empilhadeira: true, duracaoMin: 30 },
  { perfil: "dossie", acondicionamento: "maquina", pesoMinKgExclusivo: "500", chapas: 1, empilhadeira: false, duracaoMin: 20 },
];

describe("dimensionar carga pela norma", () => {
  it("batido 500 kg: nenhum funcionário; 500,001 kg: 5", () => {
    expect(dimensionarCarga([{ acondicionamento: "batido", pesoKg: "500" }], norma)).toEqual({ chapas: 0, empilhadeira: false, duracaoMin: 0 });
    expect(dimensionarCarga([{ acondicionamento: "batido", pesoKg: "500.001" }], norma)).toEqual({ chapas: 5, empilhadeira: false, duracaoMin: 45 });
  });

  it("paletizado 12 t: 1 funcionário e empilhadeira", () => {
    expect(dimensionarCarga([{ acondicionamento: "paletizado", pesoKg: "12000" }], norma)).toEqual({ chapas: 1, empilhadeira: true, duracaoMin: 15 });
  });

  it("carga mista: funcionários do maior componente, empilhadeira se algum pedir, duração somada", () => {
    const r = dimensionarCarga(
      [
        { acondicionamento: "batido", pesoKg: "8000" },
        { acondicionamento: "paletizado", pesoKg: "20000" },
      ],
      norma,
    );
    expect(r).toEqual({ chapas: 5, empilhadeira: true, duracaoMin: 60 });
  });

  it("perfil dossiê: paletizado 2", () => {
    expect(dimensionarCarga([{ acondicionamento: "paletizado", pesoKg: "12000" }], norma, "dossie").chapas).toBe(2);
  });

  it("peso desconhecido: assume a norma cheia (conservador)", () => {
    expect(dimensionarCarga([{ acondicionamento: "batido", pesoKg: null }], norma).chapas).toBe(5);
  });

  it("dia sem cargas: zero", () => {
    expect(dimensionarCarga([], norma)).toEqual({ chapas: 0, empilhadeira: false, duracaoMin: 0 });
  });
});

describe("alertas do dia", () => {
  const base = { data: "2026-10-06", capacidade: 8, empilhadeirasDisponiveis: 2, escalados: null as number | null };

  it("sem problema, sem alerta", () => {
    const cargas = [{ id: 1, horario: "08:00", chapas: 5, empilhadeira: false }];
    expect(alertasDoDia({ ...base, cargas, escalados: 11 })).toEqual([]);
  });

  it("falta de colaborador: necessidade do dia (maior carga) acima da escala", () => {
    const cargas = [{ id: 1, horario: "08:00", chapas: 5, empilhadeira: false }];
    const r = alertasDoDia({ ...base, cargas, escalados: 4 });
    expect(r.map((a) => a.tipo)).toEqual(["colaborador"]);
    expect(r[0].mensagem).toMatch(/5 funcionários/);
  });

  it("sem escala lançada não alerta colaborador", () => {
    const cargas = [{ id: 1, horario: "08:00", chapas: 5, empilhadeira: false }];
    expect(alertasDoDia({ ...base, cargas, escalados: null })).toEqual([]);
  });

  it("falta de equipamento: cargas no mesmo horário pedindo mais empilhadeiras que as disponíveis", () => {
    const cargas = [1, 2, 3].map((id) => ({ id, horario: "10:00", chapas: 1, empilhadeira: true }));
    expect(alertasDoDia({ ...base, cargas }).map((a) => a.tipo)).toEqual(["equipamento"]);
  });

  it("nenhuma empilhadeira disponível e carga que precisa", () => {
    const cargas = [{ id: 1, horario: "10:00", chapas: 1, empilhadeira: true }];
    expect(alertasDoDia({ ...base, cargas, empilhadeirasDisponiveis: 0 }).map((a) => a.tipo)).toEqual(["equipamento"]);
  });

  it("falta de espaço: mais cargas que a capacidade do dia", () => {
    const cargas = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, horario: "08:00", chapas: 0, empilhadeira: false }));
    expect(alertasDoDia({ ...base, cargas, capacidade: 4 }).map((a) => a.tipo)).toEqual(["espaco"]);
  });
});

describe("limite de peso vale para a carga", () => {
  it("duas NF batidas de 300 kg somam 600 kg e pedem 5 funcionários", () => {
    const r = dimensionarCarga(
      [
        { acondicionamento: "batido", pesoKg: "300" },
        { acondicionamento: "batido", pesoKg: "300" },
      ],
      norma,
    );
    expect(r.chapas).toBe(5);
  });
});
