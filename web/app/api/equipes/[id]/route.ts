import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { editarEquipe, esquemaEquipe, removerEquipe } from "@/lib/equipes/servico";

type Ctx = { params: Promise<{ id: string }> };

async function idDe(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  return /^\d+$/.test(id) ? Number(id) : null;
}

const esquemaEdicao = esquemaEquipe.pick({ nome: true, armazemId: true, tarefa: true, horarioInicio: true, horarioFim: true });

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const id = await idDe(ctx);
    if (id === null) return erro(400, "Equipe inválida.");
    const v = validar(esquemaEdicao, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(editarEquipe(getDb(), id, v.data));
  } catch (e) {
    return responderErro(e);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const id = await idDe(ctx);
    if (id === null) return erro(400, "Equipe inválida.");
    removerEquipe(getDb(), id);
    return ok({ removida: true });
  } catch (e) {
    return responderErro(e);
  }
}
