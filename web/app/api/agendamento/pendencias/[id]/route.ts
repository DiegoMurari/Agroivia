import { z } from "zod";

import { resolverPendencia } from "@/lib/agendamento/descarga";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { papelAtual } from "@/lib/papel";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({ resolucao: z.string().trim().min(1, "Descreva como foi resolvida.").max(500) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return erro(400, "Pendência inválida.");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    resolverPendencia(getDb(), id, v.data.resolucao, await papelAtual(), agoraISO());
    return ok({});
  } catch (e) {
    return responderErro(e);
  }
}
