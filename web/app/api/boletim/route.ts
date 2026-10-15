import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { esquemaBoletim } from "@/lib/boletim/esquemas";
import { criarBoletim, listarBoletins } from "@/lib/boletim/servico";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const armazem = q.get("armazemId");
    if (armazem !== null && !/^\d+$/.test(armazem)) return erro(400, "O filtro armazemId deve ser um número.");
    return ok(listarBoletins(getDb(), { data: q.get("data") ?? undefined, armazemId: armazem ? Number(armazem) : undefined }));
  } catch (e) {
    return responderErro(e);
  }
}

export async function POST(request: Request) {
  try {
    const v = validar(esquemaBoletim, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(criarBoletim(getDb(), v.data, agoraISO()), 201);
  } catch (e) {
    return responderErro(e);
  }
}
