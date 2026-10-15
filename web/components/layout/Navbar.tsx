"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  /** Abre em nova aba e mostra o ícone de link externo. */
  external?: boolean;
}

export interface NavbarProps extends React.ComponentProps<"header"> {
  /** Esquerda: logo ou nome do produto. */
  logo?: React.ReactNode;
  /** Centro: navegação principal. No mobile vira um menu. */
  items?: NavItem[];
  /** Direita: ações e perfil (ThemeToggle, avatar, botão de CTA...). */
  actions?: React.ReactNode;
  /** id do elemento <main>, alvo do link "Pular para o conteúdo". */
  mainId?: string;
  /** Rodapé do menu das telas menores (por exemplo, o botão Sair). */
  menuRodape?: React.ReactNode;
}

function casa(pathname: string, href: string) {
  if (!href.startsWith("/")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Item ativo: o de caminho mais longo que casa com a rota (`/fornecedor/pedidos` não acende `/fornecedor`). */
function hrefAtivo(pathname: string, items: NavItem[]): string | null {
  let melhor: string | null = null;
  for (const item of items) {
    if (casa(pathname, item.href) && (melhor === null || item.href.length > melhor.length)) melhor = item.href;
  }
  return melhor;
}

/** Cabeçalho fixo com fundo translúcido (blur), logo, navegação central e ações. */
export function Navbar({ logo, items = [], actions, mainId = "main-content", menuRodape, className, ...props }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuId = React.useId();
  const hasItems = items.length > 0;
  const ativoDaRota = hrefAtivo(pathname, items);
  // Ao clicar, o destaque já desliza para o item, sem esperar a página carregar
  const [alvo, setAlvo] = React.useState<{ href: string; rota: string } | null>(null);
  const ativo = alvo && alvo.rota === pathname ? alvo.href : ativoDaRota;
  // No celular o botão do menu diz em que tela a pessoa está
  const telaAtual = items.find((i) => i.href === ativo)?.label ?? "Início";

  // Destaque que desliza de um item para o outro
  const listaRef = React.useRef<HTMLUListElement>(null);
  const [indicador, setIndicador] = React.useState<{ x: number; largura: number } | null>(null);
  const [pronto, setPronto] = React.useState(false);
  React.useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const medir = () => {
      const li = ativo ? Array.from(lista.querySelectorAll<HTMLElement>("li[data-href]")).find((el) => el.dataset.href === ativo) : null;
      setIndicador(li ? { x: li.offsetLeft, largura: li.offsetWidth } : null);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(lista);
    const t = window.setTimeout(() => setPronto(true), 50);
    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, [ativo, items]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  // A tela de login ocupa a janela inteira, sem barra
  if (pathname === "/login") return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/70 bg-card/80 backdrop-blur-xl backdrop-saturate-150",
        "[@media(prefers-reduced-transparency:reduce)]:bg-card",
        className,
      )}
      {...props}
    >
      <a
        href={`#${mainId}`}
        className="absolute top-2 left-4 z-50 -translate-y-16 rounded-md bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-overlay transition-transform focus-visible:translate-y-0"
      >
        Pular para o conteúdo
      </a>

      <div className="flex h-(--header-height) items-center gap-4 px-4 sm:px-6">
        <div className="flex shrink-0 items-center">{logo}</div>

        {hasItems && (
          <nav aria-label="Principal" className="hidden min-w-0 flex-1 justify-center xl:flex">
            <ul ref={listaRef} className="relative flex items-center gap-0.5 2xl:gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute top-1/2 left-0 h-11 rounded-lg bg-brand/10 ease-out-expo motion-reduce:transition-none",
                  pronto ? "transition-[transform,width] duration-500" : "transition-none",
                  indicador ? "opacity-100" : "opacity-0",
                )}
                style={{ width: indicador?.largura ?? 0, transform: `translate(${indicador?.x ?? 0}px, -50%)` }}
              />
              {items.map((item) => (
                <li key={item.href} data-href={item.href} className="relative">
                  <NavLink item={item} active={item.href === ativo} onNavigate={() => setAlvo({ href: item.href, rota: pathname })} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center justify-end gap-3 xl:ml-0">
          {actions}
          {hasItems && (
            <Button
              variant="outline"
              className="gap-2 px-3 text-brand xl:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Fechar o menu" : `Abrir o menu. Você está em ${telaAtual}`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X /> : <Menu />}
              <span aria-hidden="true" className="flex max-w-40 items-center gap-1.5">
                <span className="font-semibold">Menu</span>
                <span className="hidden truncate border-l pl-2 font-normal text-muted-foreground sm:inline">{telaAtual}</span>
              </span>
            </Button>
          )}
        </div>
      </div>

      {hasItems && (
        <nav
          id={menuId}
          aria-label="Principal"
          hidden={!menuOpen}
          className="border-t xl:hidden motion-safe:animate-fade-in-down"
        >
          <ul className="grid gap-1 px-4 py-3">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={item.href === ativo}
                  onNavigate={() => setMenuOpen(false)}
                  className="h-11 w-full text-base"
                />
              </li>
            ))}
          </ul>
          {menuRodape && <div className="border-t px-4 py-2">{menuRodape}</div>}
        </nav>
      )}
    </header>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  className,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const classes = cn(
    "relative z-10 inline-flex h-11 items-center gap-1 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap transition-colors 2xl:px-4 2xl:text-base",
    active ? "font-semibold text-brand xl:bg-transparent max-xl:bg-brand/10" : "text-brand hover:bg-accent",
    className,
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={classes} onClick={onNavigate}>
        {item.label}
        <ArrowUpRight className="size-3.5 opacity-60" />
        <span className="sr-only">(abre em nova aba)</span>
      </a>
    );
  }

  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={classes} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}
