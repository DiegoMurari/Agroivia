import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { esquemaBoletim } from "@/lib/boletim/esquemas";
import { lerBoletim, salvarBoletim } from "@/lib/boletim/servico";

type Ctx = { params: Promise<{ id: string }> };

async function idDe(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  return /^\d+$/.test(id) ? Number(id) : null;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const id = await idDe(ctx);
    if (id === null) return erro(400, "Número de boletim inválido.");
    const b = lerBoletim(getDb(), id);
    return b ? ok(b) : erro(404, "Boletim não encontrado. Volte à lista e abra de novo.");
  } catch (e) {
    return responderErro(e);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const id = await idDe(ctx);
    if (id === null) return erro(400, "Número de boletim inválido.");
    const v = validar(esquemaBoletim, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(salvarBoletim(getDb(), id, v.data, agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
