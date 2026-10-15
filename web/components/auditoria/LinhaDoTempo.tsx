import { CircleAlert, CircleCheck, CircleDot, CircleX, type LucideIcon } from "lucide-react";

import type { PassoDoTrajeto, TomDoPasso } from "@/lib/auditoria/trajeto";
import { cn } from "@/lib/utils";

const ESTILO: Record<TomDoPasso, { icone: LucideIcon; ponto: string }> = {
  ok: { icone: CircleCheck, ponto: "bg-success/10 text-success" },
  alerta: { icone: CircleAlert, ponto: "bg-warning/10 text-warning" },
  erro: { icone: CircleX, ponto: "bg-destructive/10 text-destructive" },
  neutro: { icone: CircleDot, ponto: "bg-brand/10 text-brand" },
};

/** "2026-10-05T09:12:00-03:00" → ["05/10/2026", "09:12"]. O texto já está no horário de Brasília. */
export const partesDoInstante = (iso: string) => [iso.slice(0, 10).split("-").reverse().join("/"), iso.slice(11, 16)] as const;

/** Linha do tempo vertical: o que aconteceu, quem fez e quando. Sem JavaScript no cliente. */
export function LinhaDoTempo({ passos }: { passos: PassoDoTrajeto[] }) {
  return (
    <ol className="relative grid gap-0" aria-label="Trajeto da entrega">
      {passos.map((p, i) => {
        const { icone: Icone, ponto } = ESTILO[p.tom];
        const [dia, hora] = partesDoInstante(p.em);
        const ultimo = i === passos.length - 1;
        return (
          <li key={`${p.em}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!ultimo && <span aria-hidden="true" className="absolute top-10 bottom-0 left-5 w-px -translate-x-1/2 bg-border" />}
            <span className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-full", ponto)}>
              <Icone className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <p className="font-semibold break-words">{p.titulo}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {dia} às {hora}
                </p>
              </div>
              {p.quem && <p className="text-sm">por {p.quem}</p>}
              {p.detalhe && <p className="text-sm text-muted-foreground">{p.detalhe}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
