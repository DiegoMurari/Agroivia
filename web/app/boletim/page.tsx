import Link from "next/link";
import { Banknote, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, CirclePlus, Droplets, Plus, TriangleAlert, Users, Wallet } from "lucide-react";

import { ClimaIcone } from "@/components/boletim/ClimaIcone";
import { FaixaFaltaBoletim } from "@/components/boletim/FaixaFaltaBoletim";
import { Numero } from "@/components/boletim/Numero";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { getDb } from "@/lib/db";
import { formatBRL, formatNumero } from "@/lib/money";
import { agoraISO, hojeISO } from "@/lib/relogio";
import { tempoDosDias } from "@/lib/tempo";
import { climaDoDia, type ClimaDoDia } from "@/lib/boletim/clima";
import { boletinsParaSoma } from "@/lib/boletim/servico";
import { agruparPorDia, gradeDoMes, mesAnterior, mesSeguinte, totaisDoMes, type TotaisDoDia } from "@/lib/boletim/dia";
import { somarDias } from "@/lib/agendamento/datas";
import { cn } from "@/lib/utils";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ehMes = (s?: string) => Boolean(s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s));
const diaUtil = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
};
const nomeDoMes = (mes: string) => new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const nomeDoDia = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
const nomeLongoDoDia = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });

type Situacao = { tipo: "boletim"; t: TotaisDoDia } | { tipo: "sem" } | { tipo: "neutro" };

/** Um dia do calendário: bloco inteiro clicável, com valor, chapas, situação e clima. */
function BlocoDoDia({ data, hoje, s, c }: { data: string; hoje: string; s: Situacao; c: ClimaDoDia }) {
  const ehHoje = data === hoje;
  const dia = Number(data.slice(8));
  const href = s.tipo === "boletim" ? `/boletim/dia/${data}` : s.tipo === "sem" || (ehHoje && diaUtil(data)) ? `/boletim/novo?data=${data}` : null;
  const completo = s.tipo === "boletim";
  const comComplemento = completo && s.t.abaixoDoPiso;

  const corpo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums", ehHoje ? "bg-brand text-brand-foreground" : "text-muted-foreground")}>{dia}</span>
        <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={`${c.descricao}${c.estimado ? " (simulado)" : ""}`}>
          <ClimaIcone tipo={c.tipo} className="size-4" />
          {c.maxC !== null && `${c.maxC}°`}
        </span>
      </div>
      <div className="mt-auto grid gap-0.5">
        {s.tipo === "boletim" && (
          <>
            <span className="text-sm leading-tight font-semibold tabular-nums text-foreground">{formatBRL(s.t.totalAPagar)}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-xs text-muted-foreground">
                {s.t.chapas} {s.t.chapas === 1 ? "funcionário" : "funcionários"}
              </span>
              {comComplemento ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning/15 px-1.5 py-px text-[11px] font-semibold text-warning [@media(max-height:700px)]:hidden">
                  <TriangleAlert className="size-3" aria-hidden="true" /> Complemento
                </span>
              ) : (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/10 px-1.5 py-px text-[11px] font-semibold text-success [@media(max-height:700px)]:hidden">
                  <CircleCheck className="size-3" aria-hidden="true" /> No piso
                </span>
              )}
            </span>
          </>
        )}
        {s.tipo === "sem" && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <CirclePlus className="size-3.5" aria-hidden="true" /> Lançar boletim
          </span>
        )}
        {s.tipo === "neutro" && ehHoje && diaUtil(data) && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
            <CirclePlus className="size-3.5" aria-hidden="true" /> Lançar hoje
          </span>
        )}
      </div>
    </>
  );

  const classes = cn(
    "group flex min-h-24 flex-col gap-1 overflow-hidden rounded-lg border p-2 md:min-h-0 transition-[transform,box-shadow] duration-200 ease-out-expo",
    completo ? "bg-card shadow-card" : "bg-card/60",
    comComplemento && "border-warning/50",
    completo && !comComplemento && "border-success/30",
    s.tipo === "sem" && "border-dashed",
    !completo && !diaUtil(data) && "bg-muted/50",
    ehHoje && "ring-2 ring-brand",
    href && "hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  );

  return href ? (
    <Link href={href} className={classes} aria-label={`${nomeLongoDoDia(data)}${completo ? `: total a pagar ${formatBRL(s.t.totalAPagar)}` : ": sem boletim"}`}>
      {corpo}
    </Link>
  ) : (
    <div className={classes}>{corpo}</div>
  );
}

