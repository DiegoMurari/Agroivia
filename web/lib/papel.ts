import { headers } from "next/headers";

import { USUARIO_PAPEL, type UsuarioPapel } from "@/lib/db/enums";

/**
 * Papel do usuário, sem autenticação (D05): seletor na barra, guardado em cookie.
 * O nome do cookie leva a porta, porque cookie de localhost vale em todas as portas
 * e um servidor trocaria o papel do outro. Só código de servidor importa este arquivo.
 */

export const PAPEIS = USUARIO_PAPEL;
export type Papel = UsuarioPapel;

export const PAPEL_PADRAO: Papel = "compras";

export const PAPEL_ROTULO: Record<Papel, string> = {
  fornecedor: "Fornecedor",
  compras: "Compras",
  portaria: "Portaria",
  responsavel: "Responsável pelo armazém",
  direcao: "Direção",
};

export function nomeCookiePapel(porta: string): string {
  return `papel_${porta || "80"}`;
}

function portaDoHost(host: string | null): string {
  return host?.match(/:(\d+)$/)?.[1] ?? "";
}

/** Nome do cookie deste servidor (pela porta do pedido). */
export async function cookiePapelAtual(): Promise<string> {
  return nomeCookiePapel(portaDoHost((await headers()).get("host")));
}

/**
 * Papel de quem está agindo, para o autor dos eventos. Com login (D49) vem da sessão:
 * Adm Master e Compras agem como `compras`; o fornecedor, como `fornecedor`;
 * a portaria, como `portaria`; o gestor de armazém, como `responsavel`.
 * Sem sessão (link público do fornecedor), `fornecedor`.
 */
export async function papelAtual(): Promise<Papel> {
  const { usuarioAtual } = await import("@/lib/auth");
  const usuario = await usuarioAtual();
  if (!usuario) return "fornecedor";
  if (usuario.perfil === "fornecedor" || usuario.perfil === "portaria") return usuario.perfil;
  return usuario.perfil === "armazem" ? "responsavel" : "compras";
}
