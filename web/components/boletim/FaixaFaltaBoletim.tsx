"use client";

import * as React from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";

/** Faixa fina no topo, como a das pendências do Hoje: o aviso passa devagar e some com o X. Pausa no hover e no foco. */
export function FaixaFaltaBoletim({ href }: { href: string }) {
  const [fechada, setFechada] = React.useState(false);
  if (fechada) return null;
  const itens = (copia: number) =>
    Array.from({ length: 4 }, (_, i) => (
      <li key={`${copia}-${i}`} className="flex shrink-0 items-center gap-2 pr-10 text-sm">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
        <span className="font-semibold">Falta o boletim de hoje</span>
        <Link href={href} className="font-medium text-brand underline-offset-4 hover:underline focus-visible:underline" tabIndex={copia === 0 && i === 0 ? 0 : -1}>
          Lançar o boletim de hoje
        </Link>
      </li>
    ));
  return (
    <section aria-label="Aviso do boletim" className="border-b bg-warning/10">
      <div className="mx-auto flex h-10 max-w-7xl items-center gap-3 overflow-hidden px-4 sm:px-6">
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-warning">
          <Megaphone className="size-4" aria-hidden="true" /> 1 aviso
        </p>
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
          <ul className="flex w-max animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]" style={{ animationDuration: "40s" }}>
            {itens(0)}
            <span aria-hidden="true" className="contents">
              {itens(1)}
            </span>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setFechada(true)}
          aria-label="Fechar o aviso do boletim"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/50 transition-colors hover:bg-warning/10 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