function ClimaDeHoje({ c, hoje }: { c: ClimaDoDia; hoje: string }) {
  const detalhe = `${c.descricao}${c.maxC !== null ? `, ${c.minC ?? c.maxC}° a ${c.maxC}°` : ""}${c.chuvaPct !== null ? `, chuva ${c.chuvaPct}%` : ""}${c.estimado ? " (simulado)" : ""}`;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card" title={detalhe}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        <ClimaIcone tipo={c.tipo} className="size-6" />
      </span>
      <p className="min-w-0">
        <span className="block truncate text-xs font-medium text-muted-foreground first-letter:uppercase">Hoje, {nomeLongoDoDia(hoje)}</span>
        <span className="flex items-baseline gap-2">
          <span className="shrink-0 text-2xl leading-tight font-semibold tracking-tight whitespace-nowrap text-brand">{c.frase}</span>
          <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">{detalhe}</span>
        </span>
      </p>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: pedido } = await searchParams;
  const db = getDb();
  const hoje = hojeISO();
  const mes = ehMes(pedido) ? pedido! : hoje.slice(0, 7);
  const grade = gradeDoMes(mes);
  const dias = agruparPorDia(boletinsParaSoma(db, `${mes}-01`, `${mes}-31`));
  const totais = totaisDoMes(dias);
  const diasComBoletim = Object.keys(dias).length;
  const tempo = await tempoDosDias(db, `${mes}-01`, `${mes}-31`, agoraISO());
  const tempoHoje = await tempoDosDias(db, hoje, hoje, agoraISO());
  const clima = (data: string) => climaDoDia(data, hoje, tempo[data]);

  // O aviso é sobre hoje: continua em qualquer mês aberto, e `dias` só tem o mês aberto, então hoje é conferido à parte
  const faltaHoje = diaUtil(hoje) && boletinsParaSoma(db, hoje, hoje).length === 0;

  const situacao = (data: string): Situacao => {
    if (dias[data]) return { tipo: "boletim", t: dias[data] };
    return diaUtil(data) && data < hoje ? { tipo: "sem" } : { tipo: "neutro" };
  };
  const listaDoMes = grade.flat().filter((x): x is string => x !== null);

  return (
    <>
      {faltaHoje && <FaixaFaltaBoletim href={`/boletim/novo?data=${hoje}`} />}
      <PageWrapper
        title="Boletim"
        size="wide"
      >
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-rows-[auto_minmax(0,1fr)]", faltaHoje ? "md:h-[calc(100dvh-11.75rem)]" : "md:h-[calc(100dvh-9.75rem)]")}>
          <section aria-label="Hoje e números do mês" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ClimaDeHoje c={climaDoDia(hoje, hoje, tempoHoje[hoje])} hoje={hoje} />
            <Numero compacto rotulo="Total a pagar no mês" valor={formatBRL(totais.totalAPagar)} nota={`${diasComBoletim} ${diasComBoletim === 1 ? "dia" : "dias"} com boletim fechado`} icone={Wallet} />
            <Numero
              compacto
              rotulo="Pago sem produção"
              valor={formatBRL(totais.complemento)}
              nota={Number(totais.totalAPagar) > 0 ? `${formatNumero(String((Number(totais.complemento) / Number(totais.totalAPagar)) * 100), 1)}% do total do mês` : "sem valores no mês"}
              icone={Banknote}
              tom={Number(totais.complemento) > 0 ? "warning" : undefined}
            />
            <Numero compacto rotulo="Dias com complemento" valor={totais.diasComComplemento} nota={`de ${diasComBoletim} ${diasComBoletim === 1 ? "dia" : "dias"} com boletim`} icone={CalendarClock} />
          </section>

          <section aria-label="Calendário" className="grid min-h-0 gap-2 rounded-2xl border bg-card p-3 shadow-card md:flex md:flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
                  <Link href={`/boletim?mes=${mesAnterior(mes)}`}>
                    <ChevronLeft />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
                  <Link href={`/boletim?mes=${mesSeguinte(mes)}`}>
                    <ChevronRight />
                  </Link>
                </Button>
                <h2 className="ml-2 text-h3 text-brand first-letter:uppercase">{nomeDoMes(mes)}</h2>
              </div>
            <ul className="ml-auto hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:flex" aria-label="Legenda">
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-success/60 bg-success/10" /> No piso</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-warning/60 bg-warning/15" /> Complemento pago</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-dashed" /> Sem boletim</li>
              <li className="flex items-center gap-1.5"><Droplets className="size-3.5 text-brand" aria-hidden="true" /> Chuva</li>
            </ul>
              {mes !== hoje.slice(0, 7) && (
                <Button asChild variant="ghost">
                  <Link href="/boletim">
                    <CalendarDays /> Voltar para o mês atual
                  </Link>
                </Button>
              )}
            </div>

            {/* Celular: lista dos dias, um bloco por linha */}
            <ul className="grid gap-3 md:hidden">
              {listaDoMes
                .filter((d) => situacao(d).tipo !== "neutro" || d === hoje)
                .map((data) => (
                  <li key={data} className="grid grid-cols-[3.5rem_1fr] items-stretch gap-3">
                    <p className="grid place-content-center text-center">
                      <span className="block text-2xl font-semibold tabular-nums">{Number(data.slice(8))}</span>
                      <span className="block text-sm text-muted-foreground">{nomeDoDia(data)}</span>
                    </p>
                    <BlocoDoDia data={data} hoje={hoje} s={situacao(data)} c={clima(data)} />
                  </li>
                ))}
            </ul>

            {/* Tela média e grande: blocos soltos, sem grade de tabela */}
            <div className="hidden min-h-0 flex-1 flex-col md:flex" role="grid" aria-label={nomeDoMes(mes)}>
              <div className="mb-1.5 grid shrink-0 grid-cols-7 gap-1.5" role="row">
                {SEMANA.map((x) => (
                  <p key={x} className="px-1 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase" role="columnheader">
                    {x}
                  </p>
                ))}
              </div>
              <div className="grid min-h-0 flex-1 gap-1.5" style={{ gridTemplateRows: `repeat(${grade.length}, minmax(0, 1fr))` }}>
                {grade.map((semana, i) => {
                  // Os dias dos meses vizinhos preenchem a semana: contados a partir do dia real mais próximo
                  const ancora = semana.findIndex((d) => d !== null);
                  const ultima = semana.length - 1 - [...semana].reverse().findIndex((d) => d !== null);
                  return (
                  <div key={i} className="grid min-h-0 grid-cols-7 gap-1.5" role="row">
                    {semana.map((data, j) =>
                      data ? (
                        <div key={j} role="gridcell" className="contents">
                          <BlocoDoDia data={data} hoje={hoje} s={situacao(data)} c={clima(data)} />
                        </div>
                      ) : (
                        <div key={j} role="gridcell" aria-hidden="true" className="rounded-lg border border-brand/10 bg-brand/5 p-2">
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground/60">
                            {Number((i === 0 ? somarDias(semana[ancora]!, j - ancora) : somarDias(semana[ultima]!, j - ultima)).slice(8))}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Dias sem previsão aparecem com clima simulado.</p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/equipes">
                    <Users /> Escala de equipes
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/boletim/novo">
                    <Plus /> Novo boletim
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </PageWrapper>
    </>
  );
}
