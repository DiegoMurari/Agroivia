import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { adicionarChapaNaEquipe, esquemaNomeChapa, esquemaTipoChapa, mudarTipoDaChapa, removerChapaDaEquipe } from "@/lib/equipes/servico";

type Ctx = { params: Promise<{ id: string }> };

/** Escreve um nome na equipe: a chapa é cadastrada na hora se for nova. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Equipe inválida.");
    const v = validar(esquemaNomeChapa, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(adicionarChapaNaEquipe(getDb(), Number(id), v.data.nome, v.data.tipo), 201);
  } catch (e) {
    return responderErro(e);
  }
}

/** Troca a chapa entre meia e diária inteira. */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Equipe inválida.");
    const v = validar(esquemaTipoChapa, await lerJson(request));
    if (!v.ok) return v.resposta;
    mudarTipoDaChapa(getDb(), Number(id), v.data.membroId, v.data.tipo);
    return ok({ alterada: true });
  } catch (e) {
    return responderErro(e);
  }
}

/** Tira uma chapa da equipe (`?membroId=`). O nome continua cadastrado. */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const membro = new URL(request.url).searchParams.get("membroId") ?? "";
    if (!/^\d+$/.test(id) || !/^\d+$/.test(membro)) return erro(400, "Informe a equipe e o funcionário.");
    removerChapaDaEquipe(getDb(), Number(id), Number(membro));
    return ok({ removida: true });
  } catch (e) {
    return responderErro(e);
  }
}
