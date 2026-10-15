import { getDb } from "@/lib/db";
import { ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { dadosDoDia } from "@/lib/dia/tela";

export async function GET() {
  try {
    return ok(await dadosDoDia(getDb(), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
