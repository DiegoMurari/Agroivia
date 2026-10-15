"use client";

import { Forklift, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { CopiarTexto } from "@/components/painel/CopiarTexto";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { cn } from "@/lib/utils";
import type { DiaDaSemana } from "@/lib/painel/semana-chapas";

const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Um dia por linha: nome do dia, faixa de mínimo a máximo com a marca do recomendado e o número grande. */
export function PrevisaoSemana({ dias }: { dias: DiaDaSemana[] }) {
  const [escolhido, setEscolhido] = useState(dias.find((d) => d.hoje)?.data ?? dias[0]?.data);
  const dia = dias.find((d) => d.data === escolhido) ?? dias[0];
  const escala = Math.max(1, ...dias.map((d) => d.ate));
  if (!dia) return null;
  const pct = (n: number) => `${(n / escala) * 100}%`;

  return (
    <section aria-labelledby="previsao-semana" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="previsao-semana" className="text-h2 text-brand">
          Previsão de chapas
        </h2>
        <CopiarTexto texto={dia.aviso} idDoTexto="aviso-dia-escolhido" rotulo={`Copiar aviso ao prestador (${dataCurta(dia.data)})`} />
      </div>
      <p id="aviso-dia-escolhido" className="sr-only" aria-hidden="true">
        {dia.aviso}
      </p>

      {/* Cinco dias à vista; o resto rola aqui dentro, sem mexer na página */}
      <div className="max-h-[29rem] overflow-y-auto overscroll-contain rounded-2xl pr-2 [scrollbar-width:thin]" tabIndex={0} role="region" aria-label="Dias da previsão, role para ver mais">
      <ul className="grid gap-3 p-0.5" aria-label="Funcionários recomendados por dia">
        {dias.map((d) => {
          const semAgenda = d.caminhoes === 0;
          const ativo = d.data === dia.data;
          return (
            <li key={d.data}>
              <button
                type="button"
                onClick={() => setEscolhido(d.data)}
                aria-pressed={ativo}
                aria-label={`${d.diaSemana} ${dataCurta(d.data)}: ${semAgenda ? "sem agenda" : `${d.recomendado} funcionários recomendados, de ${d.de} a ${d.ate}, ${d.caminhoes} caminhões`}`}
                className={cn(
                  "grid w-full items-center gap-x-6 gap-y-3 rounded-2xl border bg-card px-5 py-4 text-left shadow-card transition-[box-shadow,border-color] hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:grid-cols-[9rem_minmax(0,1fr)_auto]",
                  ativo ? "border-brand ring-1 ring-brand" : "border-border",
                )}
              >
                <span className="flex items-baseline gap-3 md:block">
                  <span className="block text-xl font-semibold">{d.diaSemana}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                    {dataCurta(d.data)}
                    {d.hoje && <Badge variant="info">Hoje</Badge>}
                  </span>
                </span>

                {semAgenda ? (
                  <span className="text-base text-muted-foreground">Sem agenda neste dia</span>
                ) : (
                  <span className="grid gap-1.5" aria-hidden>
                    <span className="relative block h-3 rounded-full bg-muted">
                      <span className="absolute inset-y-0 rounded-full bg-brand/25" style={{ left: pct(d.de), width: `max(${pct(d.ate - d.de)}, 12px)` }} />
                      <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-brand shadow-xs" style={{ left: pct(d.recomendado) }} />
                    </span>
                    <span className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>mín. {d.de}</span>
                      <span>máx. {d.ate}</span>
                    </span>
                  </span>
                )}

                {!semAgenda && (
                  <span className="flex items-center gap-5 md:justify-end">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-4xl leading-none font-semibold text-brand tabular-nums">{d.recomendado}</span>
                      <span className="text-sm text-muted-foreground">funcionários</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                      {d.caminhoes} {d.caminhoes === 1 ? "caminhão" : "caminhões"}
                      {d.empilhadeira && <Forklift aria-label="Precisa de empilhadeira" className="size-4 text-brand" />}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      </div>

      <Card className="gap-3 p-5" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h3 text-brand">
            {dia.hoje ? "Hoje" : dia.diaSemana}, {dataBR(dia.data)}
          </h3>
          {dia.empilhadeira && (
            <Badge variant="outline">
              <Forklift /> Empilhadeira
            </Badge>
          )}
        </div>
        <p>{dia.motivo}</p>
        {dia.complemento && (
          <p className="flex items-center gap-2 text-sm">
            <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning" />
            <span>
              Complemento previsto de <strong className="text-brand">{dia.complemento}</strong>.
            </span>
          </p>
        )}
        {dia.porHorario.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead className="text-right">Recebimentos</TableHead>
                <TableHead>Armazéns</TableHead>
                <TableHead className="text-right">Funcionários</TableHead>
                <TableHead>Empilhadeira</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dia.porHorario.map((h) => (
                <TableRow key={h.horario}>
                  <TableCell className="font-medium tabular-nums">{h.horario}</TableCell>
                  <TableCell className="text-right tabular-nums">{h.recebimentos}</TableCell>
                  <TableCell>{h.armazens}</TableCell>
                  <TableCell className="text-right tabular-nums">{h.chapas}</TableCell>
                  <TableCell>{h.empilhadeira ? "Sim" : "Não"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
