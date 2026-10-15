import { z } from "zod";

import { getDb } from "@/lib/db";
import { ErroDeRegra, ok, responderErro, validar } from "@/lib/http";
import { exigirAcesso } from "@/lib/auth";
import { decidirCadastro } from "@/lib/aprovacoes/cadastro";
import { agoraISO } from "@/lib/relogio";

const corpo = z.object({ decisao: z.enum(["aprovado", "recusado"]), comentario: z.string().trim().max(500).optional() });

/** Compras aprova ou recusa um cadastro novo ou uma alteração de dados. Recusar exige o motivo. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await exigirAcesso("compras");
    const id = Number((await params).id);
    const dados = validar(corpo, await req.json().catch(() => ({})));
    if (!dados.ok) return dados.resposta;
    if (!Number.isInteger(id) || id <= 0) throw new ErroDeRegra("Cadastro inválido.", { status: 400 });
    decidirCadastro(getDb(), id, dados.data.decisao, u.id, agoraISO(), dados.data.comentario);
    return ok({ id, decisao: dados.data.decisao });
  } catch (e) {
    return responderErro(e);
  }
}
