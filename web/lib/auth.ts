import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { getDb, type Db } from "@/lib/db";
import type { CadastroStatus, UsuarioPerfil } from "@/lib/db/enums";
import * as schema from "@/lib/db/schema";
import { ErroDeRegra } from "@/lib/http";
import { conferirSenha, normalizarEmail } from "@/lib/senha";
import {
  criarTokenSessao,
  DURACAO_SESSAO_MS,
  lerTokenSessao,
  nomeCookieSessao,
  perfilPode,
  portaDoHost,
  type Acesso,
} from "@/lib/sessao";

/**
 * Login e permissão no servidor (D49). O proxy.ts barra pela assinatura do cookie;
 * aqui a sessão é conferida no banco: usuário ativo e, para fornecedor, cadastro aprovado.
 * Só código de servidor importa este arquivo.
 */

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: UsuarioPerfil;
  trocarSenha: boolean;
  /** Só para fornecedor: situação do cadastro B2B. */
  cadastroStatus: CadastroStatus | null;
  cadastroId: number | null;
  /** Só para fornecedor: nome da empresa (fantasia ou razão social), para a barra. */
  empresa: string | null;
}

export { conferirSenha, hashSenha, normalizarEmail, novoToken, SENHA_MINIMA } from "@/lib/senha";

// ───────────────────────── Sessão ─────────────────────────

async function cookieDaSessao(): Promise<string> {
  return nomeCookieSessao(portaDoHost((await headers()).get("host")));
}

function carregar(db: Db, id: number): UsuarioLogado | null {
  const u = db.select().from(schema.usuario).where(eq(schema.usuario.id, id)).get();
  if (!u || !u.ativo || !u.email || !u.perfil) return null;
  const perfil = u.perfil as UsuarioPerfil;
  const cad =
    perfil === "fornecedor"
      ? db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.usuarioId, u.id)).get()
      : undefined;
  return {
    id: u.id,
    nome: u.nome ?? u.email,
    email: u.email,
    perfil,
    trocarSenha: u.trocarSenha,
    cadastroStatus: cad?.status ?? null,
    cadastroId: cad?.id ?? null,
    empresa: cad ? cad.nomeFantasia || cad.razaoSocial : null,
  };
}

/** Usuário da sessão, conferido no banco; nulo se não entrou, foi desativado ou a sessão venceu. */
export async function usuarioAtual(db?: Db): Promise<UsuarioLogado | null> {
  // O cookie vem antes do banco: ler o cookie torna a página dinâmica, e sem sessão o banco nem abre
  const token = (await cookies()).get(await cookieDaSessao())?.value;
  const sessao = lerTokenSessao(token, Date.now());
  return sessao ? carregar(db ?? getDb(), sessao.uid) : null;
}

/**
 * Exige sessão com acesso ao nível pedido; lança ErroDeRegra 401 ou 403 (use com `responderErro`).
 * Fornecedor só passa com o cadastro aprovado.
 */
export async function exigirAcesso(acesso: Exclude<Acesso, "publico">, db?: Db): Promise<UsuarioLogado> {
  const usuario = await usuarioAtual(db);
  if (!usuario) throw new ErroDeRegra("Entre no sistema para continuar.", { status: 401 });
  if (!perfilPode(usuario.perfil, acesso)) throw new ErroDeRegra("Seu perfil não tem acesso a esta área.", { status: 403 });
  if (usuario.perfil === "fornecedor" && usuario.cadastroStatus !== "aprovado") {
    throw new ErroDeRegra("Seu cadastro ainda aguarda a aprovação de Compras.", { status: 403 });
  }
  return usuario;
}

export async function abrirSessao(usuario: { id: number; perfil: UsuarioPerfil }): Promise<void> {
  const token = criarTokenSessao({ uid: usuario.id, perfil: usuario.perfil, exp: Date.now() + DURACAO_SESSAO_MS });
  (await cookies()).set(await cookieDaSessao(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
}

export async function fecharSessao(): Promise<void> {
  (await cookies()).delete(await cookieDaSessao());
}

// ───────────────────────── Entrar ─────────────────────────

export type TipoAcesso = "compras" | "fornecedor";

const ERRO_LOGIN = "E-mail, senha ou tipo de acesso não conferem.";

/**
 * Confere e-mail, senha e o tipo de acesso escolhido. A mensagem de erro é sempre a mesma,
 * para não revelar se o e-mail existe nem de que tipo é a conta.
 */
export function autenticar(db: Db, emailBruto: string, senha: string, tipo: TipoAcesso): UsuarioLogado {
  const email = normalizarEmail(emailBruto);
  const u = db.select().from(schema.usuario).where(eq(schema.usuario.email, email)).get();
  // Confere a senha mesmo sem usuário, para o tempo de resposta não denunciar o e-mail
  const senhaOk = conferirSenha(senha, u?.senhaHash ?? "00:00");
  const tipoDaConta: TipoAcesso | null = u?.perfil === "fornecedor" ? "fornecedor" : u?.perfil ? "compras" : null;
  if (!u || !senhaOk || !u.ativo || tipoDaConta !== tipo) throw new ErroDeRegra(ERRO_LOGIN, { status: 401 });
  const logado = carregar(db, u.id);
  if (!logado) throw new ErroDeRegra(ERRO_LOGIN, { status: 401 });
  return logado;
}
