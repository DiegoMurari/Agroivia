import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { arquivoAncoraDe, criarRelogio, paraDataISO, paraISO } from "./relogio";

const DEMO = "2026-10-05T07:45:00-03:00";
const pastas: string[] = [];

function pastaTemporaria(): string {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "relogio-"));
  pastas.push(pasta);
  return pasta;
}

afterEach(() => {
  for (const pasta of pastas.splice(0)) fs.rmSync(pasta, { recursive: true, force: true });
});

describe("texto em Brasília, sem depender do fuso da máquina", () => {
  it("instante vira ISO com -03:00", () => {
    expect(paraISO(new Date("2026-10-05T10:45:00Z"))).toBe("2026-10-05T07:45:00-03:00");
    expect(paraISO(new Date("2026-10-06T01:30:15Z"))).toBe("2026-10-05T22:30:15-03:00");
    expect(paraDataISO(new Date("2026-10-06T02:59:59Z"))).toBe("2026-10-05");
    expect(paraDataISO(new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-06");
  });
});

describe("relógio", () => {
  it("sem DEMO_AGORA é a hora real", () => {
    const relogio = criarRelogio({ tempoReal: () => Date.parse("2026-10-03T18:00:00Z") });
    expect(relogio.agoraISO()).toBe("2026-10-03T15:00:00-03:00");
    expect(relogio.hojeISO()).toBe("2026-10-03");
  });

  it("com DEMO_AGORA parte do instante e continua correndo", () => {
    let real = Date.parse("2026-10-04T11:00:00Z");
    const relogio = criarRelogio({ demoAgora: DEMO, tempoReal: () => real });
    expect(relogio.agoraISO()).toBe(DEMO);
    real += 31 * 60_000;
    expect(relogio.agoraISO()).toBe("2026-10-05T08:16:00-03:00");
    expect(relogio.hojeISO()).toBe("2026-10-05");
  });

  it("reiniciar não volta o relógio: duas instâncias leem a mesma âncora", () => {
    const arquivoAncora = arquivoAncoraDe(path.join(pastaTemporaria(), "demo.db"));
    let real = Date.parse("2026-10-04T11:00:00Z");

    const antes = criarRelogio({ demoAgora: DEMO, arquivoAncora, tempoReal: () => real });
    expect(antes.agoraISO()).toBe(DEMO);
    expect(fs.existsSync(arquivoAncora)).toBe(true);

    real += 20 * 60_000;
    const depois = criarRelogio({ demoAgora: DEMO, arquivoAncora, tempoReal: () => real });
    expect(depois.agoraISO()).toBe("2026-10-05T08:05:00-03:00");
    expect(antes.agoraISO()).toBe(depois.agoraISO());
  });

  it("apagar a âncora (db:clone) recomeça a demo", () => {
    const arquivoAncora = arquivoAncoraDe(path.join(pastaTemporaria(), "demo.db"));
    let real = Date.parse("2026-10-04T11:00:00Z");
    criarRelogio({ demoAgora: DEMO, arquivoAncora, tempoReal: () => real }).agora();

    real += 3 * 3_600_000;
    fs.rmSync(arquivoAncora);
    const nova = criarRelogio({ demoAgora: DEMO, arquivoAncora, tempoReal: () => real });
    expect(nova.agoraISO()).toBe(DEMO);
  });

  it("âncora de outra DEMO_AGORA é substituída", () => {
    const arquivoAncora = arquivoAncoraDe(path.join(pastaTemporaria(), "demo.db"));
    let real = Date.parse("2026-10-04T11:00:00Z");
    criarRelogio({ demoAgora: DEMO, arquivoAncora, tempoReal: () => real }).agora();

    real += 60_000;
    const outra = "2026-10-06T09:00:00-03:00";
    expect(criarRelogio({ demoAgora: outra, arquivoAncora, tempoReal: () => real }).agoraISO()).toBe(outra);
  });

  it("pasta da âncora inexistente não derruba: segue em memória", () => {
    const arquivoAncora = path.join(pastaTemporaria(), "nao-existe", "demo.db.relogio");
    const relogio = criarRelogio({ demoAgora: DEMO, arquivoAncora, tempoReal: () => 0 });
    expect(relogio.agoraISO()).toBe(DEMO);
  });

  it("DEMO_AGORA inválida falha com mensagem clara", () => {
    expect(() => criarRelogio({ demoAgora: "segunda de manhã" })).toThrow(/DEMO_AGORA/);
    expect(() => criarRelogio({ demoAgora: "2026-10-05" })).toThrow(/DEMO_AGORA/);
    expect(() => criarRelogio({ demoAgora: "2026-10-05T07:45:00" })).toThrow(/DEMO_AGORA/);
  });
});
