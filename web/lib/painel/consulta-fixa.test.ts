import { afterEach, describe, expect, it, vi } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { executarConsulta, filtroDaEscolha, resolverConsulta, type ConsultaId } from "./consulta-fixa";

let t: TestDb;
afterEach(() => t?.apagar());

// Fixture: 2 dias úteis de outubro de 2025 com folha, cargas e um fornecedor com peso.
function montar() {
  t = createTestDb({ seed: true });
  const db = t.db;
  const adubo = db.select().from(schema.armazem).all().find((a) => a.nome === "Adubo")!.id;
  db.insert(schema.histChapasDia).values([
    { data: "2025-10-02", presentes: 2, cafe: 0, qualidade: "", considerada: true },
    { data: "2025-10-03", presentes: 2, cafe: 0, qualidade: "", considerada: true },
  ]).run();
  db.insert(schema.histCarga).values([
    { id: 1, codPn: "A", data: "2025-10-02", notasQtd: 1, itensQtd: 1 },
    { id: 2, codPn: "A", data: "2025-10-03", notasQtd: 1, itensQtd: 1 },
  ]).run();
  db.insert(schema.histCargaArmazem).values([
    { histCargaId: 1, armazemId: adubo, itensQtd: 1, producaoEstimada: "300" },
    { histCargaId: 2, armazemId: adubo, itensQtd: 1, producaoEstimada: "50" },
  ]).run();
  db.insert(schema.histMovimentacao).values({ linhaPlanilha: 1, codPn: "A", nomePn: "Alfa", dataRecebimento: "2025-10-02", pesoKg: "2000", qtd: "2", unidade: "TON", qualidade: "", considerada: true }).run();
  return db;
}

const TODAS: ConsultaId[] = ["sobra_falta", "custo", "cargas_por_dia", "dias_de_maior_movimento", "fornecedores_por_peso"];

describe("executarConsulta", () => {
  it("toda consulta responde com origem historico e aviso, sem usar o relógio", () => {
    const db = montar();
    for (const id of TODAS) {
      const r = executarConsulta(db, id, { tipo: "safra" });
      expect(r.origem).toBe("historico");
      expect(r.semDado).toBe(false);
      expect(r.linhas.length).toBeGreaterThan(0);
      expect(JSON.stringify(r)).not.toMatch(/[—–]/);
    }
  });

  it("sobra_falta usa a mesma frase do painel e inclui a linha do armazém pedido", () => {
    const r = executarConsulta(montar(), "sobra_falta", { tipo: "safra" }, "Adubo");
    expect(r.linhas[0]).toContain("excesso médio");
    expect(r.linhas.at(-1)).toContain("Adubo: ");
    expect(r.aviso).toContain("teto");
  });

  it("cargas_por_dia filtra o armazém pedido", () => {
    const r = executarConsulta(montar(), "cargas_por_dia", { tipo: "safra" }, "Adubo");
    expect(r.linhas[0]).toContain("2 cargas em 2 dias");
    expect(r.linhas[1]).toContain("Adubo: 1,00 cargas por dia");
  });

  it("tabelas de dias e fornecedores trazem colunas e linhas", () => {
    const db = montar();
    const dias = executarConsulta(db, "dias_de_maior_movimento", { tipo: "safra" });
    expect(dias.tabela!.colunas).toEqual(["Data", "Dia da semana", "Cargas"]);
    expect(dias.tabela!.linhas[0]).toEqual(["2025-10-02", "quinta", "1"]);
    const forn = executarConsulta(db, "fornecedores_por_peso", { tipo: "safra" });
    expect(forn.tabela!.linhas[0]).toEqual(["Alfa", "2,00", "100,0%"]);
  });

  it("período sem dado devolve semDado, nunca zero", () => {
    const db = montar();
    for (const id of TODAS) {
      const r = executarConsulta(db, id, { tipo: "mes", anoMes: "2024-01" });
      expect(r.semDado).toBe(true);
      expect(r.linhas[0]).toContain("Sem dado");
    }
  });
});

describe("filtroDaEscolha", () => {
  it("aceita safra, entressafra, tudo e mês; o resto cai em safra", () => {
    expect(filtroDaEscolha("entressafra")).toEqual({ tipo: "entressafra" });
    expect(filtroDaEscolha("2025-10")).toEqual({ tipo: "mes", anoMes: "2025-10" });
    expect(filtroDaEscolha("ontem")).toEqual({ tipo: "safra" });
    expect(filtroDaEscolha(undefined)).toEqual({ tipo: "safra" });
  });
});

describe("resolverConsulta", () => {
  const ok = (texto: string) => async () => new Response(JSON.stringify({ content: [{ type: "text", text: texto }] }), { status: 200 });

  it("consulta escolhida na lista funciona sem chave e sem rede", async () => {
    const fetchFn = vi.fn();
    const r = await resolverConsulta(montar(), { consulta: "custo", periodo: "safra" }, { chave: undefined, fetchFn: fetchFn as unknown as typeof fetch });
    expect(r.modo).toBe("fixa");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("pergunta sem chave cai no fallback sem chamar a rede", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const fetchFn = vi.fn();
    const r = await resolverConsulta(montar(), { pergunta: "quanto custou?" }, { fetchFn: fetchFn as unknown as typeof fetch });
    if (antes !== undefined) process.env.ANTHROPIC_API_KEY = antes;
    expect(r).toEqual({ modo: "fallback", motivo: "sem_chave" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("a LLM só indica a consulta; a resposta vem do painel", async () => {
    const r = await resolverConsulta(
      montar(),
      { pergunta: "cargas do Adubo na safra" },
      { chave: "k", fetchFn: ok('{"consulta":"cargas_por_dia","periodo":"safra","armazem":"Adubo"}') as unknown as typeof fetch },
    );
    expect(r.modo).toBe("llm");
    if (r.modo === "llm") {
      expect(r.resposta.consulta).toBe("cargas_por_dia");
      expect(r.resposta.linhas[1]).toContain("Adubo: 1,00 cargas por dia");
    }
  });

  it("resposta fora do formato, rede caída e consulta inventada viram fallback", async () => {
    const db = montar();
    expect(await resolverConsulta(db, { pergunta: "x" }, { chave: "k", fetchFn: ok("não sei") as unknown as typeof fetch })).toEqual({ modo: "fallback", motivo: "resposta_invalida" });
    expect(await resolverConsulta(db, { pergunta: "x" }, { chave: "k", fetchFn: ok('{"consulta":"apagar_tudo"}') as unknown as typeof fetch })).toEqual({ modo: "fallback", motivo: "resposta_invalida" });
    const cai = (async () => { throw new Error("rede"); }) as unknown as typeof fetch;
    expect(await resolverConsulta(db, { pergunta: "x" }, { chave: "k", fetchFn: cai })).toEqual({ modo: "fallback", motivo: "rede" });
  });

  it("consulta desconhecida e pergunta vazia dão modo nenhuma", async () => {
    expect(await resolverConsulta(montar(), { consulta: "drop", pergunta: "  " })).toEqual({ modo: "nenhuma" });
  });
});
