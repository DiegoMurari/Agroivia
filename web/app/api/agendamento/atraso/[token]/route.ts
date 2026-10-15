import { z } from "zod";

import { cadastrarAtrasoPeloLink } from "@/lib/agendamento/portaria";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({
  previsao: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM, por exemplo 09:30."),
  motivo: z.string().trim().min(1, "Informe o motivo.").max(300),
});

/** O fornecedor avisa o atraso pelo link. Só registra: não remarca nem muda o estado. */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    cadastrarAtrasoPeloLink(getDb(), (await ctx.params).token, v.data, agoraISO());
    return ok({});
  } catch (e) {
    return responderErro(e);
  }
}
