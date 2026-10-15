import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { igual } from "@/lib/money";

import { schema } from "./index";
import { createTestDb, type TestDb } from "./testing";

let t: TestDb | undefined;
afterEach(() => {
  t?.apagar();
  t = undefined;
});

describe("createTestDb", () => {
  it("cria, grava, fecha, reabre e lê", () => {
    t = createTestDb();
    t.db
      .insert(schema.fornecedor)
      .values({ codigo: "FT000001", razaoSocial: "Fornecedor de teste", cnpj: "00000000000191", origem: "teste" })
      .run();
    t.reabrir();
    const lido = t.db.select().from(schema.fornecedor).where(eq(schema.fornecedor.codigo, "FT000001")).get();
    expect(lido?.razaoSocial).toBe("Fornecedor de teste");
  });

  it("com seed traz os cadastros fixos", () => {
    t = createTestDb({ seed: true });
    const { db } = t;
    const armazens = db.select().from(schema.armazem).all();
    expect(armazens.map((a) => a.nome)).toEqual(["Insumos", "Adubo", "Pátio de Máquinas", "Loja", "Todas as áreas"]);
    expect(armazens.filter((a) => a.fazBoletim).length).toBe(3);
    // D47: o boletim único começa desligado e não aparece como destino
    const todas = armazens.find((a) => a.nome === "Todas as áreas")!;
    expect([todas.ativo, todas.fazBoletim, todas.recebeDescarga]).toEqual([false, false, false]);
    expect(armazens.filter((a) => a.recebeDescarga).length).toBe(4);

    const tipos = db.select().from(schema.tipoItem).all();
    expect(tipos.length).toBe(16);
    expect(tipos.filter((x) => x.categoria === "diaria").length).toBe(2);
    expect(igual(tipos.find((x) => x.nome === "Fertilizantes")!.precoUnitario, "0.3224")).toBe(true);

    expect(db.select().from(schema.horarioGrade).all().map((h) => h.hora)).toEqual(["08:00", "10:00", "13:00", "15:00"]);
    expect(db.select().from(schema.feriado).all().length).toBe(6);
    expect(db.select().from(schema.parametro).where(eq(schema.parametro.chave, "piso_diaria")).get()?.valor).toBe("90.1731");
    expect(db.select().from(schema.normaChapas).all().length).toBe(8);
    expect(db.select().from(schema.grupoProduto).all().length).toBe(8);
    expect(db.select().from(schema.depositoArmazem).all().length).toBe(10);
    expect(db.select().from(schema.usuario).all().length).toBe(14);
    const equipamentos = db.select().from(schema.equipamento).all();
    expect(equipamentos.length).toBe(11);
    expect(equipamentos.every((e) => e.disponivel === e.quantidade)).toBe(true);
  });
});

describe("restrições do schema", () => {
  it("CHECK recusa enumeração inválida e chave estrangeira está ligada", () => {
    t = createTestDb({ seed: true });
    const { db } = t;
    expect(() => db.insert(schema.fornecedor).values({ razaoSocial: "x", origem: "inventada" as never }).run()).toThrow(/CHECK/);
    expect(() => db.insert(schema.boletimChapa).values({ boletimId: 999, chapaId: 999, data: "2026-10-05" }).run()).toThrow(
      /FOREIGN KEY/,
    );
  });

  it("um funcionário, um boletim por dia; um boletim por armazém e dia", () => {
    t = createTestDb({ seed: true });
    const { db } = t;
    const [insumos, adubo] = db.select().from(schema.armazem).all();
    const base = {
      data: "2026-10-05",
      producaoTotal: "0",
      diariasEquivalentes: "1",
      valorPorDiaria: "0",
      totalAPagar: "90.1731",
      complemento: "90.1731",
      pisoUsado: "90.1731",
      fatorMeiaUsado: "0.5",
      origem: "teste" as const,
      criadoEm: "2026-10-05T08:00:00-03:00",
    };
    const b1 = db.insert(schema.boletim).values({ ...base, armazemId: adubo.id }).returning().get();
    const b2 = db.insert(schema.boletim).values({ ...base, armazemId: insumos.id }).returning().get();
    expect(() => db.insert(schema.boletim).values({ ...base, armazemId: adubo.id }).run()).toThrow(/UNIQUE/);

    const chapa = db.insert(schema.chapa).values({ matricula: "158", nome: "CHAPA_08" }).returning().get();
    db.insert(schema.boletimChapa).values({ boletimId: b1.id, chapaId: chapa.id, data: base.data }).run();
    expect(() => db.insert(schema.boletimChapa).values({ boletimId: b2.id, chapaId: chapa.id, data: base.data }).run()).toThrow(
      /UNIQUE/,
    );
  });

  it("transação immediate desfaz tudo quando a regra recusa", () => {
    t = createTestDb({ seed: true });
    const { db } = t;
    expect(() =>
      db.transaction(
        (tx) => {
          tx.insert(schema.chapa).values({ matricula: "1", nome: "CHAPA_24" }).run();
          throw new Error("recusado");
        },
        { behavior: "immediate" },
      ),
    ).toThrow("recusado");
    expect(db.select().from(schema.chapa).all().length).toBe(0);
  });
});
