import { z } from "zod";

import { decidirPedido, listarAprovacoes } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({
  id: z.number().int().positive(),
  decisao: z.enum(["aprovado", "recusado"]),
  comentario: z.string().trim().max(500).nullish(),
});

export async function GET() {
  try {
    await exigirAcesso("compras");
    return ok(listarAprovacoes(getDb()));
  } catch (e) {
    return responderErro(e);
  }
}

/** Compras aprova ou recusa um pedido. Recusar exige comentário. */
export async function POST(request: Request) {
  try {
    const u = await exigirAcesso("compras");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    decidirPedido(getDb(), { id: u.id, nome: u.nome }, v.data, agoraISO());
    return ok({});
  } catch (e) {
    return responderErro(e);
  }
}
