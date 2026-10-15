import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import {
  adicionarChapaNaEquipe,
  chapaPorNome,
  chaveDoNome,
  copiarEscala,
  criarEquipe,
  lerEscala,
  mudarTipoDaChapa,
  nomeLimpo,
  removerChapaDaEquipe,
  removerEquipe,
  resumoDoMes,
  sugestoesDeChapas,
  ultimaEscalaAntes,
} from "./servico";

const AGORA = "2026-08-31T07:45:00-03:00";
let t: TestDb;
afterEach(() => t?.apagar());

function preparar() {
  t = createTestDb({ seed: true });
  return t.db.select().from(schema.armazem).all().find((a) => a.nome === "Adubo")!;
}

describe("nomes", () => {
  it("ignora acento, maiúscula e espaço a mais", () => {
    expect(chaveDoNome("  JOSÉ   da  Silva ")).toBe(chaveDoNome("jose da silva"));
    expect(nomeLimpo("  joão   DA silva ")).toBe("João Da Silva");
  });
});

describe("funcionário por nome", () => {
  it("cadastra o nome novo com matrícula gerada e reaproveita o mesmo nome", () => {
    preparar();
    const a = chapaPorNome(t.db, "marcos  souza");
    const b = chapaPorNome(t.db, "Marcos Souza");
    expect(b.id).toBe(a.id);
    expect(a.nome).toBe("Marcos Souza");
    expect(a.matricula).toMatch(/^E\d{3}$/);
    expect(chapaPorNome(t.db, "Outro Nome").matricula).not.toBe(a.matricula);
  });

  it("reativa o funcionário inativa que volta a ser escrita", () => {
    preparar();
    const c = chapaPorNome(t.db, "Ana Lima");
    t.db.update(schema.chapa).set({ ativo: false }).run();
    expect(chapaPorNome(t.db, "ana lima").ativo).toBe(true);
    expect(chapaPorNome(t.db, "ana lima").id).toBe(c.id);
  });

  it("recusa nome vazio", () => {
    preparar();
    expect(() => chapaPorNome(t.db, "  ")).toThrow();
  });
});

