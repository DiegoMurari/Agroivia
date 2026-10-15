/**
 * Consulta em linguagem natural (D32). A LLM é opcional e só ESCOLHE uma consulta fixa e seus parâmetros
 * (período e armazém); nunca gera SQL nem texto sobre os dados. Roda só no servidor, com fetch simples,
 * timeout de 5 s e fallback para as consultas fixas. Só a pergunta (mascarada) e a lista de consultas saem daqui:
 * nenhum dado do banco, nome de fornecedor ou CNPJ. A chave vem de ANTHROPIC_API_KEY (web/.env).
 */
import { z } from "zod";

export const MODELO_PADRAO = "claude-haiku-4-5-20251001";
export const TIMEOUT_PADRAO_MS = 5000;
const URL_API = "https://api.anthropic.com/v1/messages";
const MAX_PERGUNTA = 300;

export const CONSULTAS = [
  { id: "sobra_falta", rotulo: "Excesso ou falta de funcionários", descricao: "Se a equipe de funcionários está em excesso ou em falta no período, em funcionários e em reais." },
  { id: "custo", rotulo: "Custo estimado", descricao: "Custo estimado das diárias no período e o complemento pago." },
  { id: "cargas_por_dia", rotulo: "Cargas por dia", descricao: "Quantas cargas (caminhões) chegam por dia, no total e por armazém." },
  { id: "dias_de_maior_movimento", rotulo: "Dias de maior movimento", descricao: "Os dias com mais cargas recebidas no período." },
  { id: "fornecedores_por_peso", rotulo: "Fornecedores com maior volume", descricao: "Os fornecedores que mais entregaram em peso no período." },
] as const;

export const ARMAZENS_NL = ["Insumos", "Adubo", "Pátio de Máquinas", "Loja"] as const;

/** Tira dados pessoais da pergunta antes de qualquer envio e limita o tamanho. */
export function mascararPergunta(texto: string): string {
  return texto
    .trim()
    .slice(0, MAX_PERGUNTA)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/\d(?:[\s.\-/]{0,3}\d){7,}/g, "[número]")
    .replace(/\d{5,}/g, "[número]");
}

export function montarRequisicao(pergunta: string, modelo: string) {
  const consultas = CONSULTAS.map((c) => `- ${c.id}: ${c.rotulo}. ${c.descricao}`).join("\n");
  const system = [
    "Você escolhe qual consulta fixa de um painel responde a pergunta do usuário. Você não responde a pergunta e não inventa dados.",
    "Consultas:",
    consultas,
    'Período: "safra", "entressafra", "tudo" ou um mês no formato AAAA-MM. Omita se a pergunta não disser.',
    `Armazém: um de ${ARMAZENS_NL.join(", ")}. Omita se a pergunta não disser.`,
    'Responda somente com JSON: {"consulta":"<id>","periodo":"<período ou omitido>","armazem":"<armazém ou omitido>"}',
  ].join("\n");
  return { model: modelo, max_tokens: 150, system, messages: [{ role: "user" as const, content: mascararPergunta(pergunta) }] };
}

const esquemaEscolha = z.object({
  consulta: z.enum(CONSULTAS.map((c) => c.id) as [string, ...string[]]),
  periodo: z
    .string()
    .regex(/^(safra|entressafra|tudo|\d{4}-(0[1-9]|1[0-2]))$/)
    .nullish()
    .transform((v) => v ?? undefined),
  armazem: z
    .enum(ARMAZENS_NL)
    .nullish()
    .transform((v) => v ?? undefined),
});

export type EscolhaConsulta = z.output<typeof esquemaEscolha>;

/** Valida o que a LLM devolveu. Qualquer desvio devolve null (e a tela cai nas consultas fixas). */
export function validarEscolha(texto: string): EscolhaConsulta | null {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let bruto: unknown;
  try {
    bruto = JSON.parse(limpo);
  } catch {
    return null;
  }
  const r = esquemaEscolha.safeParse(bruto);
  return r.success ? r.data : null;
}

export type MotivoFalha = "pergunta_vazia" | "sem_chave" | "rede" | "timeout" | "resposta_invalida" | "limite";
export type ResultadoEscolha = { ok: true; escolha: EscolhaConsulta } | { ok: false; motivo: MotivoFalha };

export interface OpcoesEscolha {
  chave?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  modelo?: string;
}

// Freio de custo e abuso: no máximo LIMITE_POR_MINUTO chamadas à API por processo, e a mesma pergunta mascarada
// repetida em CACHE_MS reaproveita a escolha (F5 e link compartilhado não gastam cota).
const LIMITE_POR_MINUTO = 10;
const CACHE_MS = 5 * 60_000;
let janela: number[] = [];
const cache = new Map<string, { em: number; escolha: EscolhaConsulta }>();

/** Zera o freio e o cache (testes). */
export function reiniciarFreio(): void {
  janela = [];
  cache.clear();
}

export async function escolherConsulta(pergunta: string, opcoes: OpcoesEscolha = {}): Promise<ResultadoEscolha> {
  if (pergunta.trim() === "") return { ok: false, motivo: "pergunta_vazia" };
  const chave = opcoes.chave ?? process.env.ANTHROPIC_API_KEY;
  if (!chave) return { ok: false, motivo: "sem_chave" };

  const mascarada = mascararPergunta(pergunta);
  const guardada = cache.get(mascarada);
  if (guardada && Date.now() - guardada.em < CACHE_MS) return { ok: true, escolha: guardada.escolha };
  const agora = Date.now();
  janela = janela.filter((t) => agora - t < 60_000);
  if (janela.length >= LIMITE_POR_MINUTO) return { ok: false, motivo: "limite" };
  janela.push(agora);

  const controle = new AbortController();
  let estourou = false;
  const timer = setTimeout(() => {
    estourou = true;
    controle.abort();
  }, opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS);
  try {
    const resposta = await (opcoes.fetchFn ?? fetch)(URL_API, {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(montarRequisicao(pergunta, opcoes.modelo ?? MODELO_PADRAO)),
      signal: controle.signal,
    });
    if (!resposta.ok) return { ok: false, motivo: "rede" };
    const corpo = (await resposta.json()) as { content?: { type?: string; text?: string }[] };
    const texto = corpo.content?.find((c) => c.type === "text")?.text;
    const escolha = texto ? validarEscolha(texto) : null;
    if (escolha) cache.set(mascarada, { em: Date.now(), escolha });
    return escolha ? { ok: true, escolha } : { ok: false, motivo: "resposta_invalida" };
  } catch {
    return { ok: false, motivo: estourou ? "timeout" : "rede" };
  } finally {
    clearTimeout(timer);
  }
}
