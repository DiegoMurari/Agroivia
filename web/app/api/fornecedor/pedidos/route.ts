import { lerFormularioDoPedido } from "@/lib/agendamento/formulario";
import { numeroDoAgendamento } from "@/lib/agendamento/numero";
import { criarPedido } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

/** Cria o pedido do fornecedor logado: enviar para aprovação ou salvar rascunho. */
export async function POST(request: Request) {
  try {
    const usuario = await exigirAcesso("fornecedor");
    const dados = await lerFormularioDoPedido(request);
    const agora = agoraISO();
    const r = criarPedido(getDb(), usuario.id, dados, agora);
    return ok({ ...r, numero: numeroDoAgendamento(r.agendamentoId, agora) }, 201);
  } catch (e) {
    return responderErro(e);
  }
}
