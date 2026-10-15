import { historicoDaPlaca } from "@/lib/agendamento/historico";
import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";

/** Últimas cargas de uma placa. Só leitura. */
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const ex = Number(new URL(request.url).searchParams.get("excluir"));
    return ok(historicoDaPlaca(getDb(), q, 5, Number.isInteger(ex) && ex > 0 ? ex : undefined));
  } catch (e) {
    return responderErro(e);
  }
}
