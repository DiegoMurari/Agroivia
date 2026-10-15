import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { ErroDeRegra } from "@/lib/http";
import { SENHA_MINIMA, conferirSenha } from "@/lib/senha";
import {
  cadastrarFornecedor,
  cnpjValido,
  conviteDoToken,
  criarConvite,
  decidirCadastro,
  emailValido,
  listarPendencias,
  solicitarAlteracao,
} from "./cadastro";

let t: TestDb;
afterEach(() => t?.apagar());

const AGORA = "2026-10-03T10:00:00.000Z";
const DEPOIS = "2026-10-04T12:00:00.000Z";

const CNPJ_A = "11222333000181";
const CNPJ_B = "45997418000153";

/** Gera um CNPJ válido a partir de 12 dígitos-base (para fixtures). */
function gerarCnpj(base12: string): string {
  const dv = (digs: string) => {
    const pesos = digs.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...digs].reduce((s, d, i) => s + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base12);
  const d2 = dv(base12 + d1);
  return `${base12}${d1}${d2}`;
}
const CNPJ_C = gerarCnpj("123456780001");

function montar() {
  t = createTestDb({ seed: true });
  const db = t.db;
  // O seed traz um log de aprovação do cadastro demo; os testes partem das tabelas de decisão vazias
  db.delete(schema.logAprovacao).run();
  db.delete(schema.notificacao).run();
  const usuarioPorEmail = (email: string) => db.select().from(schema.usuario).where(eq(schema.usuario.email, email)).get()!;
  const adm = usuarioPorEmail("adm@agrovia.com.br");
  const compras = usuarioPorEmail("compras@agrovia.com.br");
  const aprovado = usuarioPorEmail("fornecedor@demo.com.br");
  const pendente = usuarioPorEmail("pendente@demo.com.br");
  const cadastroDe = (usuarioId: number) =>
    db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.usuarioId, usuarioId)).get()!;
  return { db, adm, compras, aprovado, pendente, usuarioPorEmail, cadastroDe };
}

function dadosValidos(extra: Record<string, unknown> = {}) {
  return {
    razaoSocial: "Agro Novo Ltda",
    nomeFantasia: "Agro Novo",
    cnpj: CNPJ_A,
    inscricaoEstadual: "123456",
    email: "Novo@Agro.com.br",
    telefone: "16999990000",
    responsavel: "Maria",
    endereco: "Rua 1, 100",
    tiposMercadoria: ["adubo", "insumos"],
    senha: "senhaforte123",
    ...extra,
  };
}

function erroDe(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErroDeRegra);
    return e as ErroDeRegra;
  }
  throw new Error("esperava ErroDeRegra, mas nada foi lançado");
}

describe("cnpjValido", () => {
  it.each([CNPJ_A, "11.222.333/0001-81", CNPJ_B, CNPJ_C])("aceita %s", (c) => {
    expect(cnpjValido(c)).toBe(true);
  });

  it.each(["11222333000182", "123", "", "11111111111111", "00000000000000", "1122233300018", "112223330001811", "abcdefghijklmn"])(
    "rejeita %j",
    (c) => {
      expect(cnpjValido(c)).toBe(false);
    },
  );
});

describe("emailValido", () => {
  it.each(["a@b.com", "nome.sobrenome@empresa.com.br"])("aceita %s", (e) => {
    expect(emailValido(e)).toBe(true);
  });
  it.each(["", "semarroba", "a@", "@b.com", "a b@c.com", "a@b"])("rejeita %j", (e) => {
    expect(emailValido(e)).toBe(false);
  });
});

describe("criarConvite e conviteDoToken", () => {
  it("grava o convite com token único, criador e data", () => {
    const { db, compras } = montar();
    const a = criarConvite(db, compras.id, AGORA);
    const b = criarConvite(db, compras.id, AGORA);
    expect(a.token).toBeTruthy();
    expect(a.token).not.toBe(b.token);
    const linha = db.select().from(schema.conviteFornecedor).where(eq(schema.conviteFornecedor.id, a.id)).get()!;
    expect(linha.token).toBe(a.token);
    expect(linha.criadoPor).toBe(compras.id);
    expect(linha.criadoEm).toBe(AGORA);
    expect(linha.usadoEm).toBeNull();
  });

  it("conviteDoToken devolve não usado para convite novo e null para token desconhecido", () => {
    const { db, compras } = montar();
    const c = criarConvite(db, compras.id, AGORA);
    expect(conviteDoToken(db, c.token)).toEqual({ id: c.id, usado: false });
    expect(conviteDoToken(db, "nao-existe")).toBeNull();
    expect(conviteDoToken(db, "")).toBeNull();
  });
});

