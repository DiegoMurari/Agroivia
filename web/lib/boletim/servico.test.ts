import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { formatNumero, igual } from "@/lib/money";
import { criarBoletim, fecharBoletim, lerBoletim, listarBoletins, reabrirBoletim, salvarBoletim, type DadosBoletim } from "./servico";

const AGORA = "2025-11-17T18:00:00-03:00";
let t: TestDb;
afterEach(() => t?.apagar());

function preparar() {
  t = createTestDb({ seed: true });
  t.db.insert(schema.chapa).values(Array.from({ length: 25 }, (_, i) => ({ matricula: String(100 + i), nome: `CHAPA_${i}` }))).run();
  const armazens = t.db.select().from(schema.armazem).all();
  const tipos = t.db.select().from(schema.tipoItem).all();
  return {
    adubo: armazens.find((a) => a.nome === "Adubo")!,
    insumos: armazens.find((a) => a.nome === "Insumos")!,
    loja: armazens.find((a) => a.nome === "Loja")!,
    fert: tipos.find((x) => x.nome === "Fertilizantes")!,
    agro: tipos.find((x) => x.nome === "Agroquímico")!,
    serv: tipos.find((x) => x.nome === "Serviços diversos")!,
  };
}

const equipe = (de: number, n: number, meiaNaUltima = false) =>
  Array.from({ length: n }, (_, i) => ({ matricula: String(de + i), tipo: meiaNaUltima && i === n - 1 ? ("meia" as const) : ("completa" as const) }));

function t1(c: ReturnType<typeof preparar>, data = "2025-11-17", armazemId = c.adubo.id): DadosBoletim {
  return {
    armazemId,
    data,
    linhas: [
      { tipoItemId: c.fert.id, descarga: "2378", remocao: "400" },
      { tipoItemId: c.agro.id, descarga: "30" },
      { tipoItemId: c.serv.id, remocao: "40" },
    ],
    equipe: equipe(100, 11),
  };
}

