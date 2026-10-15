import { z } from "zod";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { desativarUsuario, reativarUsuario } from "@/lib/usuarios/servico";

const esquema = z.object({ ativo: z.boolean() });

/** Desativa ou reativa a conta. Nunca exclui. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const eu = await exigirAcesso("adm_master");
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return erro(400, "Número de usuário inválido.");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    const db = getDb();
    return ok(v.data.ativo ? reativarUsuario(db, Number(id)) : desativarUsuario(db, Number(id), eu.id));
  } catch (e) {
    return responderErro(e);
  }
}
