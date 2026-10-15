import { z } from "zod";

import { getDb } from "@/lib/db";
import { erro, ok, responderErro, validar } from "@/lib/http";
import { dataValida } from "@/lib/painel/consultas";
import { dataSeguinte, necessidadeDoDia, textoAvisoPrestador } from "@/lib/painel/dia-seguinte";
import { hojeISO } from "@/lib/relogio";

const consulta = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD.").optional() });

/** Efetivo necessário do dia seguinte (ou de `?data=`) e o texto do aviso ao prestador. Só leitura. */
export async function GET(req: Request) {
  try {
    const q = validar(consulta, { data: new URL(req.url).searchParams.get("data") ?? undefined });
    if (!q.ok) return q.resposta;
    if (q.data.data && !dataValida(q.data.data)) {
      return erro(400, "Dados inválidos. Confira os campos.", { data: "Data inexistente." });
    }
    const amanha = dataSeguinte(hojeISO());
    const data = q.data.data ?? amanha;
    const necessidade = necessidadeDoDia(getDb(), data);
    return ok({ necessidade, aviso: textoAvisoPrestador(necessidade, { rotulo: data === amanha ? "Amanhã" : undefined }) });
  } catch (e) {
    return responderErro(e);
  }
}
