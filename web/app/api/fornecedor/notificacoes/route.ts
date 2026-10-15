import { z } from "zod";

import { listarNotificacoes, marcarNotificacoesLidas } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";

const esquema = z.object({ ids: z.array(z.number().int().positive()).max(100).optional() });

export async function GET() {
  try {
    const u = await exigirAcesso("fornecedor");
    return ok(listarNotificacoes(getDb(), u.id));
  } catch (e) {
    return responderErro(e);
  }
}

/** Marca como lidas as notificações indicadas, ou todas as do usuário se `ids` vier vazio. */
export async function POST(request: Request) {
  try {
    const u = await exigirAcesso("fornecedor");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    marcarNotificacoesLidas(getDb(), u.id, v.data.ids);
    return ok({});
  } catch (e) {
    return responderErro(e);
  }
}
