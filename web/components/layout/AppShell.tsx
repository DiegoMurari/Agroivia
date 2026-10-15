import Image from "next/image";
import Link from "next/link";

import { BotaoSair } from "@/components/auth/BotaoSair";
import { Navbar, type NavItem } from "@/components/layout/Navbar";
import { ScrollReveal } from "@/components/layout/ScrollReveal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usuarioAtual, type UsuarioLogado } from "@/lib/auth";
import { inicioDoPerfil, perfilPode } from "@/lib/sessao";
import { MenuDoUsuario } from "@/components/layout/MenuDoUsuario";
import { BotaoVoltar } from "@/components/layout/BotaoVoltar";
import { site } from "@/lib/site";

const NAV_COMPRAS: NavItem[] = [
  { label: "Hoje", href: "/dia" },
  { label: "Agendamento", href: "/agendamento" },
  { label: "Boletim", href: "/boletim" },
  { label: "Equipes", href: "/equipes" },
  { label: "Painel gerencial", href: "/painel" },
  { label: "Cadastros", href: "/cadastros" },
  { label: "Portaria", href: "/agendamento/portaria" },
];

const APROVACOES: NavItem = { label: "Aprovações", href: "/aprovacoes" };

/** Aprovações fica sempre por último (D52). */
const NAV_COMPRAS_COMPLETA: NavItem[] = [...NAV_COMPRAS, APROVACOES];
const NAV_ADM: NavItem[] = [...NAV_COMPRAS, APROVACOES];

/** O que cada perfil abre pelo menu do próprio nome, no canto da barra (Auditoria e Usuários são do Adm Master). */
export function menuDoUsuario(usuario: UsuarioLogado): NavItem[] {
  return usuario.perfil === "adm_master" ? [{ label: "Auditoria", href: "/auditoria" }, { label: "Usuários", href: "/usuarios" }] : [];
}

const NAV_FORNECEDOR: NavItem[] = [
  { label: "Agendar descarga", href: "/fornecedor" },
  { label: "Meus pedidos", href: "/fornecedor/pedidos" },
  { label: "Meus dados", href: "/fornecedor/dados" },
];

// D53: a portaria só confere a nota fiscal na chegada; o gestor de armazém confere e opera o dia
const NAV_PORTARIA: NavItem[] = [{ label: "Conferir nota fiscal", href: "/agendamento/portaria" }];
const NAV_ARMAZEM: NavItem[] = [{ label: "Hoje", href: "/dia" }, { label: "Equipes", href: "/equipes" }, ...NAV_PORTARIA];

const PERFIL_ROTULO = { adm_master: "Adm Master", compras: "Compras", fornecedor: "Fornecedor", portaria: "Portaria", armazem: "Gestor de armazém" } as const;

/** Navegação de cada perfil (D49). Sem sessão (login, cadastro, link do fornecedor) a barra só mostra a marca. */
export function navegacaoDe(usuario: UsuarioLogado | null): NavItem[] {
  if (!usuario) return [];
  if (usuario.perfil === "fornecedor") return usuario.cadastroStatus === "aprovado" ? NAV_FORNECEDOR : [];
  if (usuario.perfil === "portaria") return NAV_PORTARIA;
  if (usuario.perfil === "armazem") return NAV_ARMAZEM;
  return usuario.perfil === "adm_master" ? NAV_ADM : NAV_COMPRAS_COMPLETA;
}

/** Uma linha só na barra (D52): a empresa do fornecedor, ou o perfil de quem é da Agrovia. */
function rotuloDaBarra(usuario: UsuarioLogado): string {
  if (usuario.perfil === "fornecedor") return usuario.empresa ?? usuario.nome;
  return PERFIL_ROTULO[usuario.perfil];
}

function Logo({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label={`${site.name}: início`}
      className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {/* A logo da Agrovia é feita para fundo branco: a moldura branca vale nos dois temas */}
      <span className="rounded-lg bg-white px-2 py-1">
        <Image src="/agrovia-logo.png" alt="AGROVIA" width={160} height={41} priority unoptimized className="h-[clamp(1.75rem,2.6vw,2.5rem)] w-auto" />
      </span>
    </Link>
  );
}

/** Barra de navegação por perfil, com a marca, o usuário e a saída, e o <main> de todas as telas. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();

  return (
    <>
      {/* A barra não sai no papel (impressão do boletim); `contents` mantém o sticky do Navbar */}
      <div className="contents print:hidden">
        <Navbar
          logo={<Logo href={!usuario ? "/login" : inicioDoPerfil(usuario.perfil)} />}
          items={navegacaoDe(usuario)}
          menuRodape={usuario ? <BotaoSair tamanho="md" className="h-11 w-full justify-start px-3 text-base text-brand" /> : undefined}
          actions={
            <>
              {usuario && (
                <>
                  <MenuDoUsuario rotulo={rotuloDaBarra(usuario)} nome={usuario.nome} email={usuario.email} itens={menuDoUsuario(usuario)} />
                  <BotaoSair className="max-xl:hidden" />
                </>
              )}
              <ThemeToggle />
            </>
          }
        />
      </div>
      <ScrollReveal />
      <BotaoVoltar perfil={usuario?.perfil ?? null} />
      <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">
        {children}
      </main>
    </>
  );
}
