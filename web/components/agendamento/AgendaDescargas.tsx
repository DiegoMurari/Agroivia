"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Clock, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { dataBR, diaDaSemana, nomeDoDia, somarDias } from "@/lib/agendamento/datas";
import { cn } from "@/lib/utils";

import { EstadoDaDescarga } from "./EstadoDaDescarga";

/** Agenda das próximas descargas: faixa com os dias da semana e a lista agrupada por dia (D52). */

export interface LinhaAgenda {
  id: number;
  data: string;
  horario: string;
  status: string;
  placa: string | null;
  acondicionamento: string;
  fornecedor: string;
}

/** "segunda-feira" → "Segunda". */
function semanaPorExtenso(data: string): string {
  const dia = nomeDoDia(data).split("-")[0];
  return dia.charAt(0).toUpperCase() + dia.slice(1);
}

function tituloDoDia(data: string, hoje: string): string {
  const curto = dataBR(data).slice(0, 5);
  const dia = semanaPorExtenso(data);
  const quando = data === hoje ? "Hoje" : data === somarDias(hoje, 1) ? "Amanhã" : null;
  return `${quando ? `${quando}, ${dia.toLowerCase()}` : dia} ${curto}`;
}

const TIPO_CARGA: Record<string, string> = { batido: "Carga solta", unitizado: "Em paletes ou big bag" };

/** O dia que a agenda mostra ao abrir: hoje, ou o próximo dia útil com descarga. */
function diaInicial(linhas: LinhaAgenda[], hoje: string): string | null {
  const uteis = linhas.filter((l) => !fimDeSemana(l.data)).map((l) => l.data).sort();
  if (uteis.includes(hoje)) return hoje;
  return uteis.find((d) => d > hoje) ?? uteis[0] ?? null;
}

const fimDeSemana = (data: string) => ["sábado", "domingo"].includes(semanaPorExtenso(data).toLowerCase());

