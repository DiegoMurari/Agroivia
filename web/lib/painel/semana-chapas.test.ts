import { afterEach, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/lib/db/testing";
import { diaDaSemana, previsaoDaSemana } from "./semana-chapas";

let t: TestDb;
afterEach(() => t?.apagar());

describe("previsaoDaSemana", () => {
  it("traz hoje e mais 6 dias úteis, pulando o fim de semana sem agenda", () => {
    t = createTestDb({ seed: true });
    const dias = previsaoDaSemana(t.db, "2025-10-02"); // quinta
    expect(dias).toHaveLength(7);
    expect(dias[0]).toMatchObject({ data: "2025-10-02", hoje: true, diaSemana: "qui" });
    expect(dias.map((d) => d.data)).toEqual([
      "2025-10-02", "2025-10-03", "2025-10-06", "2025-10-07", "2025-10-08", "2025-10-09", "2025-10-10",
    ]);
    expect(dias.filter((d) => d.hoje)).toHaveLength(1);
  });

  it("dia sem agendamento não inventa número", () => {
    t = createTestDb({ seed: true });
    const [hoje] = previsaoDaSemana(t.db, "2025-10-02");
    expect(hoje.caminhoes).toBe(0);
    expect(hoje.recomendado).toBe(0);
    expect(hoje.porHorario).toEqual([]);
  });

  it("calcula o dia da semana", () => {
    expect(diaDaSemana("2025-10-05")).toBe(0);
    expect(diaDaSemana("2025-10-06")).toBe(1);
  });
});
