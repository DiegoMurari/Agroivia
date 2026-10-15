import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { previsaoDoDia, type Buscador } from "./previsao";

let t: TestDb;
afterEach(() => t?.apagar());

const resposta = { daily: { time: ["2026-10-05", "2026-10-06"], weathercode: [2, 61], temperature_2m_max: [28.4, 25], temperature_2m_min: [15.2, 16], precipitation_probability_max: [10, 80] } };
const em = (hhmm: string) => `2026-10-05T${hhmm}:00-03:00`;

describe("previsão do tempo", () => {
  it("busca, grava no cache e não busca de novo dentro da validade", async () => {
    t = createTestDb({ seed: true });
    const buscar = vi.fn<Buscador>().mockResolvedValue(resposta);
    const p = await previsaoDoDia(t.db, "2026-10-05", em("08:00"), buscar);
    expect(p).toMatchObject({ data: "2026-10-05", chuvaProb: "10", desatualizada: false });
    expect(p!.resumo).toBe("Parcialmente nublado, 15° a 28°");
    await previsaoDoDia(t.db, "2026-10-05", em("09:00"), buscar);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect((await previsaoDoDia(t.db, "2026-10-06", em("09:00"), buscar))!.chuvaProb).toBe("80");
  });

  it("sem rede e sem cache: nulo, sem lançar erro, e não insiste a cada 20 s", async () => {
    t = createTestDb({ seed: true });
    const buscar = vi.fn<Buscador>().mockRejectedValue(new Error("timeout"));
    expect(await previsaoDoDia(t.db, "2026-10-05", em("08:00"), buscar)).toBeNull();
    expect(await previsaoDoDia(t.db, "2026-10-05", em("08:00:20".slice(0, 5)), buscar)).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("sem rede com cache velho: devolve o cache marcado como desatualizado", async () => {
    t = createTestDb({ seed: true });
    await previsaoDoDia(t.db, "2026-10-05", em("08:00"), vi.fn<Buscador>().mockResolvedValue(resposta));
    const p = await previsaoDoDia(t.db, "2026-10-05", em("12:00"), vi.fn<Buscador>().mockRejectedValue(new Error("sem rede")));
    expect(p).toMatchObject({ desatualizada: true, chuvaProb: "10" });
  });

  it("resposta malformada cai no fallback", async () => {
    t = createTestDb({ seed: true });
    expect(await previsaoDoDia(t.db, "2026-10-05", em("08:00"), async () => ({ lixo: true }))).toBeNull();
  });
});
