import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Bloco que abre e fecha (<details> nativo, sem JavaScript), com cabeçalho em destaque, fundo próprio e seta que gira. */
export function Recolhivel({ titulo, children, className }: { titulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <details className={cn("group overflow-hidden rounded-2xl border bg-card shadow-card", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-muted/60 px-5 py-4 text-lg font-semibold text-brand transition-colors select-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {titulo}
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card shadow-xs">
          <ChevronDown className="size-5 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t px-5 py-5">{children}</div>
    </details>
  );
}