describe("cadastrarFornecedor", () => {
  it("cria usuário fornecedor, cadastro pendente e consome o convite", () => {
    const { db, compras } = montar();
    const c = criarConvite(db, compras.id, AGORA);
    const r = cadastrarFornecedor(db, c.token, dadosValidos({ cnpj: "11.222.333/0001-81" }), DEPOIS);

    const u = db.select().from(schema.usuario).where(eq(schema.usuario.id, r.usuarioId)).get()!;
    expect(u.perfil).toBe("fornecedor");
    expect(u.papel).toBe("fornecedor");
    expect(u.ativo).toBe(true);
    expect(u.email).toBe("novo@agro.com.br");
    expect(u.nome).toBe("Agro Novo Ltda");
    expect(conferirSenha("senhaforte123", u.senhaHash)).toBe(true);
    expect(conferirSenha("outra-senha-1", u.senhaHash)).toBe(false);

    const cad = db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.id, r.cadastroId)).get()!;
    expect(cad.usuarioId).toBe(r.usuarioId);
    expect(cad.status).toBe("pendente");
    expect(cad.cnpj).toBe(CNPJ_A);
    expect(cad.cnpj).toHaveLength(14);
    expect(cad.cnpj).toMatch(/^\d{14}$/);
    expect(cad.razaoSocial).toBe("Agro Novo Ltda");
    expect(cad.nomeFantasia).toBe("Agro Novo");
    expect(cad.inscricaoEstadual).toBe("123456");
    expect(cad.telefone).toBe("16999990000");
    expect(cad.responsavel).toBe("Maria");
    expect(cad.endereco).toBe("Rua 1, 100");
    expect(JSON.parse(cad.tiposMercadoria!)).toEqual(["adubo", "insumos"]);
    expect(cad.alteracaoPendente).toBeNull();

    const conv = db.select().from(schema.conviteFornecedor).where(eq(schema.conviteFornecedor.id, c.id)).get()!;
    expect(conv.usadoEm).toBe(DEPOIS);
    expect(conviteDoToken(db, c.token)).toEqual({ id: c.id, usado: true });
  });

  it("aceita só os campos obrigatórios", () => {
    const { db, compras } = montar();
    const c = criarConvite(db, compras.id, AGORA);
    const r = cadastrarFornecedor(
      db,
      c.token,
      { razaoSocial: "Mínima SA", cnpj: CNPJ_B, email: "min@x.com", tiposMercadoria: ["loja"], senha: "12345678" },
      AGORA,
    );
    expect(r.cadastroId).toBeGreaterThan(0);
  });

  it("reusar o mesmo token depois de sucesso falha e não cria outro usuário", () => {
    const { db, compras } = montar();
    const c = criarConvite(db, compras.id, AGORA);
    cadastrarFornecedor(db, c.token, dadosValidos(), AGORA);
    const antes = db.select().from(schema.usuario).all().length;
    const e = erroDe(() => cadastrarFornecedor(db, c.token, dadosValidos({ cnpj: CNPJ_B, email: "outro@x.com" }), AGORA));
    expect([400, 409]).toContain(e.status);
    expect(db.select().from(schema.usuario).all().length).toBe(antes);
  });

  it("token inexistente falha", () => {
    const { db } = montar();
    const e = erroDe(() => cadastrarFornecedor(db, "token-falso", dadosValidos(), AGORA));
    expect([400, 409]).toContain(e.status);
  });

  describe("validações (atomicidade: não consome convite nem cria usuário)", () => {
    const casos: Array<[string, Record<string, unknown>, string, number?]> = [
      ["cnpj inválido", { cnpj: "11222333000182" }, "cnpj", 400],
      ["cnpj vazio", { cnpj: "" }, "cnpj", 400],
      ["e-mail inválido", { email: "sem-arroba" }, "email", 400],
      ["senha curta", { senha: "x".repeat(SENHA_MINIMA - 1) }, "senha", 400],
      ["razão social vazia", { razaoSocial: "   " }, "razaoSocial", 400],
      ["tipos de mercadoria vazio", { tiposMercadoria: [] }, "tiposMercadoria", 400],
      ["e-mail já cadastrado", { email: "Fornecedor@Demo.com.br" }, "email", 409],
      ["CNPJ já cadastrado (seed, com pontuação)", { cnpj: "99.999.999/0001-91" }, "cnpj", 409],
    ];

    it.each(casos)("%s", (_nome, extra, campo, status) => {
      const { db, compras } = montar();
      const c = criarConvite(db, compras.id, AGORA);
      const usuariosAntes = db.select().from(schema.usuario).all().length;
      const cadastrosAntes = db.select().from(schema.fornecedorCadastro).all().length;

      const e = erroDe(() => cadastrarFornecedor(db, c.token, dadosValidos(extra), DEPOIS));
      expect(e.campos).toBeDefined();
      expect(Object.keys(e.campos!)).toContain(campo);
      if (status) expect(e.status).toBe(status);

      expect(db.select().from(schema.usuario).all().length).toBe(usuariosAntes);
      expect(db.select().from(schema.fornecedorCadastro).all().length).toBe(cadastrosAntes);
      expect(conviteDoToken(db, c.token)).toEqual({ id: c.id, usado: false });

      // O convite continua utilizável com dados corrigidos.
      const ok = cadastrarFornecedor(db, c.token, dadosValidos({ cnpj: CNPJ_C, email: "corrigido@x.com" }), DEPOIS);
      expect(ok.usuarioId).toBeGreaterThan(0);
    });

    it("CNPJ já cadastrado em cadastro criado pelo próprio fluxo", () => {
      const { db, compras } = montar();
      const c1 = criarConvite(db, compras.id, AGORA);
      const c2 = criarConvite(db, compras.id, AGORA);
      cadastrarFornecedor(db, c1.token, dadosValidos(), AGORA);
      const e = erroDe(() => cadastrarFornecedor(db, c2.token, dadosValidos({ email: "outro@x.com", cnpj: "11.222.333/0001-81" }), AGORA));
      expect(e.status).toBe(409);
      expect(e.campos).toHaveProperty("cnpj");
    });
  });
});

