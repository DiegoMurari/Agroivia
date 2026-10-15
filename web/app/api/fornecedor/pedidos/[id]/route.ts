import { lerFormularioDoPedido } from "@/lib/agendamento/formulario";
import { eq } from "drizzle-orm";

import { numeroDoAgendamento } from "@/lib/agendamento/numero";
import { editarPedido } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { erro, ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

/** Edita pedido em aberto do fornecedor logado; enviar devolve o pedido para aprovação. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await exigirAcesso("fornecedor");
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return erro(400, "Pedido inválido.");
    const dados = await lerFormularioDoPedido(request);
    const db = getDb();
    editarPedido(db, usuario.id, id, dados, agoraISO());
    const criado = db.select({ criadoEm: schema.agendamento.criadoEm }).from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
    return ok({ agendamentoId: id, numero: numeroDoAgendamento(id, criado?.criadoEm ?? agoraISO()) });
  } catch (e) {
    return responderErro(e);
  }
}
