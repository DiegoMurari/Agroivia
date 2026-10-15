import Link from "next/link";
import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { somarDias } from "@/lib/agendamento/datas";
import { gradeDoMes, mesAnterior, mesSeguinte } from "@/lib/boletim/dia";
import { cn } from "@/lib/utils";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const nomeDoMes = (mes: string) => new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Calendário do mês da escala: cada dia mostra quantas equipes e chapas tem; clicar abre a escala do dia. */
export function CalendarioDeEquipes({ mes, selecionado, hoje, resumo }: { mes: string; selecionado: string; hoje: string; resumo: Record<string, { equipes: number; chapas: number }> }) {
  // Sempre 6 semanas, para o calendário ter o mesmo tamanho em todo mês
  const real = gradeDoMes(mes);
  const grade = [...real, ...Array.from({ length: 6 - real.length }, () => Array<string | null>(7).fill(null))];
  const plano = grade.flat();
  const primeiro = plano.findIndex((d) => d !== null);
  return (
    <section aria-label="Calendário da escala" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
            <Link href={`/equipes?mes=${mesAnterior(mes)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
            <Link href={`/equipes?mes=${mesSeguinte(mes)}`}>
              <ChevronRight />
            </Link>
          </Button>
          <h2 className="ml-2 text-h3 text-brand first-letter:uppercase">{nomeDoMes(mes)}</h2>
        </div>
        {mes !== hoje.slice(0, 7) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/equipes">Mês atual</Link>
          </Button>
        )}
      </div>

      <div role="grid" aria-label={nomeDoMes(mes)} className="grid gap-1.5">
        <div role="row" className="grid grid-cols-7 gap-1.5">
          {SEMANA.map((x) => (
            <p key={x} role="columnheader" className="text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {x}
            </p>
          ))}
        </div>
        {grade.map((semana, i) => {
          return (
            <div key={i} role="row" className="grid grid-cols-7 gap-1.5">
              {semana.map((data, j) => {
                if (!data) {
                  const vizinho = somarDias(plano[primeiro]!, i * 7 + j - primeiro);
                  return (
                    <div key={j} role="gridcell" aria-hidden="true" className="h-20 rounded-lg border border-brand/10 bg-brand/5 p-1.5">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground/60">{Number(vizinho.slice(8))}</span>
                    </div>
                  );
                }
                const r = resumo[data];
                const ativo = data === selecionado;
                return (
                  <div key={j} role="gridcell" className="contents">
                    <Link
                      href={`/equipes?data=${data}`}
                      aria-current={ativo ? "date" : undefined}
                      aria-label={`${Number(data.slice(8))}: ${r ? `${r.equipes} ${r.equipes === 1 ? "equipe" : "equipes"}, ${r.chapas} ${r.chapas === 1 ? "funcionário" : "funcionários"}` : "sem equipes"}`}
                      className={cn(
                        "flex h-20 flex-col gap-1 overflow-hidden rounded-lg border p-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring",
                        r ? "bg-card shadow-card" : "bg-card/60",
                        ativo ? "border-brand ring-2 ring-brand" : r ? "border-brand/30" : "",
                      )}
                    >
                      <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums", data === hoje ? "bg-brand text-brand-foreground" : "text-muted-foreground")}>{Number(data.slice(8))}</span>
                      {r && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand/10 px-1.5 py-px text-[11px] leading-none whitespace-nowrap font-semibold text-brand tabular-nums">
                          <UsersRound className="size-3" aria-hidden="true" /> {r.equipes} · {r.chapas}
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Em cada dia: equipes · funcionários escalados.</p>
    </section>
  );
}
