import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { editarUsuario, esquemaUsuario, excluirUsuario } from "@/lib/usuarios/servico";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await exigirAcesso("adm_master");
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Número de usuário inválido.");
    const v = validar(esquemaUsuario, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(editarUsuario(getDb(), Number(id), v.data, agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}

/** Exclui a conta (nunca a própria, o último Adm Master ou uma conta com histórico). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const eu = await exigirAcesso("adm_master");
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Número de usuário inválido.");
    excluirUsuario(getDb(), Number(id), eu.id);
    return ok({});
  } catch (e) {
    return responderErro(e);
  }
}
