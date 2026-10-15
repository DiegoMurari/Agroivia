import { z } from "zod";

import { getDb } from "@/lib/db";
import { erro, ok, responderErro, validar } from "@/lib/http";
import { resolverConsulta } from "@/lib/painel/consulta-fixa";
import { CONSULTAS } from "@/lib/painel/linguagem-natural";

const corpo = z.object({
  pergunta: z.string().max(500).optional(),
  consulta: z.string().max(40).optional(),
  periodo: z.string().max(10).optional(),
  armazem: z.string().max(40).optional(),
});

/**
 * Consulta do painel (D32). Não grava nada (POST só porque a pergunta pode ser longa e não deve ir na URL).
 * Sempre devolve a lista de consultas fixas; a LLM é opcional e só indica qual consulta, período e armazém.
 */
export async function POST(req: Request) {
  try {
    if (!(req.headers.get("content-type") ?? "").includes("application/json")) return erro(415, "Envie o corpo como application/json.");
    const dados = validar(corpo, await req.json().catch(() => ({})));
    if (!dados.ok) return dados.resposta;
    const saida = await resolverConsulta(getDb(), dados.data);
    return ok({ ...saida, consultas: CONSULTAS });
  } catch (e) {
    return responderErro(e);
  }
}

/** A lista fixa, para a tela e para quem usa a API sem pergunta. */
export async function GET() {
  return ok({ consultas: CONSULTAS });
}
