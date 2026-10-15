import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Cartão de número do Boletim: ícone em quadrado azul-claro, rótulo, número em azul e uma nota. */
export function Numero({ rotulo, valor, nota, icone: Icone, tom, compacto = false }: { rotulo: string; valor: string | number; nota?: string; icone: LucideIcon; tom?: "warning"; /** Faixa baixa: ícone ao lado, rótulo em cima do valor. */ compacto?: boolean }) {
  if (compacto) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card" title={nota}>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tom === "warning" ? "bg-warning/15 text-warning" : "bg-brand/10 text-brand")}>
          <Icone className="size-6" aria-hidden="true" />
        </span>
        <p className="min-w-0">
          <span className="block truncate text-xs font-medium text-muted-foreground">{rotulo}</span>
          <span className="flex items-baseline gap-2">
            <span className={cn("shrink-0 text-2xl leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums", tom === "warning" ? "text-warning" : "text-brand")}>{valor}</span>
            {nota && <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">{nota}</span>}
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tom === "warning" ? "bg-warning/15 text-warning" : "bg-brand/10 text-brand")}>
          <Icone className="size-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
      </div>
      <p className={cn("text-2xl leading-none font-semibold tracking-tight tabular-nums break-words", tom === "warning" ? "text-warning" : "text-brand")}>{valor}</p>
      {nota && <p className="text-sm text-muted-foreground">{nota}</p>}
    </div>
  );
}