describe("listarPendencias", () => {
  it("separa novos (pendente) de alterações (aprovado com alteração pendente)", () => {
    const { db, pendente, aprovado, cadastroDe } = montar();
    let r = listarPendencias(db);
    expect(r.novos.map((n) => n.id)).toEqual([cadastroDe(pendente.id).id]);
    expect(r.alteracoes).toEqual([]);

    const cadAprovado = cadastroDe(aprovado.id);
    db.update(schema.fornecedorCadastro)
      .set({ alteracaoPendente: JSON.stringify({ razaoSocial: "Nome Novo" }) })
      .where(eq(schema.fornecedorCadastro.id, cadAprovado.id))
      .run();

    r = listarPendencias(db);
    expect(r.novos).toHaveLength(1);
    expect(r.alteracoes).toHaveLength(1);
    const item = r.alteracoes[0];
    expect(item.id).toBe(cadAprovado.id);
    expect(item.razaoSocial).toBe(cadAprovado.razaoSocial);
    expect(item.cnpj).toBe("99999999000191");
    expect(item.email).toBe("fornecedor@demo.com.br");
    expect(item.alteracao).toEqual({ razaoSocial: "Nome Novo" });
    expect(r.novos[0].alteracao).toBeNull();
    expect(r.novos[0].cnpj).toBe("99999999000272");
  });

  it("não lista recusados nem aprovados sem alteração", () => {
    const { db, pendente, cadastroDe } = montar();
    db.update(schema.fornecedorCadastro)
      .set({ status: "recusado" })
      .where(eq(schema.fornecedorCadastro.id, cadastroDe(pendente.id).id))
      .run();
    expect(listarPendencias(db)).toEqual({ novos: [], alteracoes: [] });
  });
});

