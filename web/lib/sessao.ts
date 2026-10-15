import { createHmac, timingSafeEqual } from "node:crypto";

import type { UsuarioPerfil } from "@/lib/db/enums";

/**
 * Cookie de sessão assinado (D49): `dados.assinatura`, HMAC-SHA256 com AUTH_SECRET.
 * Sem banco aqui: o proxy.ts usa este arquivo para barrar a rota antes de renderizar.
 * A conferência final (usuário ativo, cadastro aprovado) é a de lib/auth.ts.
 */

export interface DadosSessao {
  /** id do usuário. */
  uid: number;
  perfil: UsuarioPerfil;
  /** Validade em milissegundos (hora real da máquina, não o relógio da demo). */
  exp: number;
}

export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;

const PERFIS: readonly string[] = ["adm_master", "compras", "fornecedor", "portaria", "armazem"];

function segredo(): string {
  // Sem AUTH_SECRET (teste, primeira subida) vale um segredo fixo de desenvolvimento.
  return process.env.AUTH_SECRET || "recebimento-inteligente-desenvolvimento";
}

function assinar(dados: string): string {
  return createHmac("sha256", segredo()).update(dados).digest("base64url");
}

export function nomeCookieSessao(porta: string): string {
  return `sessao_${porta || "80"}`;
}

export function portaDoHost(host: string | null): string {
  return host?.match(/:(\d+)$/)?.[1] ?? "";
}

export function criarTokenSessao(dados: DadosSessao): string {
  const corpo = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

/** Devolve os dados se a assinatura confere e a sessão não venceu; senão, nulo. */
export function lerTokenSessao(token: string | undefined, agoraMs: number): DadosSessao | null {
  if (!token) return null;
  const [corpo, assinatura, sobra] = token.split(".");
  if (!corpo || !assinatura || sobra !== undefined) return null;
  const esperada = Buffer.from(assinar(corpo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Partial<DadosSessao>;
    if (!Number.isInteger(dados.uid) || !PERFIS.includes(String(dados.perfil)) || typeof dados.exp !== "number") return null;
    if (dados.exp <= agoraMs) return null;
    return { uid: dados.uid as number, perfil: dados.perfil as UsuarioPerfil, exp: dados.exp };
  } catch {
    return null;
  }
}

// ───────────────────────── Quem entra em qual rota ─────────────────────────

export type Acesso = "publico" | "fornecedor" | "portaria" | "armazem" | "compras" | "adm_master";

const PUBLICAS = [
  "/login",
  "/cadastro",
  "/senha",
  "/api/auth",
  "/api/cadastro",
  // Link de agendamento de uso único que Compras envia (RF1-17): o token é a credencial.
  "/agendamento/agendar",
  "/api/agendamento/agendar",
  "/api/agendamento/nf-ler",
  "/api/agendamento/cancelar",
  "/api/agendamento/atraso",
  // Download da NF pela tela confirmada do link (como antes, D05)
  "/api/agendamento/arquivos",
];

const DO_FORNECEDOR = ["/fornecedor", "/api/fornecedor"];
const DO_ADM = ["/usuarios", "/api/usuarios", "/auditoria", "/api/auditoria"];
// D53: conferência da nota fiscal na chegada. Portaria só entra aqui; o gestor de armazém, aqui e na operação do dia.
const DA_PORTARIA = ["/agendamento/portaria", "/api/agendamento/portaria", "/api/agendamento/fornecedores", "/api/agendamento/placa"];
const DO_ARMAZEM = ["/dia", "/api/dia", "/equipes", "/api/equipes", "/agendamento/descarga", "/api/agendamento/descarga"];

function comeca(caminho: string, prefixos: string[]): boolean {
  return prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`));
}

/** Perfil mínimo de cada caminho. Tudo o que não está listado é da área de Compras. */
export function acessoDoCaminho(caminho: string): Acesso {
  if (comeca(caminho, PUBLICAS)) return "publico";
  if (comeca(caminho, DO_FORNECEDOR)) return "fornecedor";
  if (comeca(caminho, DO_ADM)) return "adm_master";
  if (comeca(caminho, DA_PORTARIA)) return "portaria";
  if (comeca(caminho, DO_ARMAZEM)) return "armazem";
  return "compras";
}

export function perfilPode(perfil: UsuarioPerfil, acesso: Acesso): boolean {
  if (acesso === "publico") return true;
  if (acesso === "fornecedor") return perfil === "fornecedor";
  if (acesso === "adm_master") return perfil === "adm_master";
  const compras = perfil === "compras" || perfil === "adm_master";
  if (acesso === "armazem") return compras || perfil === "armazem";
  if (acesso === "portaria") return compras || perfil === "armazem" || perfil === "portaria";
  return compras;
}

/** Para onde cada perfil vai depois do login. */
export function inicioDoPerfil(perfil: UsuarioPerfil): string {
  if (perfil === "fornecedor") return "/fornecedor";
  return perfil === "portaria" ? "/agendamento/portaria" : "/dia";
}
