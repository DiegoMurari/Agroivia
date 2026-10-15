/* eslint-disable @typescript-eslint/no-unused-vars -- os stubs de fetch precisam da assinatura (url, init) para tipar mock.calls */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ARMAZENS_NL,
  CONSULTAS,
  escolherConsulta,
  mascararPergunta,
  montarRequisicao,
  validarEscolha,
  reiniciarFreio,
} from "./linguagem-natural";

const URL_API = "https://api.anthropic.com/v1/messages";
const MODELO_PADRAO = "claude-haiku-4-5-20251001";

function respostaTexto(texto: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text: texto }] }), { status });
}

describe("CONSULTAS e ARMAZENS_NL", () => {
  it("expõe exatamente os ids esperados", () => {
    expect(CONSULTAS.map((c) => c.id)).toEqual([
      "sobra_falta",
      "custo",
      "cargas_por_dia",
      "dias_de_maior_movimento",
      "fornecedores_por_peso",
    ]);
  });

  it("cada consulta tem rótulo e descrição não vazios", () => {
    for (const c of CONSULTAS) {
      expect(c.rotulo.length).toBeGreaterThan(0);
      expect(c.descricao.length).toBeGreaterThan(0);
    }
  });

  it("lista os armazéns aceitos", () => {
    expect([...ARMAZENS_NL]).toEqual(["Insumos", "Adubo", "Pátio de Máquinas", "Loja"]);
  });
});

describe("mascararPergunta", () => {
  it("faz trim", () => {
    expect(mascararPergunta("  quanto sobrou?  ")).toBe("quanto sobrou?");
  });

  it("corta em 300 caracteres", () => {
    expect(mascararPergunta("a".repeat(500))).toHaveLength(300);
  });

  it("troca CNPJ formatado por [número]", () => {
    expect(mascararPergunta("fornecedor 12.345.678/0001-90 no mês")).toBe("fornecedor [número] no mês");
  });

  it("troca CPF formatado por [número]", () => {
    expect(mascararPergunta("cpf 123.456.789-09 aqui")).toBe("cpf [número] aqui");
  });

  it("troca sequência pura de 8 ou mais dígitos", () => {
    expect(mascararPergunta("código 12345678")).toBe("código [número]");
    expect(mascararPergunta("código 12345678901234")).toBe("código [número]");
  });

  it("mantém números curtos", () => {
    expect(mascararPergunta("últimos 30 dias de 2025-10")).toBe("últimos 30 dias de 2025-10");
  });

  it("troca e-mails por [email]", () => {
    expect(mascararPergunta("mande para joao.silva@empresa.com.br hoje")).toBe("mande para [email] hoje");
  });

  it("trata texto vazio", () => {
    expect(mascararPergunta("")).toBe("");
    expect(mascararPergunta("   ")).toBe("");
  });

  it("preserva Unicode e emojis curtos", () => {
    expect(mascararPergunta("Pátio de Máquinas ção")).toBe("Pátio de Máquinas ção");
  });
});

describe("montarRequisicao", () => {
  it("monta o corpo básico", () => {
    const corpo = montarRequisicao("quanto sobrou no Adubo?", "modelo-x");
    expect(corpo.model).toBe("modelo-x");
    expect(corpo.max_tokens).toBeGreaterThan(0);
    expect(corpo.max_tokens).toBeLessThanOrEqual(300);
    expect(typeof corpo.system).toBe("string");
    expect(corpo.messages).toEqual([{ role: "user", content: "quanto sobrou no Adubo?" }]);
  });

  it("o system lista ids e rótulos das consultas", () => {
    const { system } = montarRequisicao("x", "m");
    for (const c of CONSULTAS) {
      expect(system).toContain(c.id);
      expect(system).toContain(c.rotulo);
    }
  });

  it("o system lista períodos, armazéns e o formato JSON", () => {
    const { system } = montarRequisicao("x", "m");
    for (const p of ["safra", "entressafra", "tudo", "AAAA-MM"]) expect(system).toContain(p);
    for (const a of ARMAZENS_NL) expect(system).toContain(a);
    expect(system).toContain("JSON");
    for (const campo of ["consulta", "periodo", "armazem"]) expect(system).toContain(campo);
  });

  it("mascara CNPJ e e-mail e não vaza os originais no corpo inteiro", () => {
    const corpo = montarRequisicao("Custo do 12.345.678/0001-90, avise a ana@fazenda.com", "m");
    expect(corpo.messages[0].content).toBe("Custo do [número], avise a [email]");
    const json = JSON.stringify(corpo);
    expect(json).not.toContain("12.345.678/0001-90");
    expect(json).not.toContain("12345678");
    expect(json).not.toContain("ana@fazenda.com");
  });

  it("o content respeita o limite de 300 caracteres", () => {
    const corpo = montarRequisicao("b".repeat(1000), "m");
    expect(corpo.messages[0].content).toHaveLength(300);
  });

  it("só contém as chaves esperadas", () => {
    const corpo = montarRequisicao("oi", "m");
    expect(Object.keys(corpo).sort()).toEqual(["max_tokens", "messages", "model", "system"]);
  });
});