describe("decidirCadastro", () => {
  it("aprova cadastro novo, grava log e notifica o fornecedor", () => {
    const { db, pendente, compras, cadastroDe } = montar();
    const cad = cadastroDe(pendente.id);
    decidirCadastro(db, cad.id, "aprovado", compras.id, AGORA, "ok");

    const depois = cadastroDe(pendente.id);
    expect(depois.status).toBe("aprovado");
    expect(depois.decididoPor).toBe(compras.id);
    expect(depois.decididoEm).toBe(AGORA);

    const logs = db.select().from(schema.logAprovacao).where(eq(schema.logAprovacao.alvoId, cad.id)).all();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ alvo: "cadastro", decisao: "aprovado", usuarioId: compras.id, criadoEm: AGORA });

    const notas = db.select().from(schema.notificacao).where(eq(schema.notificacao.usuarioId, pendente.id)).all();
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({ tipo: "cadastro_aprovado", link: "/fornecedor", lida: false });
    expect(listarPendencias(db).novos).toEqual([]);
  });

  it("aprova sem comentário", () => {
    const { db, pendente, compras, cadastroDe } = montar();
    decidirCadastro(db, cadastroDe(pendente.id).id, "aprovado", compras.id, AGORA);
    expect(cadastroDe(pendente.id).status).toBe("aprovado");
  });

  it("recusa cadastro novo com motivo", () => {
    const { db, pendente, compras, cadastroDe } = montar();
    const cad = cadastroDe(pendente.id);
    decidirCadastro(db, cad.id, "recusado", compras.id, AGORA, "CNPJ divergente");

    const depois = cadastroDe(pendente.id);
    expect(depois.status).toBe("recusado");
    expect(depois.motivoRecusa).toBe("CNPJ divergente");
    expect(depois.decididoPor).toBe(compras.id);
    expect(depois.decididoEm).toBe(AGORA);

    const log = db.select().from(schema.logAprovacao).where(eq(schema.logAprovacao.alvoId, cad.id)).get()!;
    expect(log).toMatchObject({ decisao: "recusado", comentario: "CNPJ divergente" });
    const nota = db.select().from(schema.notificacao).where(eq(schema.notificacao.usuarioId, pendente.id)).get()!;
    expect(nota.tipo).toBe("cadastro_recusado");
    expect(nota.link).toBe("/fornecedor");
    expect(nota.mensagem).toContain("CNPJ divergente");
  });

  it.each([undefined, "", "   "])("recusar sem comentário (%j) falha e não altera nada", (comentario) => {
    const { db, pendente, compras, cadastroDe } = montar();
    const cad = cadastroDe(pendente.id);
    const e = erroDe(() => decidirCadastro(db, cad.id, "recusado", compras.id, AGORA, comentario));
    expect(e.campos).toHaveProperty("comentario");
    expect(cadastroDe(pendente.id).status).toBe("pendente");
    expect(db.select().from(schema.logAprovacao).all()).toHaveLength(0);
    expect(db.select().from(schema.notificacao).all()).toHaveLength(0);
  });

  it("cadastro inexistente falha", () => {
    const { db, compras } = montar();
    erroDe(() => decidirCadastro(db, 99999, "aprovado", compras.id, AGORA));
  });

  it("aprovado sem alteração e recusado não têm nada a decidir", () => {
    const { db, aprovado, pendente, compras, cadastroDe } = montar();
    erroDe(() => decidirCadastro(db, cadastroDe(aprovado.id).id, "aprovado", compras.id, AGORA));
    erroDe(() => decidirCadastro(db, cadastroDe(aprovado.id).id, "recusado", compras.id, AGORA, "x"));

    decidirCadastro(db, cadastroDe(pendente.id).id, "recusado", compras.id, AGORA, "motivo");
    erroDe(() => decidirCadastro(db, cadastroDe(pendente.id).id, "aprovado", compras.id, AGORA));
    // só a decisão válida deixou rastro
    expect(db.select().from(schema.logAprovacao).all()).toHaveLength(1);
  });

  describe("alteração pendente", () => {
    const alteracao = {
      razaoSocial: "Razão Alterada SA",
      nomeFantasia: "Alterada",
      cnpj: "11.222.333/0001-81",
      inscricaoEstadual: "999",
      email: "novo-email@demo.com.br",
      telefone: "1633334444",
      responsavel: "João",
      endereco: "Av. Nova, 5",
      tiposMercadoria: ["loja"],
    };

    function comAlteracao() {
      const ctx = montar();
      const cad = ctx.cadastroDe(ctx.aprovado.id);
      ctx.db
        .update(schema.fornecedorCadastro)
        .set({ alteracaoPendente: JSON.stringify(alteracao) })
        .where(eq(schema.fornecedorCadastro.id, cad.id))
        .run();
      return { ...ctx, antes: cad };
    }

    it("aprovar aplica os campos, zera a alteração e mantém aprovado", () => {
      const { db, aprovado, compras, cadastroDe, antes } = comAlteracao();
      decidirCadastro(db, antes.id, "aprovado", compras.id, DEPOIS);

      const d = cadastroDe(aprovado.id);
      expect(d.status).toBe("aprovado");
      expect(d.alteracaoPendente).toBeNull();
      expect(d.razaoSocial).toBe("Razão Alterada SA");
      expect(d.nomeFantasia).toBe("Alterada");
      expect(d.cnpj).toBe(CNPJ_A);
      expect(d.cnpj).toHaveLength(14);
      expect(d.inscricaoEstadual).toBe("999");
      expect(d.email).toBe("novo-email@demo.com.br");
      expect(d.telefone).toBe("1633334444");
      expect(d.responsavel).toBe("João");
      expect(d.endereco).toBe("Av. Nova, 5");
      expect(JSON.parse(d.tiposMercadoria!)).toEqual(["loja"]);

      const log = db.select().from(schema.logAprovacao).where(eq(schema.logAprovacao.alvoId, antes.id)).get()!;
      expect(log).toMatchObject({ alvo: "cadastro", decisao: "aprovado", usuarioId: compras.id });
      const nota = db.select().from(schema.notificacao).where(eq(schema.notificacao.usuarioId, aprovado.id)).get()!;
      expect(nota).toMatchObject({ tipo: "cadastro_aprovado", link: "/fornecedor" });
      expect(listarPendencias(db).alteracoes).toEqual([]);
    });

    it("aprovar alteração parcial só muda os campos informados", () => {
      const ctx = montar();
      const cad = ctx.cadastroDe(ctx.aprovado.id);
      ctx.db
        .update(schema.fornecedorCadastro)
        .set({ alteracaoPendente: JSON.stringify({ telefone: "11" }) })
        .where(eq(schema.fornecedorCadastro.id, cad.id))
        .run();
      decidirCadastro(ctx.db, cad.id, "aprovado", ctx.compras.id, AGORA);
      const d = ctx.cadastroDe(ctx.aprovado.id);
      expect(d.telefone).toBe("11");
      expect(d.razaoSocial).toBe(cad.razaoSocial);
      expect(d.cnpj).toBe(cad.cnpj);
      expect(d.email).toBe(cad.email);
    });

    it("recusar zera a alteração, mantém dados atuais e status aprovado, e notifica com o comentário", () => {
      const { db, aprovado, compras, cadastroDe, antes } = comAlteracao();
      decidirCadastro(db, antes.id, "recusado", compras.id, DEPOIS, "documento ilegível");

      const d = cadastroDe(aprovado.id);
      expect(d.status).toBe("aprovado");
      expect(d.alteracaoPendente).toBeNull();
      expect(d.razaoSocial).toBe(antes.razaoSocial);
      expect(d.cnpj).toBe(antes.cnpj);
      expect(d.email).toBe(antes.email);
      expect(d.tiposMercadoria).toBe(antes.tiposMercadoria);

      const log = db.select().from(schema.logAprovacao).where(eq(schema.logAprovacao.alvoId, antes.id)).get()!;
      expect(log).toMatchObject({ decisao: "recusado", comentario: "documento ilegível" });
      const nota = db.select().from(schema.notificacao).where(eq(schema.notificacao.usuarioId, aprovado.id)).get()!;
      expect(nota.tipo).toBe("cadastro_recusado");
      expect(nota.mensagem).toContain("documento ilegível");
    });

    it("recusar alteração sem comentário falha e preserva a alteração", () => {
      const { db, aprovado, compras, cadastroDe, antes } = comAlteracao();
      const e = erroDe(() => decidirCadastro(db, antes.id, "recusado", compras.id, DEPOIS));
      expect(e.campos).toHaveProperty("comentario");
      expect(cadastroDe(aprovado.id).alteracaoPendente).not.toBeNull();
    });
  });
});

