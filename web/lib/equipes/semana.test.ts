import { describe, expect, it } from "vitest";
import { diasDaSemana, diasParaImprimir, equipeNoHorario, linhasDoDia, tamanhoDoTexto } from "./semana";
import type { EquipeEscala } from "./servico";

const H = ["08:00", "10:00", "13:00", "15:00"];
const ARM = [{ id: 2, nome: "Adubo" }];

function equipe(parte: Partial<EquipeEscala>): EquipeEscala {
  return { id: 1, data: "2026-08-31", nome: "A", armazemId: 2, tarefa: null, horarioInicio: null, horarioFim: null, membros: [{ id: 1, chapaId: 1, matricula: "E001", nome: "João Silva", tipo: "completa" }], ...parte };
}

describe("folhas da escala", () => {
  it("a semana vai de segunda a sábado, de qualquer dia", () => {
    const esperado = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"];
    expect(diasDaSemana("2026-08-31")).toEqual(esperado);
    expect(diasDaSemana("2026-09-03")).toEqual(esperado);
    expect(diasDaSemana("2026-09-06")).toEqual(esperado);
  });

  it("a equipe cai só no horário fixo que escolheu, sem hora final", () => {
    expect(H.filter((h) => equipeNoHorario(equipe({ horarioInicio: "10:00" }), h, H))).toEqual(["10:00"]);
    expect(H.filter((h) => equipeNoHorario(equipe({ horarioInicio: "15:00" }), h, H))).toEqual(["15:00"]);
  });

  it("horário fora da grade cai no horário fixo anterior, ou no primeiro", () => {
    expect(H.filter((h) => equipeNoHorario(equipe({ horarioInicio: "08:30" }), h, H))).toEqual(["08:00"]);
    expect(H.filter((h) => equipeNoHorario(equipe({ horarioInicio: "14:00" }), h, H))).toEqual(["13:00"]);
    expect(H.filter((h) => equipeNoHorario(equipe({ horarioInicio: "06:00" }), h, H))).toEqual(["08:00"]);
  });

  it("sem horário a equipe vale o dia todo", () => {
    expect(H.filter((h) => equipeNoHorario(equipe({}), h, H))).toEqual(H);
  });

  it("monta uma linha por equipe, com armazém, tarefa e os funcionários no horário dela", () => {
    const manha = equipe({ horarioInicio: "08:00", tarefa: "Descarga", membros: [{ id: 1, chapaId: 1, matricula: "E001", nome: "João Silva", tipo: "meia" }] });
    const dia = equipe({ id: 2, nome: "B", armazemId: null, membros: [{ id: 2, chapaId: 2, matricula: "E002", nome: "Maria Souza", tipo: "completa" }] });
    const [a, b] = linhasDoDia([manha, dia], H, ARM);
    expect(a).toMatchObject({ nome: "A", armazem: "Adubo", tarefa: "Descarga", horario: "08:00" });
    expect(a.celulas).toEqual([[{ nome: "João Silva", tipo: "meia" }], [], [], []]);
    expect(b).toMatchObject({ armazem: null, tarefa: null, horario: null });
    expect(b.celulas.every((c) => c.length === 1)).toBe(true);
  });

  it("imprime segunda a sexta e o sábado só com escala", () => {
    const semana = diasDaSemana("2026-08-31").map((data) => ({ data, equipes: [] as number[] }));
    expect(diasParaImprimir(semana)).toHaveLength(5);
    semana[5].equipes.push(1);
    expect(diasParaImprimir(semana)).toHaveLength(6);
  });

  it("a letra cresce quando há pouco texto e encolhe quando a folha enche, sem passar dos limites", () => {
    const poucas = linhasDoDia([equipe({})], H, ARM);
    const muitas = linhasDoDia(
      Array.from({ length: 6 }, (_, i) => equipe({ id: i + 1, nome: `E${i}`, membros: Array.from({ length: 12 }, (_, k) => ({ id: k, chapaId: k, matricula: `E${k}`, nome: "Nome Sobrenome Comprido", tipo: "completa" as const })) })),
      H,
      ARM,
    );
    expect(tamanhoDoTexto(poucas, 4)).toBe(30);
    expect(tamanhoDoTexto(linhasDoDia([equipe({ nome: "A" }), equipe({ id: 2 }), equipe({ id: 3 }), equipe({ id: 4 })], H, ARM), 4)).toBeGreaterThan(24);
    expect(tamanhoDoTexto(muitas, 4)).toBe(12);
    expect(tamanhoDoTexto([], 4)).toBeGreaterThanOrEqual(12);
  });
});
