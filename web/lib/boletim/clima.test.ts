import { describe, expect, it } from "vitest";

import type { TempoDoDia } from "@/lib/tempo";
import { climaDoDia, frase, momentoDe } from "./clima";

const chuva = (data: string, pct: number): TempoDoDia => ({ data, tipo: "chuva", descricao: "Chuva", minC: 18, maxC: 26, chuvaPct: pct, alertaChuva: pct >= 60 });

describe("clima do boletim", () => {
  it("separa passado, hoje e futuro", () => {
    expect(momentoDe("2026-10-04", "2026-10-05")).toBe("passado");
    expect(momentoDe("2026-10-05", "2026-10-05")).toBe("hoje");
    expect(momentoDe("2026-10-06", "2026-10-05")).toBe("futuro");
  });

  it("usa o tempo verbal certo para cada momento", () => {
    expect(frase("passado", true, 80)).toBe("Choveu");
    expect(frase("passado", false, 10)).toBe("Não choveu");
    expect(frase("hoje", true, 90)).toBe("Chove hoje");
    expect(frase("futuro", true, 70)).toBe("Vai chover (70%)");
    expect(frase("futuro", false, 10)).toBe("Sem chuva prevista");
  });

  it("dia com previsão real não é marcado como estimado", () => {
    const c = climaDoDia("2026-10-07", "2026-10-05", chuva("2026-10-07", 75));
    expect(c.estimado).toBe(false);
    expect(c.chove).toBe(true);
    expect(c.frase).toBe("Vai chover (75%)");
  });

  it("dia sem dado recebe o mesmo clima simulado toda vez", () => {
    const a = climaDoDia("2026-10-01", "2026-10-05");
    const b = climaDoDia("2026-10-01", "2026-10-05");
    expect(a).toEqual(b);
    expect(a.estimado).toBe(true);
  });
});
