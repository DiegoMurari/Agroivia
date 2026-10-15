"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert, X } from "lucide-react";

export interface ItemDeAviso {
  id: string;
  titulo: string;
  texto: string;
  href?: string;
}

/**
 * Faixa no topo da tela com avisos passando, como manchetes (a mesma do Hoje).
 * Pausa no hover e no foco; o X fecha até a próxima visita. Sem avisos, não aparece.
 */
export function FaixaDeAvisos({ itens, singular = "aviso", plural = "avisos" }: { itens: ItemDeAviso[]; singular?: string; plural?: string }) {
  const [fechada, setFechada] = React.useState(false);
  if (fechada || itens.length === 0) return null;
  const lista = (copia: number) =>
    itens.map((a) => {
      const conteudo = (
        <>
          <span className="font-semibold">{a.titulo}</span>: {a.texto}
        </>
      );
      return (
        <li key={`${copia}-${a.id}`} className="flex shrink-0 items-center gap-2 pr-10 text-sm">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
          {a.href ? (
            <Link href={a.href} className="hover:underline focus-visible:underline" tabIndex={copia === 0 ? 0 : -1}>
              {conteudo}
            </Link>
          ) : (
            <span>{conteudo}</span>
          )}
        </li>
      );
    });
  return (
    <section aria-label={`Avisos: ${itens.length} ${itens.length === 1 ? singular : plural}`} className="border-b bg-warning/10">
      <div className="mx-auto flex h-10 max-w-7xl items-center gap-3 overflow-hidden px-4 sm:px-6">
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-warning">
          <TriangleAlert className="size-4" aria-hidden="true" /> {itens.length} {itens.length === 1 ? singular : plural}
        </p>
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
          <ul className="group flex w-max animate-marquee focus-within:[animation-play-state:paused] hover:[animation-play-state:paused]" style={{ animationDuration: `${Math.max(25, itens.length * 12)}s` }}>
            {lista(0)}
            <span aria-hidden="true" className="contents">
              {lista(1)}
            </span>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setFechada(true)}
          aria-label="Fechar os avisos"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/50 transition-colors hover:bg-warning/10 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
