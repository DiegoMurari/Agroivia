import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { conferirSenha, hashSenha } from "@/lib/senha";
import { criarUsuario, desativarUsuario, editarUsuario, listarUsuarios, reativarUsuario, redefinirSenha } from "./servico";

let t: TestDb;
afterEach(() => t?.apagar());
const AGORA = "2026-10-03T20:00:00-03:00";

const adm = () => listarUsuarios(t.db).find((u) => u.email === "adm@agrovia.com.br")!;
const compras = () => listarUsuarios(t.db).find((u) => u.email === "compras@agrovia.com.br")!;

describe("usuários (Adm Master)", () => {
  it("lista só as contas da Agrovia (Compras, Adm Master, Portaria, Gestor de armazém), nunca fornecedor", () => {
    t = createTestDb({ seed: true });
    const lista = listarUsuarios(t.db);
    expect(lista.map((u) => u.email).sort()).toEqual(["adm@agrovia.com.br", "armazem@agrovia.com.br", "compras@agrovia.com.br", "portaria@agrovia.com.br"]);
    expect(lista[0]).not.toHaveProperty("senhaHash");
  });

  it("cria conta com link de primeiro acesso (token com validade) e sem senha ainda", () => {
    t = createTestDb({ seed: true });
    const r = criarUsuario(t.db, { nome: " Maria ", email: " Maria@Agrovia.com.br ", perfil: "compras" }, AGORA);
    expect(r.usuario).toMatchObject({ nome: "Maria", email: "maria@agrovia.com.br", perfil: "compras", ativo: true, trocarSenha: true });
    expect(r.link).toBe(`/senha/${r.token}`);
    const linha = t.db.select().from(schema.usuario).where(eq(schema.usuario.id, r.usuario.id)).get()!;
    expect(linha.tokenSenha).toBe(r.token);
    expect(linha.tokenSenhaExpira! > AGORA).toBe(true);
    expect(conferirSenha("qualquer coisa", linha.senhaHash)).toBe(false);
    expect(linha.criadoEm).toBe(AGORA);
  });

  it("cria conta de Portaria e de Gestor de armazém com o papel certo; fornecedor segue recusado", () => {
    t = createTestDb({ seed: true });
    const p = criarUsuario(t.db, { nome: "Pedro", email: "portaria1@agrovia.com.br", perfil: "portaria" }, AGORA);
    const g = criarUsuario(t.db, { nome: "Gil", email: "gestor1@agrovia.com.br", perfil: "armazem" }, AGORA);
    const c = criarUsuario(t.db, { nome: "Cris", email: "cris@agrovia.com.br", perfil: "compras" }, AGORA);
    const papel = (id: number) => t.db.select().from(schema.usuario).where(eq(schema.usuario.id, id)).get()!.papel;
    expect(p.usuario.perfil).toBe("portaria");
    expect(papel(p.usuario.id)).toBe("portaria");
    expect(g.usuario.perfil).toBe("armazem");
    expect(papel(g.usuario.id)).toBe("responsavel");
    expect(papel(c.usuario.id)).toBe("compras");
    expect(listarUsuarios(t.db).map((u) => u.email)).toEqual(expect.arrayContaining(["portaria1@agrovia.com.br", "gestor1@agrovia.com.br"]));
    expect(() => criarUsuario(t.db, { nome: "X", email: "forn@x.com.br", perfil: "fornecedor" as never }, AGORA)).toThrow(/perfil/i);
  });

  it("e-mail repetido (qualquer caixa) e perfil inválido são recusados com a causa", () => {
    t = createTestDb({ seed: true });
    expect(() => criarUsuario(t.db, { nome: "X", email: "ADM@agrovia.com.br", perfil: "compras" }, AGORA)).toThrow(/já tem uma conta/);
    expect(() => criarUsuario(t.db, { nome: "X", email: "x@agrovia.com.br", perfil: "fornecedor" as never }, AGORA)).toThrow(/perfil/i);
    expect(() => criarUsuario(t.db, { nome: "X", email: "sem-arroba", perfil: "compras" }, AGORA)).toThrow(/e-mail/i);
    expect(listarUsuarios(t.db)).toHaveLength(4);
  });

  it("edita nome, e-mail e perfil; e-mail de outro usuário é recusado", () => {
    t = createTestDb({ seed: true });
    const c = compras();
    const novo = editarUsuario(t.db, c.id, { nome: "Compras Nova", email: "compras2@agrovia.com.br", perfil: "adm_master" });
    expect(novo).toMatchObject({ nome: "Compras Nova", email: "compras2@agrovia.com.br", perfil: "adm_master" });
    expect(() => editarUsuario(t.db, c.id, { nome: "A", email: "adm@agrovia.com.br", perfil: "compras" })).toThrow(/já tem uma conta/);
    expect(() => editarUsuario(t.db, 99999, { nome: "A", email: "a@a.com", perfil: "compras" })).toThrow(/não encontrado/);
  });

  it("sempre há pelo menos um Adm Master ativo: bloqueia desativar e rebaixar o último", () => {
    t = createTestDb({ seed: true });
    const a = adm();
    expect(() => desativarUsuario(t.db, a.id)).toThrow(/último Adm Master/);
    expect(() => editarUsuario(t.db, a.id, { nome: a.nome, email: a.email, perfil: "compras" })).toThrow(/último Adm Master/);
    expect(adm()).toMatchObject({ ativo: true, perfil: "adm_master" });
    // com outro Adm Master ativo, pode desativar o primeiro
    editarUsuario(t.db, compras().id, { nome: "Compras", email: "compras@agrovia.com.br", perfil: "adm_master" });
    expect(desativarUsuario(t.db, a.id).ativo).toBe(false);
    // agora o outro é o último
    expect(() => desativarUsuario(t.db, compras().id)).toThrow(/último Adm Master/);
    // reativar é sempre permitido
    expect(reativarUsuario(t.db, a.id).ativo).toBe(true);
  });

  it("desativar e reativar compras nunca exclui; ativo fica gravado no arquivo", () => {
    t = createTestDb({ seed: true });
    const c = compras();
    expect(desativarUsuario(t.db, c.id).ativo).toBe(false);
    const db2 = t.reabrir();
    expect(listarUsuarios(db2).find((u) => u.id === c.id)).toMatchObject({ ativo: false });
    expect(reativarUsuario(db2, c.id).ativo).toBe(true);
  });

  it("redefinir senha gera novo link, exige troca e invalida a senha antiga só quando a nova for definida", () => {
    t = createTestDb({ seed: true });
    const c = compras();
    t.db.update(schema.usuario).set({ senhaHash: hashSenha("antiga123") }).where(eq(schema.usuario.id, c.id)).run();
    const r = redefinirSenha(t.db, c.id, AGORA);
    expect(r.link).toBe(`/senha/${r.token}`);
    const linha = t.db.select().from(schema.usuario).where(eq(schema.usuario.id, c.id)).get()!;
    expect(linha).toMatchObject({ trocarSenha: true, tokenSenha: r.token });
    expect(linha.tokenSenhaExpira! > AGORA).toBe(true);
    expect(conferirSenha("antiga123", linha.senhaHash)).toBe(true);
    const r2 = redefinirSenha(t.db, c.id, AGORA);
    expect(r2.token).not.toBe(r.token);
  });
});
