import { getDb } from "@/lib/db";
import { ok, responderErro, validar } from "@/lib/http";
import { cadastrarFornecedor } from "@/lib/aprovacoes/cadastro";
import { esquemaCadastro } from "@/lib/aprovacoes/tipos";
import { agoraISO } from "@/lib/relogio";

/** Rota pública (o convite é a credencial): grava o cadastro do fornecedor como pendente. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const dados = validar(esquemaCadastro, await req.json().catch(() => ({})));
    if (!dados.ok) return dados.resposta;
    const r = cadastrarFornecedor(getDb(), token, dados.data, agoraISO());
    return ok({ cadastroId: r.cadastroId, status: "pendente" }, 201);
  } catch (e) {
    return responderErro(e);
  }
}
