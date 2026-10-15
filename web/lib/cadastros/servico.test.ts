import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { criarBoletim } from "@/lib/boletim/servico";
import { contarManutencao, listarEquipamentos, criarArmazem, criarChapa, criarEquipamento, editarArmazem, editarChapa, esquemaEquipamento, listarArmazens, listarChapas } from "./servico";

let t: TestDb;
afterEach(() => t?.apagar());

describe("cadastros", () => {
  it("faz_boletim muda o que o boletim aceita e persiste ao reabrir o arquivo", () => {
    t = createTestDb({ seed: true });
    criarChapa(t.db, { matricula: "1", nome: "CHAPA_01", armazemId: null, ativo: true });
    const tipo = t.db.select().from(schema.tipoItem).all()[0];
    const loja = listarArmazens(t.db).find((a) => a.nome === "Loja")!;
    const dados = { armazemId: loja.id, data: "2025-11-17", linhas: [{ tipoItemId: tipo.id, descarga: "10" }], equipe: [{ matricula: "1", tipo: "completa" as const }] };
    expect(() => criarBoletim(t.db, dados, "2025-11-17T18:00:00-03:00")).toThrow(/não faz boletim/);
    editarArmazem(t.db, loja.id, { nome: loja.nome, localFisico: loja.localFisico, fazBoletim: true, recebeDescarga: true, ativo: true });
    const db2 = t.reabrir();
    expect(listarArmazens(db2).find((a) => a.id === loja.id)!.fazBoletim).toBe(true);
    expect(() => criarBoletim(db2, dados, "2025-11-17T18:00:00-03:00")).not.toThrow();
  });

  it("nome do armazém e matrícula são únicos, com causa e correção", () => {
    t = createTestDb({ seed: true });
    expect(() => criarArmazem(t.db, { nome: " adubo ", localFisico: null, fazBoletim: true, recebeDescarga: true, ativo: true })).toThrow(/Já existe um armazém chamado Adubo/);
    criarChapa(t.db, { matricula: "158", nome: "CHAPA_08", armazemId: null, ativo: true });
    expect(() => criarChapa(t.db, { matricula: "158", nome: "CHAPA_99", armazemId: null, ativo: true })).toThrow(/matrícula 158 já é do funcionário CHAPA_08/);
    const outra = criarChapa(t.db, { matricula: "159", nome: "CHAPA_09", armazemId: null, ativo: true });
    expect(() => editarChapa(t.db, outra.id, { matricula: "158", nome: "CHAPA_09", armazemId: null, ativo: true })).toThrow(/já é do funcionário/);
    expect(listarChapas(t.db)).toHaveLength(2);
  });

  it("nada se apaga: funcionário inativa continua listada; equipamento com disponível entre 0 e a quantidade", () => {
    t = createTestDb({ seed: true });
    const c = criarChapa(t.db, { matricula: "5", nome: "CHAPA_05", armazemId: null, ativo: true });
    editarChapa(t.db, c.id, { matricula: "5", nome: "CHAPA_05", armazemId: null, ativo: false });
    expect(listarChapas(t.db)[0].ativo).toBe(false);
    const base = { armazemId: listarArmazens(t.db)[0].id, nome: "Paleteira", finalidade: null, quantidade: 2, indisponivelMotivo: null };
    expect(esquemaEquipamento.safeParse({ ...base, disponivel: 3 }).success).toBe(false);
    expect(esquemaEquipamento.safeParse({ ...base, disponivel: -1 }).success).toBe(false);
    const ok = esquemaEquipamento.parse({ ...base, disponivel: 0 });
    expect(criarEquipamento(t.db, ok).disponivel).toBe(0);
  });

  it("D47: boletim único com Todas as áreas e recebe_descarga editável", () => {
    t = createTestDb({ seed: true });
    criarChapa(t.db, { matricula: "1", nome: "CHAPA_01", armazemId: null, ativo: true });
    const tipo = t.db.select().from(schema.tipoItem).all()[0];
    const todas = listarArmazens(t.db).find((a) => a.nome === "Todas as áreas")!;
    expect(todas).toMatchObject({ ativo: false, fazBoletim: false, recebeDescarga: false });
    const dados = { armazemId: todas.id, data: "2025-11-17", linhas: [{ tipoItemId: tipo.id, descarga: "10" }], equipe: [{ matricula: "1", tipo: "completa" as const }] };
    expect(() => criarBoletim(t.db, dados, "2025-11-17T18:00:00-03:00")).toThrow(/não faz boletim/);
    editarArmazem(t.db, todas.id, { nome: todas.nome, localFisico: todas.localFisico, fazBoletim: true, recebeDescarga: false, ativo: true });
    for (const a of listarArmazens(t.db).filter((x) => x.id !== todas.id)) editarArmazem(t.db, a.id, { nome: a.nome, localFisico: a.localFisico, fazBoletim: false, recebeDescarga: true, ativo: a.ativo });
    const db2 = t.reabrir();
    expect(listarArmazens(db2).find((a) => a.id === todas.id)).toMatchObject({ fazBoletim: true, recebeDescarga: false, ativo: true });
    expect(criarBoletim(db2, dados, "2025-11-17T18:00:00-03:00").armazemNome).toBe("Todas as áreas");
    const adubo = listarArmazens(db2).find((a) => a.nome === "Adubo")!;
    expect(() => criarBoletim(db2, { ...dados, armazemId: adubo.id, equipe: [{ matricula: "1", tipo: "completa" }] }, "2025-11-17T18:00:00-03:00")).toThrow(/não faz boletim/);
  });

  it("equipamento tem status operacional ou manutenção; em manutenção vem primeiro na lista", () => {
    t = createTestDb({ seed: true });
    const base = { armazemId: listarArmazens(t.db)[0].id, finalidade: null, quantidade: 2, disponivel: 2, indisponivelMotivo: null };
    expect(esquemaEquipamento.parse({ ...base, nome: "A" }).status).toBe("operacional");
    expect(esquemaEquipamento.safeParse({ ...base, nome: "A", status: "quebrado" }).success).toBe(false);
    const a = criarEquipamento(t.db, esquemaEquipamento.parse({ ...base, nome: "AAA primeiro", status: "operacional" }));
    const b = criarEquipamento(t.db, esquemaEquipamento.parse({ ...base, nome: "ZZZ ultimo", status: "manutencao" }));
    expect(b.status).toBe("manutencao");
    const nomes = listarEquipamentos(t.db).map((e) => e.nome);
    expect(nomes.indexOf("ZZZ ultimo")).toBe(0);
    expect(a.status).toBe("operacional");
    expect(contarManutencao(t.db)).toBe(1);
    const db2 = t.reabrir();
    expect(listarEquipamentos(db2)[0]).toMatchObject({ nome: "ZZZ ultimo", status: "manutencao" });
  });
});