describe("escala", () => {
  it("salva o nome ao escalar e sugere na próxima montagem, os mais escalados primeiro", () => {
    const adubo = preparar();
    const e1 = criarEquipe(t.db, { data: "2026-08-31", nome: "Equipe 1", armazemId: adubo.id }, AGORA);
    adicionarChapaNaEquipe(t.db, e1.id, "Pedro Alves");
    adicionarChapaNaEquipe(t.db, e1.id, "Carlos Dias");
    const e2 = criarEquipe(t.db, { data: "2026-09-01", nome: "Equipe 1" }, AGORA);
    adicionarChapaNaEquipe(t.db, e2.id, "pedro alves");
    const s = sugestoesDeChapas(t.db);
    expect(s[0]).toMatchObject({ nome: "Pedro Alves", vezes: 2 });
    expect(s.find((x) => x.nome === "Carlos Dias")?.vezes).toBe(1);
  });

  it("um funcionário só em uma equipe por dia, mas livre em outro dia", () => {
    preparar();
    const a = criarEquipe(t.db, { data: "2026-08-31", nome: "A" }, AGORA);
    const b = criarEquipe(t.db, { data: "2026-08-31", nome: "B" }, AGORA);
    adicionarChapaNaEquipe(t.db, a.id, "Rui Costa");
    expect(() => adicionarChapaNaEquipe(t.db, a.id, "rui costa")).toThrow(/já está nesta equipe/);
    expect(() => adicionarChapaNaEquipe(t.db, b.id, "Rui Costa")).toThrow(/já está na equipe A/);
    const c = criarEquipe(t.db, { data: "2026-09-02", nome: "A" }, AGORA);
    expect(() => adicionarChapaNaEquipe(t.db, c.id, "Rui Costa")).not.toThrow();
  });

  it("nome de equipe não repete no dia", () => {
    preparar();
    criarEquipe(t.db, { data: "2026-08-31", nome: "A" }, AGORA);
    expect(() => criarEquipe(t.db, { data: "2026-08-31", nome: "A" }, AGORA)).toThrow(/Já existe/);
  });

  it("tirar o funcionário da equipe não apaga o nome do cadastro", () => {
    preparar();
    const a = criarEquipe(t.db, { data: "2026-08-31", nome: "A" }, AGORA);
    adicionarChapaNaEquipe(t.db, a.id, "Lia Souza");
    const m = lerEscala(t.db, "2026-08-31")[0].membros[0];
    removerChapaDaEquipe(t.db, a.id, m.id);
    expect(lerEscala(t.db, "2026-08-31")[0].membros).toHaveLength(0);
    expect(sugestoesDeChapas(t.db).some((x) => x.nome === "Lia Souza")).toBe(true);
    removerEquipe(t.db, a.id);
    expect(lerEscala(t.db, "2026-08-31")).toHaveLength(0);
  });

  it("copia a última escala para um dia vazio e acha o dia anterior", () => {
    const adubo = preparar();
    const a = criarEquipe(t.db, { data: "2026-08-28", nome: "Descarga", armazemId: adubo.id, tarefa: "Adubo" }, AGORA);
    adicionarChapaNaEquipe(t.db, a.id, "Dino Reis");
    expect(ultimaEscalaAntes(t.db, "2026-08-31")).toBe("2026-08-28");
    expect(ultimaEscalaAntes(t.db, "2026-08-28")).toBeNull();
    expect(copiarEscala(t.db, "2026-08-28", "2026-08-31", AGORA)).toBe(1);
    const nova = lerEscala(t.db, "2026-08-31");
    expect(nova[0]).toMatchObject({ nome: "Descarga", tarefa: "Adubo", armazemId: adubo.id });
    expect(nova[0].membros[0].nome).toBe("Dino Reis");
    expect(() => copiarEscala(t.db, "2026-08-28", "2026-08-31", AGORA)).toThrow(/já tem equipes/);
  });

  it("guarda meia ou inteira de cada funcionário, troca depois e leva na cópia", () => {
    const adubo = preparar();
    const a = criarEquipe(t.db, { data: "2026-08-28", nome: "A", armazemId: adubo.id }, AGORA);
    adicionarChapaNaEquipe(t.db, a.id, "Zeca Lima", "meia");
    adicionarChapaNaEquipe(t.db, a.id, "Nina Rocha");
    const [zeca, nina] = lerEscala(t.db, "2026-08-28")[0].membros;
    expect([zeca.tipo, nina.tipo]).toEqual(["meia", "completa"]);
    mudarTipoDaChapa(t.db, a.id, nina.id, "meia");
    copiarEscala(t.db, "2026-08-28", "2026-08-31", AGORA);
    expect(lerEscala(t.db, "2026-08-31")[0].membros.map((m) => m.tipo)).toEqual(["meia", "meia"]);
  });

  it("horário da equipe é opcional e vai junto na cópia", () => {
    preparar();
    criarEquipe(t.db, { data: "2026-08-28", nome: "A", horarioInicio: "06:00", horarioFim: "14:00" }, AGORA);
    criarEquipe(t.db, { data: "2026-08-28", nome: "B", horarioInicio: "" }, AGORA);
    copiarEscala(t.db, "2026-08-28", "2026-08-31", AGORA);
    const e = lerEscala(t.db, "2026-08-31");
    expect(e[0]).toMatchObject({ horarioInicio: "06:00", horarioFim: "14:00" });
    expect(e[1]).toMatchObject({ horarioInicio: null, horarioFim: null });
  });

  it("resume o mês: equipes e funcionários por dia, só do mês pedido", () => {
    preparar();
    const a = criarEquipe(t.db, { data: "2026-08-31", nome: "A" }, AGORA);
    criarEquipe(t.db, { data: "2026-08-31", nome: "B" }, AGORA);
    adicionarChapaNaEquipe(t.db, a.id, "Ana Lima");
    adicionarChapaNaEquipe(t.db, a.id, "Rui Costa");
    criarEquipe(t.db, { data: "2026-09-01", nome: "A" }, AGORA);
    expect(resumoDoMes(t.db, "2026-08")).toEqual({ "2026-08-31": { equipes: 2, chapas: 2 } });
    expect(resumoDoMes(t.db, "2026-09")).toEqual({ "2026-09-01": { equipes: 1, chapas: 0 } });
    expect(resumoDoMes(t.db, "2026-07")).toEqual({});
  });
});
