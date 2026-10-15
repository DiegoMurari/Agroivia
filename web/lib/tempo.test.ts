import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { interpretarResumo, tempoDosDias, type Buscador } from "./tempo";

let t: TestDb;
afterEach(() => t?.apagar());

const resposta = {
  daily: {
    time: ["2026-10-05", "2026-10-06", "2026-10-07"],
    weathercode: [0, 61, 95],
    temperature_2m_max: [28.4, 25, 22],
    temperature_2m_min: [15.2, 16, 17],
    precipitation_probability_max: [10, 80, 59],
  },
};
const em = (hhmm: string) => `2026-10-05T${hhmm}:00-03:00`;

describe("tempo por dia (D52)", () => {
  it("lê o texto do cache de volta para tipo, temperaturas e alerta de chuva", () => {
    expect(interpretarResumo("2026-10-06", "Chuva, 16° a 25°", "80")).toEqual({
      data: "2026-10-06", tipo: "chuva", descricao: "Chuva", minC: 16, maxC: 25, chuvaPct: 80, alertaChuva: true,
    });
    expect(interpretarResumo("2026-10-07", "Parcialmente nublado", null)).toMatchObject({ tipo: "parcial", minC: null, chuvaPct: null, alertaChuva: false });
    expect(interpretarResumo("2026-10-08", null, null)).toMatchObject({ tipo: "indefinido", descricao: "Tempo indefinido" });
  });

  it("busca uma vez, grava no cache e devolve só os dias do intervalo", async () => {
    t = createTestDb({ seed: true });
    const buscar = vi.fn<Buscador>().mockResolvedValue(resposta);
    const dias = await tempoDosDias(t.db, "2026-10-05", "2026-10-06", em("08:00"), buscar);
    expect(Object.keys(dias).sort()).toEqual(["2026-10-05", "2026-10-06"]);
    expect(dias["2026-10-05"]).toMatchObject({ tipo: "sol", minC: 15, maxC: 28, alertaChuva: false });
    const outra = await tempoDosDias(t.db, "2026-10-07", "2026-10-07", em("09:00"), buscar);
    expect(outra["2026-10-07"]).toMatchObject({ tipo: "tempestade", chuvaPct: 59, alertaChuva: false });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("sem rede: não lança erro, devolve o cache (ou vazio) e não insiste a cada chamada", async () => {
    t = createTestDb({ seed: true });
    const falha = vi.fn<Buscador>().mockRejectedValue(new Error("sem rede"));
    expect(await tempoDosDias(t.db, "2026-10-05", "2026-10-20", em("08:00"), falha)).toEqual({});
    await tempoDosDias(t.db, "2026-10-05", "2026-10-20", em("08:05"), falha);
    expect(falha).toHaveBeenCalledTimes(1);
  });

  it("resposta malformada vira dia sem previsão", async () => {
    t = createTestDb({ seed: true });
    expect(await tempoDosDias(t.db, "2026-10-05", "2026-10-06", em("08:00"), async () => ({ lixo: true }))).toEqual({});
  });
});
