import { eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { ok, responderErro, validar } from "@/lib/http";
import { exigirAcesso } from "@/lib/auth";
import { solicitarAlteracao } from "@/lib/aprovacoes/cadastro";
import { esquemaAlteracao } from "@/lib/aprovacoes/tipos";
import { agoraISO } from "@/lib/relogio";

/** Dados do próprio fornecedor (filtra pelo usuário da sessão, nunca por id vindo do cliente). */
export async function GET() {
  try {
    const u = await exigirAcesso("fornecedor");
    const c = getDb().select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.usuarioId, u.id)).get();
    return ok({ cadastro: c ?? null });
  } catch (e) {
    return responderErro(e);
  }
}

/** A mudança vai para `alteracaoPendente`; os dados atuais valem até Compras aprovar. */
export async function PUT(req: Request) {
  try {
    const u = await exigirAcesso("fornecedor");
    const dados = validar(esquemaAlteracao, await req.json().catch(() => ({})));
    if (!dados.ok) return dados.resposta;
    solicitarAlteracao(getDb(), u.id, dados.data, agoraISO());
    return ok({ status: "aguardando_aprovacao" });
  } catch (e) {
    return responderErro(e);
  }
}
