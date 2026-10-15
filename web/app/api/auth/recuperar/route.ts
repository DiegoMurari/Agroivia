import { eq } from "drizzle-orm";
import { z } from "zod";

import { normalizarEmail, novoToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { lerJson, ok, validar } from "@/lib/http";
import { agora, paraISO } from "@/lib/relogio";

const esquema = z.object({
  email: z.string().trim().email("E-mail inválido.").max(200),
  tipo: z.enum(["compras", "fornecedor"]),
});

const VALIDADE_MS = 60 * 60 * 1000;

/**
 * Recuperação de senha para os dois tipos. A resposta é sempre a mesma, exista ou não a conta.
 * Não há servidor de e-mail (a demo roda sem rede): com DEMO_AGORA no ambiente, o link que iria
 * por e-mail volta em `linkDemo` para ser aberto na própria tela.
 */
export async function POST(request: Request) {
  const v = validar(esquema, await lerJson(request));
  if (!v.ok) return v.resposta;
  const db = getDb();
  const u = db.select().from(schema.usuario).where(eq(schema.usuario.email, normalizarEmail(v.data.email))).get();
  const tipoDaConta = u?.perfil === "fornecedor" ? "fornecedor" : u?.perfil ? "compras" : null;
  let linkDemo: string | undefined;
  if (u && u.ativo && tipoDaConta === v.data.tipo) {
    const token = novoToken();
    db.update(schema.usuario)
      .set({ tokenSenha: token, tokenSenhaExpira: paraISO(new Date(agora().getTime() + VALIDADE_MS)) })
      .where(eq(schema.usuario.id, u.id))
      .run();
    if (process.env.DEMO_AGORA) linkDemo = `/senha/${token}`;
  }
  return ok({ mensagem: "Se houver uma conta com este e-mail, enviamos o link para criar uma nova senha.", linkDemo });
}
