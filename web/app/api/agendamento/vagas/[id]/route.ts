import { z } from "zod";

import { ocuparVaga } from "@/lib/agendamento/desvios";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { papelAtual } from "@/lib/papel";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({ agendamentoId: z.number().int().positive() });

/** O responsável escolhe quem ocupa a vaga liberada. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return erro(400, "Vaga inválida.");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    ocuparVaga(getDb(), id, v.data.agendamentoId, await papelAtual(), agoraISO());
    return ok({});
  } catch (e) {
    return responderErro(e);
  }
}
