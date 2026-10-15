import { z } from "zod";

import { ErroNfe, lerNfeXml } from "@/lib/agendamento/nf-xml";
import { registrarChegadaDaConferencia } from "@/lib/agendamento/portaria";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroDeRegra, lerJson, ok, responderErro, validar } from "@/lib/http";
import { papelAtual } from "@/lib/papel";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({
  agendamentoId: z.number().int().positive("Escolha o agendamento."),
  placa: z.string().trim().max(10).nullish(),
  pesoBalancaKg: z.string().trim().max(20).nullish(),
  observacao: z.string().trim().max(500).nullish(),
  chave: z.string().trim().min(1, "Confira a nota primeiro.").max(60),
  /** Texto do XML conferido (até 2 MB), para o servidor refazer a conferência com os mesmos dados da tela. */
  xml: z.string().max(2_100_000).nullish(),
});

/** Registra a chegada depois da conferência, que é refeita aqui. Divergente exige `observacao` e abre pendência. */
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
    return ok(registrarChegadaDaConferencia(getDb(), { ...v.data, nf }, await papelAtual(), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
