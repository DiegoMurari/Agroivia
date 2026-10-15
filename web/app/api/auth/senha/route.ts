import { eq } from "drizzle-orm";
import { z } from "zod";

import { abrirSessao, hashSenha, SENHA_MINIMA, usuarioAtual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { UsuarioPerfil } from "@/lib/db/enums";
import * as schema from "@/lib/db/schema";
import { erro, lerJson, ok, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { inicioDoPerfil } from "@/lib/sessao";

const esquema = z.object({
  /** Token do convite ou da recuperação. Sem token, vale a sessão (troca obrigatória no primeiro acesso). */
  token: z.string().min(10).max(100).optional(),
  senha: z.string().min(SENHA_MINIMA, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`).max(200),
});

/** Define a senha por token de uso único (convite, recuperação) ou pela sessão de quem precisa trocá-la. */
export async function POST(request: Request) {
  const v = validar(esquema, await lerJson(request));
  if (!v.ok) return v.resposta;
  const db = getDb();

  let alvo: { id: number; perfil: UsuarioPerfil } | null = null;
  if (v.data.token) {
    const u = db.select().from(schema.usuario).where(eq(schema.usuario.tokenSenha, v.data.token)).get();
    const valido = u && u.ativo && u.perfil && u.tokenSenhaExpira && u.tokenSenhaExpira > agoraISO();
    if (!valido) return erro(400, "Este link não vale mais. Peça um novo em \"Esqueci a senha\".");
    alvo = { id: u.id, perfil: u.perfil as UsuarioPerfil };
  } else {
    const logado = await usuarioAtual(db);
    if (!logado) return erro(401, "Entre no sistema para continuar.");
    alvo = { id: logado.id, perfil: logado.perfil };
  }

  db.update(schema.usuario)
    .set({ senhaHash: hashSenha(v.data.senha), trocarSenha: false, tokenSenha: null, tokenSenhaExpira: null })
    .where(eq(schema.usuario.id, alvo.id))
    .run();
  await abrirSessao(alvo);
  return ok({ destino: inicioDoPerfil(alvo.perfil) });
}
