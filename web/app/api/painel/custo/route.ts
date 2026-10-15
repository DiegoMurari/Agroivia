import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { filtroDaRequisicao, serializar } from "@/lib/painel/api";
import { custoDoPeriodo } from "@/lib/painel/indicadores";

/** RF3-09: custo estimado do histórico (D31). `custo: null` quando não há dia comparável. */
export async function GET(req: Request) {
  try {
    return ok(serializar({ custo: custoDoPeriodo(getDb(), filtroDaRequisicao(req.url)) }));
  } catch (e) {
    return responderErro(e);
  }
}