describe("solicitarAlteracao", () => {
  it("grava só os campos informados em alteracaoPendente sem mudar os dados atuais", () => {
    const { db, aprovado, cadastroDe } = montar();
    const antes = cadastroDe(aprovado.id);
    solicitarAlteracao(db, aprovado.id, { telefone: "1630000000", cnpj: "11.222.333/0001-81" }, AGORA);

    const d = cadastroDe(aprovado.id);
    expect(JSON.parse(d.alteracaoPendente!)).toEqual({ telefone: "1630000000", cnpj: CNPJ_A });
    expect(d.telefone).toBe(antes.telefone);
    expect(d.cnpj).toBe(antes.cnpj);
    expect(d.razaoSocial).toBe(antes.razaoSocial);
    expect(d.status).toBe("aprovado");
    expect(listarPendencias(db).alteracoes.map((a) => a.id)).toEqual([antes.id]);
  });

  it("nova solicitação substitui a anterior", () => {
    const { db, aprovado, cadastroDe } = montar();
    solicitarAlteracao(db, aprovado.id, { telefone: "1" }, AGORA);
    solicitarAlteracao(db, aprovado.id, { responsavel: "Ana" }, DEPOIS);
    expect(JSON.parse(cadastroDe(aprovado.id).alteracaoPendente!)).toEqual({ responsavel: "Ana" });
  });

  it("aceita manter o próprio CNPJ e e-mail (não conflita consigo mesmo)", () => {
    const { db, aprovado, cadastroDe } = montar();
    const antes = cadastroDe(aprovado.id);
    expect(() => solicitarAlteracao(db, aprovado.id, { cnpj: antes.cnpj, email: antes.email, razaoSocial: "Outra" }, AGORA)).not.toThrow();
  });

  it("recusa cadastro pendente e cadastro recusado", () => {
    const { db, pendente, compras, cadastroDe } = montar();
    erroDe(() => solicitarAlteracao(db, pendente.id, { telefone: "1" }, AGORA));
    decidirCadastro(db, cadastroDe(pendente.id).id, "recusado", compras.id, AGORA, "motivo");
    erroDe(() => solicitarAlteracao(db, pendente.id, { telefone: "1" }, AGORA));
    expect(cadastroDe(pendente.id).alteracaoPendente).toBeNull();
  });

  it("recusa quem não é fornecedor", () => {
    const { db, compras, adm } = montar();
    erroDe(() => solicitarAlteracao(db, compras.id, { telefone: "1" }, AGORA));
    erroDe(() => solicitarAlteracao(db, adm.id, { telefone: "1" }, AGORA));
    erroDe(() => solicitarAlteracao(db, 99999, { telefone: "1" }, AGORA));
  });

  it.each([
    ["cnpj inválido", { cnpj: "11222333000182" }, "cnpj", 400],
    ["e-mail inválido", { email: "xx" }, "email", 400],
    ["CNPJ de outro cadastro", { cnpj: "99.999.999/0002-72" }, "cnpj", 409],
    ["e-mail de outro cadastro", { email: "PENDENTE@demo.com.br" }, "email", 409],
  ])("%s", (_n, dados, campo, status) => {
    const { db, aprovado, cadastroDe } = montar();
    const e = erroDe(() => solicitarAlteracao(db, aprovado.id, dados, AGORA));
    expect(e.status).toBe(status);
    expect(e.campos).toHaveProperty(campo);
    expect(cadastroDe(aprovado.id).alteracaoPendente).toBeNull();
  });
});