describe("serviço do boletim", () => {
  it("T1: cria, recalcula no servidor e grava os valores exatos", () => {
    const c = preparar();
    const b = criarBoletim(t.db, t1(c), AGORA);
    expect(igual(b.producaoTotal, "918.1952")).toBe(true);
    expect(igual(b.totalAPagar, "991.9041")).toBe(true);
    expect(igual(b.complemento, "73.7089")).toBe(true);
    expect(b.valorPorDiaria).toBe("83.4722909091");
    expect(b.abaixoDoPiso).toBe(true);
    expect(b.status).toBe("rascunho");
    expect(b.pisoUsado).toBe("90.1731");
    expect(b.fatorMeiaUsado).toBe("0.5");
    expect(b.criadoEm).toBe(AGORA);
    expect(b.origem).toBeTruthy();
    expect(b.linhas.find((l) => l.nome === "Fertilizantes")).toMatchObject({ quantidadeTotal: "2778", precoUsado: "0.3224" });
    expect(b.equipe).toHaveLength(11);
  });

  it("persistência: fecha e reabre o arquivo", () => {
    const c = preparar();
    const { id } = criarBoletim(t.db, t1(c), AGORA);
    const db2 = t.reabrir();
    const b = lerBoletim(db2, id)!;
    expect(igual(b.producaoTotal, "918.1952")).toBe(true);
    expect(igual(b.totalAPagar, "991.9041")).toBe(true);
    expect(igual(b.complemento, "73.7089")).toBe(true);
    expect([b.valorPorDiaria, b.totalAPagar, b.complemento].map((v) => formatNumero(v))).toEqual(["83,47", "991,90", "73,71"]);
  });

  it("T8: mesma matrícula em 2 boletins no mesmo dia, o segundo recusado sem gravar nada", () => {
    const c = preparar();
    criarBoletim(t.db, t1(c), AGORA);
    const segundo: DadosBoletim = { armazemId: c.insumos.id, data: "2025-11-17", linhas: [{ tipoItemId: c.agro.id, descarga: "10" }], equipe: [{ matricula: "100", tipo: "completa" }] };
    expect(() => criarBoletim(t.db, segundo, AGORA)).toThrow(/O funcionário 100 já está no boletim do Adubo em 17\/11\/2025. Tire-o de um dos dois./);
    expect(t.db.select().from(schema.boletim).all()).toHaveLength(1);
    expect(t.db.select().from(schema.boletimLinha).all()).toHaveLength(3);
    expect(t.db.select().from(schema.boletimChapa).all()).toHaveLength(11);
  });

  it("B4: segundo boletim do mesmo armazém e dia; armazém sem faz_boletim; nada parcial", () => {
    const c = preparar();
    criarBoletim(t.db, t1(c), AGORA);
    const outro = { ...t1(c), equipe: equipe(120, 3) };
    expect(() => criarBoletim(t.db, outro, AGORA)).toThrow(/Já existe um boletim do Adubo/);
    const loja = { ...t1(c, "2025-11-17", c.loja.id), equipe: equipe(120, 3) };
    expect(() => criarBoletim(t.db, loja, AGORA)).toThrow(/não faz boletim/);
    expect(t.db.select().from(schema.boletim).all()).toHaveLength(1);
    expect(t.db.select().from(schema.boletimChapa).all()).toHaveLength(11);
  });

  it("T6, T7 e B3 pelo serviço: nada é gravado", () => {
    const c = preparar();
    expect(() => criarBoletim(t.db, { ...t1(c), equipe: [] }, AGORA)).toThrow(/pelo menos 1 funcionário/);
    expect(() => criarBoletim(t.db, { ...t1(c), equipe: equipe(100, 21) }, AGORA)).toThrow(/no máximo 20/);
    expect(() => criarBoletim(t.db, { ...t1(c), equipe: [{ matricula: "100", tipo: "completa" }, { matricula: "100", tipo: "meia" }] }, AGORA)).toThrow(/mais de uma vez/);
    expect(() => criarBoletim(t.db, { ...t1(c), equipe: [{ matricula: "9999", tipo: "completa" }] }, AGORA)).toThrow(/não está no cadastro/);
    expect(t.db.select().from(schema.boletim).all()).toHaveLength(0);
    expect(t.db.select().from(schema.boletimChapa).all()).toHaveLength(0);
  });

  it("B1: 20 funcionários aceitas", () => {
    const c = preparar();
    expect(criarBoletim(t.db, { ...t1(c), equipe: equipe(100, 20) }, AGORA).equipe).toHaveLength(20);
  });

  it("B5 e RF2-10: fechado recusa edição; reabrir e salvar de novo recalcula sem conflitar com a própria funcionário", () => {
    const c = preparar();
    const { id } = criarBoletim(t.db, t1(c), AGORA);
    fecharBoletim(t.db, id, AGORA);
    expect(() => salvarBoletim(t.db, id, t1(c), AGORA)).toThrow(/fechado/);
    expect(reabrirBoletim(t.db, id, AGORA).status).toBe("rascunho");
    const b = salvarBoletim(t.db, id, { ...t1(c), equipe: equipe(100, 11, true) }, "2025-11-17T19:00:00-03:00");
    expect(igual(b.totalAPagar, "946.81755")).toBe(true);
    expect(igual(b.complemento, "28.62235")).toBe(true);
    expect(igual(b.diariasEquivalentes, "10.5")).toBe(true);
    expect(b.atualizadoEm).toBe("2025-11-17T19:00:00-03:00");
    expect(b.equipe.filter((e) => e.tipo === "meia")).toHaveLength(1);
    expect(t.db.select().from(schema.boletimChapa).all()).toHaveLength(11);
    expect(t.db.select().from(schema.boletimLinha).all()).toHaveLength(3);
  });

  it("B5: salvar com funcionário de outro boletim do dia é recusado e mantém o anterior", () => {
    const c = preparar();
    const { id } = criarBoletim(t.db, t1(c), AGORA);
    const outro = criarBoletim(t.db, { armazemId: c.insumos.id, data: "2025-11-17", linhas: [{ tipoItemId: c.agro.id, descarga: "10" }], equipe: equipe(120, 2) }, AGORA);
    expect(() => salvarBoletim(t.db, outro.id, { armazemId: c.insumos.id, data: "2025-11-17", linhas: [], equipe: equipe(109, 2) }, AGORA)).toThrow(/O funcionário 109 já está no boletim do Adubo/);
    expect(lerBoletim(t.db, outro.id)!.equipe.map((e) => e.matricula)).toEqual(["120", "121"]);
    expect(lerBoletim(t.db, id)!.equipe).toHaveLength(11);
  });

  it("B5/RF2-08: boletim de sábado e de domingo", () => {
    const c = preparar();
    const sab = criarBoletim(t.db, { ...t1(c, "2025-11-22"), equipe: equipe(100, 3) }, AGORA);
    const dom = criarBoletim(t.db, { ...t1(c, "2025-11-23"), equipe: equipe(100, 3) }, AGORA);
    expect([sab.data, dom.data]).toEqual(["2025-11-22", "2025-11-23"]);
    expect(listarBoletins(t.db, { armazemId: c.adubo.id }).map((b) => b.data)).toEqual(["2025-11-23", "2025-11-22"]);
    expect(listarBoletins(t.db, { data: "2025-11-22" })).toHaveLength(1);
  });

  it("o mesmo funcionário pode ir em dias diferentes", () => {
    const c = preparar();
    criarBoletim(t.db, t1(c), AGORA);
    expect(() => criarBoletim(t.db, t1(c, "2025-11-18"), AGORA)).not.toThrow();
  });

  it("T11: linha Meia diária entra na produção", () => {
    const c = preparar();
    const meia = t.db.select().from(schema.tipoItem).all().find((x) => x.nome === "Meia diária")!;
    const b = criarBoletim(t.db, { armazemId: c.adubo.id, data: "2025-11-17", linhas: [{ tipoItemId: meia.id, descarga: "1" }], equipe: equipe(100, 1) }, AGORA);
    expect(igual(b.producaoTotal, "45.0786")).toBe(true);
    expect(formatNumero(b.producaoTotal)).toBe("45,08");
  });

  it("corrigir boletim antigo não é barrado por funcionário ou armazém que mudaram depois", () => {
    const c = preparar();
    const { id } = criarBoletim(t.db, t1(c), AGORA);
    t.db.update(schema.chapa).set({ ativo: false }).where(eq(schema.chapa.matricula, "100")).run();
    t.db.update(schema.armazem).set({ fazBoletim: false }).where(eq(schema.armazem.id, c.adubo.id)).run();
    expect(() => salvarBoletim(t.db, id, t1(c), AGORA)).not.toThrow();
    expect(() => criarBoletim(t.db, { ...t1(c, "2025-11-18"), equipe: equipe(100, 2) }, AGORA)).toThrow(/não faz boletim/);
  });
});