describe("validarEscolha", () => {
  it("aceita JSON puro mínimo", () => {
    expect(validarEscolha('{"consulta":"custo"}')).toEqual({ consulta: "custo" });
  });

  it("aceita JSON completo", () => {
    const r = validarEscolha('{"consulta":"sobra_falta","periodo":"safra","armazem":"Adubo"}');
    expect(r).toEqual({ consulta: "sobra_falta", periodo: "safra", armazem: "Adubo" });
  });

  it("aceita cerca de código com json", () => {
    const texto = '```json\n{"consulta":"cargas_por_dia","periodo":"2025-10"}\n```';
    expect(validarEscolha(texto)).toEqual({ consulta: "cargas_por_dia", periodo: "2025-10" });
  });

  it("aceita cerca de código sem linguagem", () => {
    expect(validarEscolha('```\n{"consulta":"custo"}\n```')).toEqual({ consulta: "custo" });
  });

  it("aceita todos os períodos válidos", () => {
    for (const p of ["safra", "entressafra", "tudo", "2025-01", "2025-12"]) {
      expect(validarEscolha(JSON.stringify({ consulta: "custo", periodo: p }))?.periodo).toBe(p);
    }
  });

  it("aceita todos os armazéns válidos", () => {
    for (const a of ARMAZENS_NL) {
      expect(validarEscolha(JSON.stringify({ consulta: "custo", armazem: a }))?.armazem).toBe(a);
    }
  });

  it("null vira undefined", () => {
    const r = validarEscolha('{"consulta":"custo","periodo":null,"armazem":null}');
    expect(r).not.toBeNull();
    expect(r?.consulta).toBe("custo");
    expect(r?.periodo).toBeUndefined();
    expect(r?.armazem).toBeUndefined();
  });

  it("ignora campos extras", () => {
    const r = validarEscolha('{"consulta":"custo","extra":"x","sql":"DROP TABLE"}');
    expect(r).toEqual({ consulta: "custo" });
    expect(r).not.toHaveProperty("extra");
    expect(r).not.toHaveProperty("sql");
  });

  it("devolve null para JSON quebrado", () => {
    expect(validarEscolha('{"consulta":"custo"')).toBeNull();
    expect(validarEscolha("não é json")).toBeNull();
    expect(validarEscolha("")).toBeNull();
  });

  it("devolve null para JSON que não é objeto", () => {
    expect(validarEscolha("null")).toBeNull();
    expect(validarEscolha("[]")).toBeNull();
    expect(validarEscolha('"custo"')).toBeNull();
    expect(validarEscolha("42")).toBeNull();
  });

  it("devolve null para consulta desconhecida ou ausente", () => {
    expect(validarEscolha('{"consulta":"apagar_tudo"}')).toBeNull();
    expect(validarEscolha('{"periodo":"safra"}')).toBeNull();
    expect(validarEscolha('{"consulta":42}')).toBeNull();
  });

  it("devolve null para período inválido", () => {
    for (const p of ["ontem", "2025-13", "2025-00", "2025-1", "25-10", "2025-10-01", 202510]) {
      expect(validarEscolha(JSON.stringify({ consulta: "custo", periodo: p }))).toBeNull();
    }
  });

  it("devolve null para armazém desconhecido", () => {
    expect(validarEscolha('{"consulta":"custo","armazem":"Garagem"}')).toBeNull();
    expect(validarEscolha('{"consulta":"custo","armazem":"adubo"}')).toBeNull();
  });
});

