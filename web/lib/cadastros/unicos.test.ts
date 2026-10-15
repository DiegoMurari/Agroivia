import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { criarEquipamento, editarEquipamento, garantirEquipamentosUnicos, listarArmazens, listarEquipamentos } from "./servico";

let t: TestDb;
afterEach(() => t?.apagar());

describe("equipamentos únicos", () => {
  it("separa a linha com quantidade maior em uma linha por unidade, sem mexer em quem já é único", () => {
    t = createTestDb({ seed: true });
    const antes = listarEquipamentos(t.db);
    const total = antes.reduce((s, e) => s + e.quantidade, 0);
    const criados = garantirEquipamentosUnicos(t.db);
    const depois = listarEquipamentos(t.db);
    expect(depois).toHaveLength(total);
    expect(criados).toBe(total - antes.length);
    expect(depois.every((e) => e.quantidade === 1)).toBe(true);
    expect(depois.filter((e) => e.nome?.startsWith("Trator"))).toHaveLength(4);
    expect(depois.find((e) => e.nome === "Trator 01")).toBeTruthy();
  });

  it("é idempotente", () => {
    t = createTestDb({ seed: true });
    garantirEquipamentosUnicos(t.db);
    expect(garantirEquipamentosUnicos(t.db)).toBe(0);
  });

  it("unidade nova herda a situação: em manutenção, nenhuma fica disponível", () => {
    t = createTestDb({ seed: true });
    const trator = listarEquipamentos(t.db).find((e) => e.nome === "Trator")!;
    t.db.update(schema.equipamento).set({ status: "manutencao", disponivel: 0, indisponivelMotivo: "Troca de pneus" }).where(eqId(trator.id)).run();
    garantirEquipamentosUnicos(t.db);
    const tratores = listarEquipamentos(t.db).filter((e) => e.nome?.startsWith("Trator"));
    expect(tratores.every((e) => e.status === "manutencao" && e.disponivel === 0)).toBe(true);
  });

  it("nome repetido no mesmo armazém é recusado; em outro armazém pode", () => {
    t = createTestDb({ seed: true });
    const [a, b] = listarArmazens(t.db);
    const dados = { armazemId: a.id, nome: "Empilhadeira 77", finalidade: null, quantidade: 1, disponivel: 1, indisponivelMotivo: null, status: "operacional" as const };
    const primeiro = criarEquipamento(t.db, dados);
    expect(() => criarEquipamento(t.db, { ...dados, nome: " empilhadeira 77 " })).toThrow(/Já existe um equipamento/);
    expect(() => criarEquipamento(t.db, { ...dados, armazemId: b.id })).not.toThrow();
    // editar o próprio equipamento com o mesmo nome é permitido
    expect(() => editarEquipamento(t.db, primeiro.id, dados)).not.toThrow();
  });
});

import { eq } from "drizzle-orm";
const eqId = (id: number) => eq(schema.equipamento.id, id);
