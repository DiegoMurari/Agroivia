import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { criarUsuario, desativarUsuario, excluirUsuario, listarUsuarios } from "./servico";

let t: TestDb;
afterEach(() => t?.apagar());
const AGORA = "2026-10-05T09:00:00-03:00";

function dois() {
  t = createTestDb({ seed: true });
  const a = criarUsuario(t.db, { nome: "Ana", email: "ana@agrovia.com.br", perfil: "adm_master" }, AGORA).usuario;
  const b = criarUsuario(t.db, { nome: "Beto", email: "beto@agrovia.com.br", perfil: "adm_master" }, AGORA).usuario;
  return { a, b };
}

describe("desativar e excluir contas", () => {
  it("ninguém desativa a própria conta, mesmo havendo outro Adm Master", () => {
    const { a } = dois();
    expect(() => desativarUsuario(t.db, a.id, a.id)).toThrow(/própria conta/);
    expect(listarUsuarios(t.db).find((u) => u.id === a.id)?.ativo).toBe(true);
  });

  it("um Adm Master pode desativar o outro", () => {
    const { a, b } = dois();
    expect(desativarUsuario(t.db, b.id, a.id).ativo).toBe(false);
  });

  it("ninguém exclui a própria conta", () => {
    const { a } = dois();
    expect(() => excluirUsuario(t.db, a.id, a.id)).toThrow(/própria conta/);
  });

  it("exclui uma conta sem histórico", () => {
    const { a, b } = dois();
    excluirUsuario(t.db, b.id, a.id);
    expect(listarUsuarios(t.db).some((u) => u.id === b.id)).toBe(false);
  });

  it("não exclui o último Adm Master ativo", () => {
    t = createTestDb({ seed: true });
    const a = criarUsuario(t.db, { nome: "Ana", email: "ana@agrovia.com.br", perfil: "adm_master" }, AGORA).usuario;
    const c = criarUsuario(t.db, { nome: "Caio", email: "caio@agrovia.com.br", perfil: "compras" }, AGORA).usuario;
    // o seed pode trazer outro Adm Master: aqui a Ana precisa ser a única ativa
    for (const u of listarUsuarios(t.db).filter((x) => x.perfil === "adm_master" && x.id !== a.id)) t.db.update(schema.usuario).set({ ativo: false }).where(eq(schema.usuario.id, u.id)).run();
    expect(() => excluirUsuario(t.db, a.id, c.id)).toThrow(/último Adm Master/);
  });

  it("conta com histórico não é excluída: a auditoria fica", () => {
    const { a, b } = dois();
    t.db.insert(schema.conviteFornecedor).values({ token: "tok-historico", criadoPor: b.id, criadoEm: AGORA }).run();
    expect(() => excluirUsuario(t.db, b.id, a.id)).toThrow(/histórico/);
    expect(listarUsuarios(t.db).some((u) => u.id === b.id)).toBe(true);
  });
});
