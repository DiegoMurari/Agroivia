import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { deploysPerDay } from "./data";

const MAX = 40; // topo da escala, arredondado
const TICKS = [0, 20, 40];
const LABELED_DAYS = new Set([0, 7, deploysPerDay.length - 1]);

/**
 * Gráfico de barras em ênfase: o dia atual na cor da marca, o resto em cinza.
 * Hover mostra o valor; a tabela em <details> deixa todos os valores acessíveis.
 */
export function DeploysChart() {
  const todayIndex = deploysPerDay.length - 1;
  const today = deploysPerDay[todayIndex];

  return (
    <figure className="space-y-4">
      <div aria-hidden="true">
        <div className="relative h-44">
          {TICKS.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
              style={{ bottom: `${(tick / MAX) * 100}%` }}
            >
              <span className="w-6 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{tick}</span>
              <span className={cn("h-px flex-1", tick === 0 ? "bg-border" : "bg-border/60")} />
            </div>
          ))}

          <div className="absolute inset-y-0 right-0 left-8 grid grid-cols-14 items-end gap-1.5">
            {deploysPerDay.map((point, index) => {
              const isToday = index === todayIndex;
              const height = `${(point.value / MAX) * 100}%`;

              return (
                <div key={point.day} className="group relative flex h-full items-end justify-center">
                  <div
                    className={cn(
                      "w-full max-w-6 rounded-t-[4px] transition-colors duration-150",
                      isToday ? "bg-chart-1" : "bg-muted-foreground/25 group-hover:bg-muted-foreground/45",
                    )}
                    style={{ height }}
                  />
                  {isToday && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 pb-1 text-xs font-semibold text-foreground transition-opacity group-hover:opacity-0"
                      style={{ bottom: height }}
                    >
                      {point.value}
                    </span>
                  )}
                  <span
                    className={cn(
                      "pointer-events-none absolute left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 whitespace-nowrap shadow-elevated",
                      "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                    )}
                    style={{ bottom: height }}
                  >
                    <span className="block text-sm font-semibold text-popover-foreground">{point.value} deploys</span>
                    <span className="block text-xs text-muted-foreground">{point.day}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 ml-8 grid grid-cols-14 gap-1.5 font-mono text-[11px] text-muted-foreground">
          {deploysPerDay.map((point, index) => (
            <span
              key={point.day}
              className={cn("text-center whitespace-nowrap", !LABELED_DAYS.has(index) && "invisible")}
            >
              {point.day}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="text-[13px] text-muted-foreground">
        Hoje é o pico do período, com {today.value} deploys.
      </figcaption>

      <details className="group/table">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform duration-150 group-open/table:rotate-90" />
          Ver dados em tabela
        </summary>
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Deploys por dia nos últimos 14 dias</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                Dia
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Deploys
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 tabular-nums">
            {deploysPerDay.map((point) => (
              <tr key={point.day}>
                <td className="py-1.5">{point.day}</td>
                <td className="py-1.5 text-right">{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