describe("escolherConsulta", () => {
  const chaveOriginal = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    reiniciarFreio();
  });

  afterEach(() => {
    if (chaveOriginal === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = chaveOriginal;
  });

  it("pergunta vazia não chama fetch", async () => {
    const fetchFn = vi.fn();
    const r = await escolherConsulta("   ", { chave: "k", fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, motivo: "pergunta_vazia" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sem chave nunca chama fetch", async () => {
    const fetchFn = vi.fn();
    const r = await escolherConsulta("quanto custou?", { fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, motivo: "sem_chave" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("usa a variável de ambiente quando não há opcoes.chave", async () => {
    process.env.ANTHROPIC_API_KEY = "chave-do-ambiente";
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaTexto('{"consulta":"custo"}'));
    const r = await escolherConsulta("custo?", { fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toEqual({ ok: true, escolha: { consulta: "custo" } });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("chave-do-ambiente");
  });

  it("chama a API com método, cabeçalhos, corpo e signal corretos", async () => {
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) =>
      respostaTexto('{"consulta":"sobra_falta","periodo":"safra","armazem":"Adubo"}'),
    );
    const r = await escolherConsulta("sobra no Adubo na safra", {
      chave: "sk-segredo-123",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(r).toEqual({
      ok: true,
      escolha: { consulta: "sobra_falta", periodo: "safra", armazem: "Adubo" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_API);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-segredo-123");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual(montarRequisicao("sobra no Adubo na safra", MODELO_PADRAO));
  });

  it("a chave não aparece no body", async () => {
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaTexto('{"consulta":"custo"}'));
    await escolherConsulta("custo?", { chave: "sk-segredo-123", fetchFn: fetchFn as unknown as typeof fetch });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body as string).not.toContain("sk-segredo-123");
  });

  it("o body enviado vai mascarado", async () => {
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaTexto('{"consulta":"custo"}'));
    await escolherConsulta("custo do 12.345.678/0001-90 ana@fazenda.com", {
      chave: "k",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const body = (fetchFn.mock.calls[0][1] as RequestInit).body as string;
    expect(body).not.toContain("12.345.678/0001-90");
    expect(body).not.toContain("ana@fazenda.com");
    expect(body).toContain("[número]");
    expect(body).toContain("[email]");
  });

  it("respeita o modelo informado", async () => {
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaTexto('{"consulta":"custo"}'));
    await escolherConsulta("custo?", {
      chave: "k",
      modelo: "outro-modelo",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("outro-modelo");
  });

  it("aceita resposta com cerca de código", async () => {
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaTexto('```json\n{"consulta":"fornecedores_por_peso"}\n```'));
    const r = await escolherConsulta("quem mais entregou?", { chave: "k", fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toEqual({ ok: true, escolha: { consulta: "fornecedores_por_peso" } });
  });

  it("HTTP não 2xx vira rede", async () => {
    for (const status of [400, 401, 429, 500]) {
      const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => new Response("erro", { status }));
      const r = await escolherConsulta("custo?", { chave: "k", fetchFn: fetchFn as unknown as typeof fetch });
      expect(r).toEqual({ ok: false, motivo: "rede" });
    }
  });

  it("fetch que lança vira rede", async () => {
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => {
      throw new TypeError("falha de rede");
    });
    const r = await escolherConsulta("custo?", { chave: "k", fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, motivo: "rede" });
  });

  it("fetch que nunca resolve vira timeout", async () => {
    const fetchFn = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("abortado", "AbortError")));
        }),
    );
    const r = await escolherConsulta("custo?", {
      chave: "k",
      timeoutMs: 20,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, motivo: "timeout" });
  });

  it("texto que não valida vira resposta_invalida", async () => {
    for (const texto of ["não sei", '{"consulta":"apagar"}', '{"consulta":"custo","periodo":"ontem"}']) {
      const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaTexto(texto));
      const r = await escolherConsulta("custo?", { chave: "k", fetchFn: fetchFn as unknown as typeof fetch });
      expect(r).toEqual({ ok: false, motivo: "resposta_invalida" });
    }
  });

  it("content vazio ou corpo inesperado vira resposta_invalida", async () => {
    const corpos = [{ content: [] }, {}, { content: [{ type: "tool_use" }] }];
    for (const corpo of corpos) {
      const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => new Response(JSON.stringify(corpo), { status: 200 }));
      const r = await escolherConsulta("custo?", { chave: "k", fetchFn: fetchFn as unknown as typeof fetch });
      expect(r).toEqual({ ok: false, motivo: "resposta_invalida" });
    }
  });
});

describe("freio de custo e máscara reforçada", () => {
  const respostaOk = () => new Response(JSON.stringify({ content: [{ type: "text", text: '{"consulta":"custo"}' }] }), { status: 200 });

  it("a mesma pergunta em seguida reaproveita a escolha e não chama a API de novo", async () => {
    reiniciarFreio();
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaOk());
    const f = fetchFn as unknown as typeof fetch;
    await escolherConsulta("custo da safra", { chave: "k", fetchFn: f });
    await escolherConsulta("custo da safra", { chave: "k", fetchFn: f });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("passando de 10 chamadas por minuto responde limite sem chamar a rede", async () => {
    reiniciarFreio();
    const fetchFn = vi.fn(async (_u: unknown, _i?: unknown) => respostaOk());
    const f = fetchFn as unknown as typeof fetch;
    for (let i = 0; i < 10; i++) await escolherConsulta(`pergunta ${i}`, { chave: "k", fetchFn: f });
    const r = await escolherConsulta("pergunta nova", { chave: "k", fetchFn: f });
    expect(r).toEqual({ ok: false, motivo: "limite" });
    expect(fetchFn).toHaveBeenCalledTimes(10);
    reiniciarFreio();
  });

  it("máscara pega separadores largos e blocos curtos, e preserva o mês AAAA-MM", () => {
    expect(mascararPergunta("12.345.678 / 0001-90")).not.toMatch(/\d{4}/);
    expect(mascararPergunta("telefone (16) 3333-4444")).toContain("[número]");
    expect(mascararPergunta("custo de 2025-10")).toBe("custo de 2025-10");
  });
});