export function AgendaDescargas({ linhas, hoje, atrasos }: { linhas: LinhaAgenda[]; hoje: string; atrasos: Record<number, { previsao: string }> }) {
  // Abre já num dia: hoje ou, se hoje não tem descarga, o próximo dia que tem. "Todos os dias" é escolha da pessoa.
  const [escolhido, setEscolhido] = useState<string | null>(() => diaInicial(linhas, hoje));
  if (linhas.length === 0) {
    return <EmptyState title="Nenhuma descarga marcada" description="Gere um link em Nova compra para o fornecedor agendar." />;
  }
  const dias = new Map<string, LinhaAgenda[]>();
  for (const l of linhas.filter((x) => !fimDeSemana(x.data))) dias.set(l.data, [...(dias.get(l.data) ?? []), l]);
  const visiveis = [...dias.entries()].filter(([data]) => escolhido === null || data === escolhido);

  // Os 7 dias a partir de hoje, mesmo os vazios: a semana inteira à vista
  const uteis = Array.from({ length: 21 }, (_, i) => somarDias(hoje, i)).filter((d) => !fimDeSemana(d)).slice(0, 10);
  const deslocamento = Math.max(0, diaDaSemana(uteis[0]) - 1); // colunas vazias antes do primeiro dia (Seg = 0)
  const celulas: (string | null)[] = [...Array(deslocamento).fill(null), ...uteis];
  while (celulas.length % 5 !== 0) celulas.push(null);
  const semanas = Array.from({ length: celulas.length / 5 }, (_, i) => celulas.slice(i * 5, i * 5 + 5));
  const contar = (data: string) => (dias.get(data) ?? []).filter((l) => l.status !== "cancelado").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted-foreground">Escolha um dia para ver só as descargas dele.</p>
          <button
            type="button"
            aria-pressed={escolhido === null}
            onClick={() => setEscolhido(null)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              escolhido === null ? "border-brand bg-brand text-brand-foreground" : "bg-card text-foreground hover:bg-accent",
            )}
          >
            Todos os dias
            <span className="tabular-nums">{[...dias.values()].flat().filter((l) => l.status !== "cancelado").length}</span>
          </button>
        </div>
        <div role="group" aria-label="Filtrar por dia" className="grid gap-2">
          <div className="grid grid-cols-5 gap-2" aria-hidden="true">
            {["Seg", "Ter", "Qua", "Qui", "Sex"].map((x) => (
              <p key={x} className="text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {x}
              </p>
            ))}
          </div>
          {semanas.map((semana, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              {semana.map((data, j) => {
                if (!data) return <div key={j} aria-hidden="true" className="rounded-xl bg-muted/30" />;
                const n = contar(data);
                const ativo = escolhido === data;
                const ehHoje = data === hoje;
                return (
                  <button
                    key={data}
                    type="button"
                    aria-pressed={ativo}
                    aria-label={`${semanaPorExtenso(data)}, ${dataBR(data).slice(0, 5)}: ${n} ${n === 1 ? "descarga" : "descargas"}`}
                    onClick={() => setEscolhido(ativo ? null : data)}
                    className={cn(
                      "group flex min-h-20 flex-col justify-between gap-2 min-w-0 rounded-xl border p-2 text-left sm:p-3 transition-[transform,box-shadow,background-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]",
                      ativo ? "border-brand bg-brand/10 shadow-card" : n > 0 ? "bg-card shadow-card" : "bg-card/60",
                      ehHoje && !ativo && "ring-2 ring-brand",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("grid size-8 place-items-center rounded-full text-sm font-semibold tabular-nums", ehHoje || ativo ? "bg-brand text-brand-foreground" : "text-muted-foreground")}>{Number(data.slice(8))}</span>
                      {ehHoje && <span className="hidden text-xs font-semibold text-brand sm:inline">Hoje</span>}
                    </span>
                    {n > 0 ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-sm font-semibold text-brand">
                        {n}<span className="hidden sm:inline"> {n === 1 ? "descarga" : "descargas"}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Livre</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {visiveis.length === 0 && <EmptyState title="Nenhuma descarga neste dia" description="Escolha outro dia da semana ou volte para Todos." />}

      {visiveis.map(([data, doDia]) => {
        // cancelado em cinza, no fim do dia
        const ordenadas = [...doDia].sort((a, b) => Number(a.status === "cancelado") - Number(b.status === "cancelado") || a.horario.localeCompare(b.horario) || a.id - b.id);
        const ativas = doDia.filter((l) => l.status !== "cancelado").length;
        return (
          <section key={data} aria-labelledby={`dia-${data}`} className="grid gap-3">
            <h3 id={`dia-${data}`} className="text-h3 text-brand">
              {tituloDoDia(data, hoje)} <span className="text-sm font-normal text-muted-foreground">{ativas} {ativas === 1 ? "descarga" : "descargas"}</span>
            </h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ordenadas.map((l, i) => {
                const cancelada = l.status === "cancelado";
                const aviso = l.status === "agendado" ? atrasos[l.id] : undefined;
                return (
                  <li key={l.id} className="animate-drop-in" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                    <Link
                      href={`/agendamento/descarga/${l.id}`}
                      aria-label={`Abrir descarga de ${l.fornecedor}, ${dataBR(l.data).slice(0, 5)} às ${l.horario}`}
                      className={cn(
                        "group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-card transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring",
                        cancelada && "opacity-70",
                        aviso && "border-warning/50",
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="grid size-11 place-items-center rounded-full bg-brand/10 text-brand">
                          <Clock className="size-5" aria-hidden="true" />
                        </span>
                        <EstadoDaDescarga status={l.status} pequeno />
                      </span>
                      <span className="text-2xl leading-none font-semibold tabular-nums text-brand">{l.horario}</span>
                      <span className={cn("font-semibold break-words", cancelada && "text-muted-foreground")}>{l.fornecedor}</span>
                      <span className="text-sm text-muted-foreground">
                        {TIPO_CARGA[l.acondicionamento] ?? l.acondicionamento} · {l.placa ?? "Sem placa"}
                      </span>
                      {aviso && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-warning">
                          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> Atraso avisado: chega às {aviso.previsao}
                        </span>
                      )}
                      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-brand">
                        Abrir <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
