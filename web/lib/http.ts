import type { z } from "zod";

/**
 * Resposta JSON das rotas em um formato só:
 *   sucesso: { ok: true, data }
 *   erro:    { ok: false, erro: { mensagem, campos? } }   (campos: causa por campo, "itens.0.peso")
 */

export type Campos = Record<string, string>;

export interface CorpoOk<T> {
  ok: true;
  data: T;
}

export interface CorpoErro {
  ok: false;
  erro: { mensagem: string; campos?: Campos };
}

export type Corpo<T> = CorpoOk<T> | CorpoErro;

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data } satisfies CorpoOk<T>, { status });
}

export function erro(status: number, mensagem: string, campos?: Campos): Response {
  const corpo: CorpoErro = { ok: false, erro: campos ? { mensagem, campos } : { mensagem } };
  return Response.json(corpo, { status });
}

/**
 * Regra de negócio recusou (horário cheio, chapa repetida...). Lance dentro do serviço,
 * inclusive dentro da transação (desfaz tudo). A rota devolve com `responderErro`.
 */
export class ErroDeRegra extends Error {
  readonly status: number;
  readonly campos?: Campos;
  /** Dado extra para a tela (ex.: a próxima data disponível). */
  readonly detalhe?: unknown;

  constructor(mensagem: string, opcoes: { status?: number; campos?: Campos; detalhe?: unknown } = {}) {
    super(mensagem);
    this.name = "ErroDeRegra";
    this.status = opcoes.status ?? 409;
    this.campos = opcoes.campos;
    this.detalhe = opcoes.detalhe;
  }
}

/** `catch (e) { return responderErro(e) }`: ErroDeRegra vira a resposta dela; o resto vira 500. */
export function responderErro(causa: unknown): Response {
  if (causa instanceof ErroDeRegra) {
    const corpo = { ok: false, erro: { mensagem: causa.message, campos: causa.campos, detalhe: causa.detalhe } };
    return Response.json(corpo, { status: causa.status });
  }
  console.error(causa);
  return erro(500, "Erro inesperado no servidor. Tente de novo.");
}

/** Causa por campo a partir do erro do zod. Erro sem caminho fica na chave "_". */
export function camposDoZod(problemas: readonly { path: PropertyKey[]; message: string }[]): Campos {
  const campos: Campos = {};
  for (const problema of problemas) {
    const chave = problema.path.map(String).join(".") || "_";
    if (!(chave in campos)) campos[chave] = problema.message;
  }
  return campos;
}

export type Validado<T> = { ok: true; data: T } | { ok: false; resposta: Response; campos: Campos };

/** Valida com zod. Em caso de erro, `resposta` já é o 400 com a causa por campo. */
export function validar<T>(esquema: z.ZodType<T>, valor: unknown): Validado<T> {
  const resultado = esquema.safeParse(valor);
  if (resultado.success) return { ok: true, data: resultado.data };
  const campos = camposDoZod(resultado.error.issues);
  return { ok: false, campos, resposta: erro(400, "Dados inválidos. Confira os campos.", campos) };
}

/** Corpo JSON do pedido; devolve `undefined` se vier vazio ou malformado (o `validar` recusa). */
export async function lerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
