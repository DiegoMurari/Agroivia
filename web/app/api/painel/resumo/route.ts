import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { demandaPorArmazem, resumoBoletins, resumoHistorico } from "@/lib/painel/consultas";
import { filtroDaRequisicao, serializar } from "@/lib/painel/api";

/** RF3-00: excesso e falta no período. Histórico (estimado) e boletins novos (medidos) em blocos separados, cada um com a origem. */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const filtro = filtroDaRequisicao(req.url);
    return ok(
      serializar({
        filtro,
        historico: resumoHistorico(db, filtro),
        demandaPorArmazem: demandaPorArmazem(db, filtro),
        boletins: resumoBoletins(db, filtro),
      }),
    );
  } catch (e) {
    return responderErro(e);
  }
}
