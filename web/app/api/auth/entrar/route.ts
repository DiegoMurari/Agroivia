import { z } from "zod";

import { abrirSessao, autenticar } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";
import { inicioDoPerfil } from "@/lib/sessao";

const esquema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").max(200),
  senha: z.string().min(1, "Informe a senha.").max(200),
  tipo: z.enum(["compras", "fornecedor"], { message: "Escolha o tipo de acesso." }),
});

export async function POST(request: Request) {
  const v = validar(esquema, await lerJson(request));
  if (!v.ok) return v.resposta;
  try {
    const usuario = autenticar(getDb(), v.data.email, v.data.senha, v.data.tipo);
    await abrirSessao(usuario);
    return ok({ destino: usuario.trocarSenha ? "/senha/trocar" : inicioDoPerfil(usuario.perfil) });
  } catch (e) {
    return responderErro(e);
  }
}
