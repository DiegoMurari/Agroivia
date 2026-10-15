import { z } from "zod";

import { ErroNfe, lerNfeXml } from "@/lib/agendamento/nf-xml";
import { recusarRecebimentoDaConferencia } from "@/lib/agendamento/portaria";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroDeRegra, lerJson, ok, responderErro, validar } from "@/lib/http";
import { papelAtual } from "@/lib/papel";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({
  agendamentoId: z.number().int().positive("Escolha o agendamento."),
  descricao: z.string().trim().min(1, "Explique por que o recebimento foi recusado.").max(500),
  chave: z.string().trim().min(1, "Confira a nota primeiro.").max(60),
  xml: z.string().max(2_100_000).nullish(),
  placa: z.string().trim().max(10).nullish(),
});

/** A portaria recusa o recebimento de uma nota que não confere: registra o não recebimento por divergência. */
export async function POST(request: Request) {
  try {
    await exigirAcesso("portaria");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    let nf = null;
    if (v.data.xml) {
      try {
        nf = lerNfeXml(v.data.xml);
      } catch (e) {
        if (e instanceof ErroNfe) throw new ErroDeRegra(e.message, { status: 422 });
        throw e;
      }
    }
    return ok(recusarRecebimentoDaConferencia(getDb(), { ...v.data, nf }, await papelAtual(), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
