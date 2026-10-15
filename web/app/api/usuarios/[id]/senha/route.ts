import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { erro, ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { redefinirSenha } from "@/lib/usuarios/servico";

/** Gera um link novo para a pessoa definir a senha (sem e-mail: o Adm Master copia e envia). */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await exigirAcesso("adm_master");
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Número de usuário inválido.");
    return ok(redefinirSenha(getDb(), Number(id), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
