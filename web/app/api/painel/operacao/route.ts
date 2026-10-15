import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { filtroDaRequisicao, serializar } from "@/lib/painel/api";
import { indicadoresOperacao } from "@/lib/painel/operacao";

/** RF3-02 a 05 e 08: espera, descarga, colaboradores, utilização e não recebimentos. Um bloco por origem (teste, operacao); lista vazia = sem dado. */
export async function GET(req: Request) {
  try {
    return ok(serializar({ operacao: indicadoresOperacao(getDb(), filtroDaRequisicao(req.url)) }));
  } catch (e) {
    return responderErro(e);
  }
}
