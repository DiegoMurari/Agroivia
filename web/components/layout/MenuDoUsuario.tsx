"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

interface ItemDoMenu {
  label: string;
  href: string;
}

/**
 * O nome do perfil, no canto da barra. Quando o perfil tem telas extras (o Adm Master abre Auditoria e Usuários),
 * ganha uma seta para baixo e o menu; sem telas extras, é só o texto.
 */
export function MenuDoUsuario({ rotulo, nome, email, itens }: { rotulo: string; nome: string; email: string; itens: ItemDoMenu[] }) {
  const pathname = usePathname();
  const [aberto, setAberto] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (itens.length === 0) {
    return (
      <span className="hidden max-w-40 truncate text-sm font-medium whitespace-nowrap text-foreground sm:block xl:hidden 2xl:block" title={`${nome} (${email})`}>
        {rotulo}
      </span>
    );
  }

  const ativo = itens.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={menuId}
        aria-label={`Menu de ${rotulo}`}
        onClick={() => setAberto((v) => !v)}
        title={`${nome} (${email})`}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]",
          ativo && "bg-brand/10 text-brand",
        )}
      >
        <UserRound className="size-4 sm:hidden xl:block 2xl:hidden" aria-hidden="true" />
        <span className="hidden max-w-40 truncate whitespace-nowrap sm:inline xl:hidden 2xl:inline">{rotulo}</span>
        <ChevronDown className={cn("size-4 transition-transform duration-200", aberto && "rotate-180")} aria-hidden="true" />
      </button>
      {aberto && (
        <div id={menuId} className="absolute top-full right-0 z-50 mt-1 min-w-56 rounded-xl border bg-popover p-1 shadow-overlay motion-safe:animate-fade-in-down">
          <p className="px-3 py-2 text-sm">
            <span className="block font-semibold">{nome}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </p>
          <ul className="border-t pt-1">
            {itens.map((i) => {
              const atual = pathname === i.href || pathname.startsWith(`${i.href}/`);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={atual ? "page" : undefined}
                    onClick={() => setAberto(false)}
                    className={cn("flex h-10 items-center rounded-lg px-3 text-sm font-medium text-brand hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", atual && "bg-brand/10 font-semibold")}
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
