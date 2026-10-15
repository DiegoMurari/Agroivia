import { z } from "zod";

import { cancelarPeloLink } from "@/lib/agendamento/desvios";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({ motivo: z.string().trim().min(1, "Informe o motivo.").max(300) });

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(cancelarPeloLink(getDb(), (await ctx.params).token, v.data.motivo, agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
