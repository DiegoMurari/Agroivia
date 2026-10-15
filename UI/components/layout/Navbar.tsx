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
}

function isActive(pathname: string, href: string) {
  if (!href.startsWith("/")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Cabeçalho fixo com fundo translúcido (blur), logo, navegação central e ações. */
export function Navbar({ logo, items = [], actions, mainId = "main-content", className, ...props }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuId = React.useId();
  const hasItems = items.length > 0;

  React.useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/70 bg-background/70 backdrop-blur-xl backdrop-saturate-150",
        "[@media(prefers-reduced-transparency:reduce)]:bg-background",
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
        <div className="flex min-w-0 flex-1 items-center">{logo}</div>

        {hasItems && (
          <nav aria-label="Principal" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="flex flex-1 items-center justify-end gap-1.5">
          {actions}
          {hasItems && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          )}
        </div>
      </div>

      {hasItems && (
        <nav
          id={menuId}
          aria-label="Principal"
          hidden={!menuOpen}
          className="border-t md:hidden motion-safe:animate-fade-in-down"
        >
          <ul className="grid gap-1 px-4 py-3">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  onNavigate={() => setMenuOpen(false)}
                  className="h-11 w-full text-base"
                />
              </li>
            ))}
          </ul>
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
    "inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors",
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
