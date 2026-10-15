import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { criarUsuario, esquemaUsuario, listarUsuarios } from "@/lib/usuarios/servico";

export async function GET() {
  try {
    await exigirAcesso("adm_master");
    return ok(listarUsuarios(getDb(), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}

export async function POST(request: Request) {
  try {
    await exigirAcesso("adm_master");
    const v = validar(esquemaUsuario, await lerJson(request));
    if (!v.ok) return v.resposta;
    return ok(criarUsuario(getDb(), v.data, agoraISO()), 201);
  } catch (e) {
    return responderErro(e);
  }
}
