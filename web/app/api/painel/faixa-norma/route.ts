import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { filtroDaRequisicao, serializar } from "@/lib/painel/api";
import { faixaDaNormaNoPeriodo } from "@/lib/painel/faixa-norma";

/** Régua complementar (norma de chapas) como faixa mínimo a máximo, histórico. `faixa: null` quando o período não tem carga. */
export async function GET(req: Request) {
  try {
    return ok(serializar({ faixa: faixaDaNormaNoPeriodo(getDb(), filtroDaRequisicao(req.url)) }));
  } catch (e) {
    return responderErro(e);
  }
}
