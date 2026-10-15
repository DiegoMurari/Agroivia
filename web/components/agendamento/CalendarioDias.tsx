"use client";

import { Ban, ChevronLeft, ChevronRight, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Droplets, Flag, Sun } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { dataBR, nomeDoDia, somarDias } from "@/lib/agendamento/datas";
import type { DiaDoCalendario, EstadoDia } from "@/lib/agendamento/ocupacao";
import type { TempoDoDia, TipoDeTempo } from "@/lib/tempo";
import { cn } from "@/lib/utils";

/** Calendário do mês do portal do fornecedor, com o tempo de cada dia e a faixa "Próximos dias" (D52). */

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ICONE_TEMPO: Record<TipoDeTempo, typeof Sun | null> = {
  sol: Sun,
  parcial: CloudSun,
  nublado: Cloud,
  neblina: CloudFog,
  chuva: CloudRain,
  tempestade: CloudLightning,
  indefinido: null,
};

// Mesma linguagem do calendário das Equipes: cartão branco, borda fina e a cor só no que importa
const FUNDO: Record<EstadoDia, string> = {
  livre: "border-success/40 bg-card shadow-card",
  parcial: "border-brand/40 bg-card shadow-card",
  cheio: "border-border bg-muted text-muted-foreground",
  feriado: "border-warning/50 bg-card",
  fim_de_semana: "border-border/60 bg-card/60 text-muted-foreground",
  passado: "border-border/60 bg-card/60 text-muted-foreground",
};

/** Altura fixa das casas: todo mês ocupa o mesmo espaço. */
const ALTURA = "h-16 sm:h-20";

const SELECIONAVEL: EstadoDia[] = ["livre", "parcial"];

/**
 * O código do dia na previsão é o pior do dia. Com chuva pouco provável (menos de 40%), mostra
 * "pancadas isoladas" em vez de tempestade, para não esconder dia bom de descarga.
 */
export function tempoExibido(t: TempoDoDia): TempoDoDia {
  if ((t.tipo === "chuva" || t.tipo === "tempestade") && t.chuvaPct != null && t.chuvaPct < 40) {
    return { ...t, tipo: "parcial", descricao: "Pancadas isoladas" };
  }
  return t;
}

const COR_TEMPO: Record<TipoDeTempo, string> = {
  sol: "text-warning",
  parcial: "text-warning",
  nublado: "text-muted-foreground",
  neblina: "text-muted-foreground",
  chuva: "text-brand",
  tempestade: "text-brand",
  indefinido: "text-muted-foreground",
};

export function descricaoDoTempo(t: TempoDoDia): string {
  const faixa = t.minC != null && t.maxC != null ? `, ${t.minC}° a ${t.maxC}°` : "";
  const chuva = t.chuvaPct != null && t.chuvaPct > 0 ? `, ${t.chuvaPct}% de chance de chuva` : "";
  return `${t.descricao}${faixa}${chuva}`;
}

export function vagasEmPalavras(d: Pick<DiaDoCalendario, "estado" | "livres">): string {
  if (d.estado === "feriado") return "Feriado";
  if (d.estado === "cheio") return "Lotado";
  if (d.estado === "fim_de_semana") return "Fim de semana";
  if (d.estado === "passado") return "Já passou";
  return d.livres === 1 ? "1 horário livre" : `${d.livres} horários livres`;
}

function IconeTempo({ t, className }: { t: TempoDoDia; className?: string }) {
  const Icone = ICONE_TEMPO[t.tipo];
  return Icone ? <Icone className={cn(className, COR_TEMPO[t.tipo])} aria-hidden="true" /> : null;
}

function Temperaturas({ t }: { t: TempoDoDia }) {
  if (t.maxC == null && t.minC == null) return null;
  return (
    <span className="tabular-nums">
      {t.maxC != null && <span className="font-medium text-foreground">{t.maxC}°</span>} {t.minC != null && <span className="text-muted-foreground">{t.minC}°</span>}
    </span>
  );
}

