import { buscarFornecedores } from "@/lib/agendamento/compra";
import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return ok(buscarFornecedores(getDb(), q));
  } catch (e) {
    return responderErro(e);
  }
}
