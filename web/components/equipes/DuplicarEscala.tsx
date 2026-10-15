"use client";

import * as React from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Copy, CopyPlus } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { dataBR, somarDias } from "@/lib/agendamento/datas";
import { gradeDoMes } from "@/lib/boletim/dia";
import { cn } from "@/lib/utils";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const nomeDoMes = (mes: string) => new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const outroMes = (mes: string, passo: number) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + passo, 1)).toISOString().slice(0, 7);
};

type Resumo = Record<string, { equipes: number; chapas: number }>;

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /**
   * "para": duplica a escala do dia para um dia livre (sem equipes).
   * "de": traz para o dia a escala de outro dia que já tem equipes.
   */
  modo: "para" | "de";
  /** O dia aberto na tela. */
  dia: string;
  hoje: string;
  /** Chamado com o dia que a tela deve abrir depois de copiar. */
  aoConcluir: (irPara: string) => void;
}

/** Janela para copiar escala entre dias: hoje ou um dia do calendário, e só os dias disponíveis podem ser escolhidos. */
export function DuplicarEscala({ aberto, aoFechar, modo, dia, hoje, aoConcluir }: Props) {
  // A tela remonta a janela a cada abertura (key), então ela sempre começa sem escolha
  const [alvo, setAlvo] = React.useState<string | null>(null);
  const [mes, setMes] = React.useState((modo === "para" && dia === hoje ? somarDias(hoje, 1) : modo === "para" ? hoje : dia).slice(0, 7));
  const [resumos, setResumos] = React.useState<Record<string, Resumo>>({});
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  // Quais dias do mês já têm equipes: vem do servidor, um mês de cada vez
  React.useEffect(() => {
    if (!aberto || resumos[mes]) return;
    let valido = true;
    fetch(`/api/equipes?mes=${mes}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data?: { resumo: Resumo } }>)
      .then((j) => valido && j.ok && j.data && setResumos((antes) => ({ ...antes, [mes]: j.data!.resumo })))
      .catch(() => undefined);
    return () => {
      valido = false;
    };
  }, [aberto, mes, resumos]);

  const resumo = resumos[mes];
  const grade = gradeDoMes(mes);
  const plano = grade.flat();
  const primeiro = plano.findIndex((d) => d !== null);

  /** Livre para receber (modo "para") ou com escala para trazer (modo "de"); o próprio dia nunca vale. */
  const disponivel = (d: string, r: Resumo | undefined) => {
    if (d === dia || !r) return false;
    const tem = (r[d]?.equipes ?? 0) > 0;
    return modo === "para" ? !tem : tem;
  };
  const hojeServe = hoje !== dia && (hoje.slice(0, 7) === mes ? disponivel(hoje, resumo) : false);
  // O atalho de hoje só aparece quando hoje serve; fora do mês aberto, o servidor confere ao copiar
  const mostrarHoje = hoje !== dia && (hoje.slice(0, 7) !== mes || hojeServe);

  async function copiar() {
    if (!alvo || salvando) return;
    setSalvando(true);
    setErro(null);
    const corpo = modo === "para" ? { copiarDe: dia, data: alvo } : { copiarDe: alvo, data: dia };
    try {
      const r = await fetch("/api/equipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const j = (await r.json()) as { ok: boolean; erro?: { mensagem: string } };
      setSalvando(false);
      if (!j.ok) return setErro(j.erro?.mensagem ?? "Não foi possível copiar.");
      aoFechar();
      aoConcluir(modo === "para" ? alvo : dia);
    } catch {
      setSalvando(false);
      setErro("Sem conexão. Tente de novo.");
    }
  }

  const titulo = modo === "para" ? `Duplicar a escala de ${dataBR(dia).slice(0, 5)}` : `Copiar a escala de outro dia para ${dataBR(dia).slice(0, 5)}`;
  const descricao = modo === "para" ? "Escolha um dia livre. As equipes e os funcionários deste dia vão para ele." : "Escolha um dia que já tem equipes. Elas vêm para este dia.";
  const Icone = modo === "para" ? CopyPlus : Copy;
  const rotuloBotao = modo === "para" ? (alvo ? `Duplicar para ${dataBR(alvo).slice(0, 5)}` : "Duplicar") : alvo ? `Copiar de ${dataBR(alvo).slice(0, 5)}` : "Copiar";

  return (
    <Dialog
      open={aberto}
      onClose={aoFechar}
      title={titulo}
      description={descricao}
      className="w-full max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={copiar} disabled={!alvo} loading={salvando}>
            <Icone /> {rotuloBotao}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {erro && (
          <Alert variant="destructive" title="Não deu certo">
            {erro}
          </Alert>
        )}

        {mostrarHoje && (
          <Button
            type="button"
            variant="outline"
            aria-pressed={alvo === hoje}
            onClick={() => {
              setAlvo(hoje);
              setMes(hoje.slice(0, 7));
            }}
            className={cn("h-auto justify-start gap-3 py-3", alvo === hoje && "border-brand bg-brand/10 text-brand")}
          >
            <CalendarCheck />
            <span className="text-left">
              <span className="block font-semibold">Hoje</span>
              <span className="block text-sm font-normal text-muted-foreground">{dataBR(hoje)}</span>
            </span>
          </Button>
        )}

        <div className="grid gap-2 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="icon-sm" aria-label="Mês anterior" onClick={() => setMes(outroMes(mes, -1))}>
              <ChevronLeft />
            </Button>
            <p className="text-base font-semibold text-brand first-letter:uppercase">{nomeDoMes(mes)}</p>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Próximo mês" onClick={() => setMes(outroMes(mes, 1))}>
              <ChevronRight />
            </Button>
          </div>
          <div role="grid" aria-label={nomeDoMes(mes)} aria-busy={!resumo} className="grid gap-1">
            <div role="row" className="grid grid-cols-7 gap-1">
              {SEMANA.map((x, i) => (
                <p key={i} role="columnheader" className="text-center text-xs font-semibold text-muted-foreground">
                  {x}
                </p>
              ))}
            </div>
            {grade.map((semana, i) => (
              <div key={i} role="row" className="grid grid-cols-7 gap-1">
                {semana.map((d, j) => {
                  if (!d) {
                    const vizinho = somarDias(plano[primeiro]!, i * 7 + j - primeiro);
                    return (
                      <span key={j} role="gridcell" aria-hidden="true" className="grid h-9 place-items-center rounded-md bg-brand/5 text-xs text-muted-foreground/60 tabular-nums">
                        {Number(vizinho.slice(8))}
                      </span>
                    );
                  }
                  const serve = disponivel(d, resumo);
                  const ativo = d === alvo;
                  const equipes = resumo?.[d]?.equipes ?? 0;
                  const motivo = d === dia ? "é o dia aberto" : !resumo ? "carregando" : serve ? "disponível" : modo === "para" ? "já tem equipes" : "sem equipes";
                  return (
                    <button
                      key={j}
                      type="button"
                      role="gridcell"
                      disabled={!serve}
                      aria-selected={ativo}
                      aria-label={`${dataBR(d)}, ${motivo}`}
                      title={serve ? (modo === "de" ? `${equipes} ${equipes === 1 ? "equipe" : "equipes"}` : "Livre") : motivo}
                      onClick={() => setAlvo(d)}
                      className={cn(
                        "grid h-9 place-items-center rounded-md border text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        ativo ? "border-brand bg-brand text-brand-foreground" : serve ? "border-brand/40 bg-brand/10 font-semibold text-brand hover:bg-brand/20" : "border-transparent bg-muted/60 text-muted-foreground/50",
                        !serve && "cursor-not-allowed",
                        d === hoje && !ativo && "ring-1 ring-brand",
                      )}
                    >
                      {Number(d.slice(8))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-brand/40 bg-brand/10" aria-hidden="true" /> {modo === "para" ? "Dia livre" : "Dia com escala"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-muted/60" aria-hidden="true" /> {modo === "para" ? "Já tem equipes" : "Sem equipes"}
            </span>
          </p>
        </div>
      </div>
    </Dialog>
  );
}
