import { NextResponse, type NextRequest } from "next/server";

import { acessoDoCaminho, inicioDoPerfil, lerTokenSessao, nomeCookieSessao, perfilPode, portaDoHost } from "@/lib/sessao";

/**
 * Primeira barreira de permissão (D49): roda no servidor antes de qualquer página ou rota.
 * Sem sessão válida: página vai para /login, API responde 401. Perfil errado: 403 ou volta para a área dele.
 * A conferência com o banco (usuário ativo, cadastro aprovado) fica em lib/auth.ts.
 */
export function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  const acesso = acessoDoCaminho(caminho);
  const cookie = nomeCookieSessao(portaDoHost(request.headers.get("host")));
  const sessao = lerTokenSessao(request.cookies.get(cookie)?.value, Date.now());
  const api = caminho.startsWith("/api/");

  if (acesso === "publico") {
    // Quem já entrou não vê o login de novo
    if (sessao && caminho === "/login") return NextResponse.redirect(new URL(inicioDoPerfil(sessao.perfil), request.url));
    return NextResponse.next();
  }

  if (!sessao) {
    if (api) return NextResponse.json({ ok: false, erro: { mensagem: "Entre no sistema para continuar." } }, { status: 401 });
    const login = new URL("/login", request.url);
    if (caminho !== "/") login.searchParams.set("voltar", caminho);
    return NextResponse.redirect(login);
  }

  if (!perfilPode(sessao.perfil, acesso)) {
    if (api) return NextResponse.json({ ok: false, erro: { mensagem: "Seu perfil não tem acesso a esta área." } }, { status: 403 });
    return NextResponse.redirect(new URL(inicioDoPerfil(sessao.perfil), request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Tudo, menos arquivos do Next e arquivos estáticos (logo, ícone)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
