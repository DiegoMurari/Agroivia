import { fecharSessao } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  await fecharSessao();
  return ok({ destino: "/login" });
}
