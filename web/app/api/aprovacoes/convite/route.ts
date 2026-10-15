import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { exigirAcesso } from "@/lib/auth";
import { criarConvite } from "@/lib/aprovacoes/cadastro";
import { agoraISO } from "@/lib/relogio";

/** Compras gera um convite de cadastro; a resposta traz o caminho do link para copiar (sem e-mail). */
export async function POST() {
  try {
    const u = await exigirAcesso("compras");
    const c = criarConvite(getDb(), u.id, agoraISO());
    return ok({ caminho: `/cadastro/${c.token}` }, 201);
  } catch (e) {
    return responderErro(e);
  }
}
