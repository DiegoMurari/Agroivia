import { getDb } from "@/lib/db";
import { erro, ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { fecharBoletim } from "@/lib/boletim/servico";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Número de boletim inválido.");
    return ok(fecharBoletim(getDb(), Number(id), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
