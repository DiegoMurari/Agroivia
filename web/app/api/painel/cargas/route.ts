import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { filtroDaRequisicao, serializar } from "@/lib/painel/api";
import { cargasPorDia } from "@/lib/painel/indicadores";

/** RF3-01: cargas por dia e por armazém (histórico, caminhão aproximado pela D21). `data: null` quando o período não tem recebimento. */
export async function GET(req: Request) {
  try {
    return ok(serializar({ cargas: cargasPorDia(getDb(), filtroDaRequisicao(req.url)) }));
  } catch (e) {
    return responderErro(e);
  }
}