function diaDaSemana(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export interface CalendarioDiasProps {
  mes: string;
  hoje: string;
  /** Dias do mês mostrado; nulo enquanto carrega. */
  dias: DiaDoCalendario[] | null;
  /** Os próximos dias úteis com vaga, de qualquer mês. */
  proximos: DiaDoCalendario[];
  tempo: Record<string, TempoDoDia>;
  escolhido: string | null;
  erro: string | null;
  podeVoltar: boolean;
  onMes: (delta: number) => void;
  /** Volta para o mês de hoje. */
  onHoje?: () => void;
  onEscolher: (data: string) => void;
  onTentarDeNovo: () => void;
}

export function CalendarioDias({ mes, hoje, dias, proximos, tempo, escolhido, erro, podeVoltar, onMes, onHoje, onEscolher, onTentarDeNovo }: CalendarioDiasProps) {
  const primeiroDia = diaDaSemana(`${mes}-01`);
  // Sempre 6 semanas, para o calendário ter o mesmo tamanho em todo mês
  const celulas = Array.from({ length: 42 }, (_, i) => somarDias(`${mes}-01`, i - primeiroDia));
  const porData = new Map((dias ?? []).map((d) => [d.data, d]));
  const nomeMes = `${MESES[Number(mes.slice(5)) - 1]} de ${mes.slice(0, 4)}`;
  return (
    <section aria-label="Calendário de descargas" className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-2xl border bg-card p-4 shadow-card sm:p-5">
      {proximos.length > 0 && (
        <div role="group" aria-labelledby="titulo-proximos" className="min-w-0 space-y-3">
          <h2 id="titulo-proximos" className="text-h3 text-brand">Próximos dias</h2>
          <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:p-0 lg:grid-cols-5">
            {proximos.map((d) => {
              const t = tempo[d.data] ? tempoExibido(tempo[d.data]) : undefined;
              const marcado = d.data === escolhido;
              return (
                <li key={d.data} className="w-[76%] shrink-0 snap-start sm:w-auto">
                  <button
                    type="button"
                    onClick={() => onEscolher(d.data)}
                    aria-pressed={marcado}
                    aria-label={`${dataBR(d.data)}, ${vagasEmPalavras(d)}${t ? `. ${descricaoDoTempo(t)}` : ""}`}
                    className={cn(
                      "flex h-full w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]",
                      FUNDO[d.estado],
                      marcado && "border-brand ring-2 ring-brand",
                    )}
                  >
                    {t && ICONE_TEMPO[t.tipo] ? <IconeTempo t={t} className="size-8 shrink-0" /> : <span className="size-8 shrink-0" aria-hidden="true" />}
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm text-muted-foreground">
                        {d.data === hoje ? "Hoje" : nomeDoDia(d.data)} · {dataBR(d.data).slice(0, 5)}
                      </span>
                      <span className={cn("block text-base font-semibold", d.estado === "livre" ? "text-success" : "text-brand")}>{vagasEmPalavras(d)}</span>
                      {t && (
                        <span className="flex items-center gap-2 text-sm">
                          <Temperaturas t={t} />
                          {t.chuvaPct != null && t.chuvaPct > 0 && (
                            <span className={cn("inline-flex items-center gap-0.5 tabular-nums", t.alertaChuva ? "font-medium text-brand" : "text-muted-foreground")}>
                              <Droplets className="size-3.5" aria-hidden="true" /> {t.chuvaPct}%
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div role="group" aria-labelledby="titulo-calendario" className={cn("grid gap-3", proximos.length > 0 && "border-t pt-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Mês anterior" disabled={!podeVoltar} onClick={() => onMes(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => onMes(1)}>
              <ChevronRight />
            </Button>
            <h2 id="titulo-calendario" className="ml-2 text-h3 text-brand">{nomeMes}</h2>
          </div>
          {onHoje && mes !== hoje.slice(0, 7) && (
            <Button variant="ghost" size="sm" onClick={onHoje}>Mês atual</Button>
          )}
        </div>

        {erro && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            <span>{erro}</span>
            <Button size="sm" variant="outline" onClick={onTentarDeNovo}>Tentar de novo</Button>
          </div>
        )}

        <div role="grid" aria-label={nomeMes} aria-busy={dias === null && !erro} className="grid gap-1.5">
          <div role="row" className="grid grid-cols-7 gap-1.5">
            {SEMANA.map((x) => (
              <p key={x} role="columnheader" className="text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">{x}</p>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, semana) => (
            <div key={semana} role="row" className="grid grid-cols-7 gap-1.5">
              {celulas.slice(semana * 7, semana * 7 + 7).map((data) => {
                const d = porData.get(data);
                if (!d) {
                  // Fora do mês (ou ainda carregando): casa fantasma do mesmo tamanho
                  const fora = data.slice(0, 7) !== mes;
                  return (
                    <div key={data} role="gridcell" aria-hidden="true" className={cn(ALTURA, "rounded-lg border p-1.5", fora ? "border-brand/10 bg-brand/5" : "skeleton border-transparent")}>
                      {fora && <span className="text-xs font-semibold tabular-nums text-muted-foreground/60">{Number(data.slice(8))}</span>}
                    </div>
                  );
                }
                const selecionavel = SELECIONAVEL.includes(d.estado);
                const semDia = d.estado === "passado" || d.estado === "fim_de_semana";
                // dia sem recebimento não mostra o tempo: só dia útil importa para agendar
                const bruto = semDia ? undefined : tempo[d.data];
                const t = bruto ? tempoExibido(bruto) : undefined;
                const marcado = d.data === escolhido;
                const ehHoje = d.data === hoje;
                const rotulo = `${dataBR(d.data)}${ehHoje ? ", hoje" : ""}: ${vagasEmPalavras(d)}${t ? `. ${descricaoDoTempo(t)}` : ""}`;
                const conteudo = (
                  <>
                    <span className="flex items-start justify-between gap-1">
                      <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums", ehHoje ? "bg-brand text-brand-foreground" : semDia ? "text-muted-foreground" : "text-foreground")}>
                        {Number(d.data.slice(8))}
                      </span>
                      {t && (
                        <span className="flex items-center gap-1 text-xs">
                          {ICONE_TEMPO[t.tipo] && <IconeTempo t={t} className="size-4 shrink-0" />}
                          <span className="hidden lg:inline"><Temperaturas t={t} /></span>
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      {selecionavel ? (
                        <span className={cn("inline-flex w-fit items-center rounded-full px-1.5 py-px text-[11px] leading-none font-semibold whitespace-nowrap", d.estado === "livre" ? "bg-success/10 text-success" : "bg-brand/10 text-brand")}>
                          <span className="sm:hidden">{d.livres}</span>
                          <span className="hidden sm:inline">{vagasEmPalavras(d)}</span>
                        </span>
                      ) : d.estado === "cheio" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] leading-none font-semibold"><Ban className="size-3" aria-hidden="true" /> <span className="hidden sm:inline">Lotado</span></span>
                      ) : d.estado === "feriado" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] leading-none font-semibold text-warning"><Flag className="size-3" aria-hidden="true" /> <span className="hidden sm:inline">Feriado</span></span>
                      ) : <span />}
                      {t?.alertaChuva && <Droplets className="size-3.5 shrink-0 text-brand" aria-hidden="true" />}
                    </span>
                  </>
                );
                const classes = cn(ALTURA, "flex flex-col justify-between rounded-lg border p-1.5 text-left sm:p-2", FUNDO[d.estado]);
                return (
                  <div key={d.data} role="gridcell" className="contents">
                    {selecionavel ? (
                      <button
                        type="button"
                        aria-label={rotulo}
                        aria-pressed={marcado}
                        title={t ? descricaoDoTempo(t) : undefined}
                        onClick={() => onEscolher(d.data)}
                        className={cn(classes, "cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]", marcado && "border-brand ring-2 ring-brand")}
                      >
                        {conteudo}
                      </button>
                    ) : (
                      <div role="img" aria-label={rotulo} title={t ? descricaoDoTempo(t) : undefined} className={classes}>
                        {conteudo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda do calendário">
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-success/40 bg-success/10" /> Todos livres</li>
          <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-brand/40 bg-brand/10" /> Alguns livres</li>
          <li className="flex items-center gap-1.5"><Ban className="size-3.5" aria-hidden="true" /> Lotado</li>
          <li className="flex items-center gap-1.5"><Flag className="size-3.5 text-warning" aria-hidden="true" /> Feriado</li>
          <li className="flex items-center gap-1.5"><Droplets className="size-3.5 text-brand" aria-hidden="true" /> Chuva provável</li>
        </ul>
      </div>
    </section>
  );
}
