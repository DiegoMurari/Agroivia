import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { filtroDaRequisicao, serializar } from "@/lib/painel/api";
import { diasDeMaiorMovimento, fornecedoresPorPeso } from "@/lib/painel/indicadores";

/** RF3-06 (fornecedores por peso) e RF3-07 (dias de maior movimento), histórico. Cada bloco é `null` quando o período não tem dado. */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const filtro = filtroDaRequisicao(req.url);
    return ok(serializar({ fornecedores: fornecedoresPorPeso(db, filtro), diasDeMaiorMovimento: diasDeMaiorMovimento(db, filtro) }));
  } catch (e) {
    return responderErro(e);
  }
}
