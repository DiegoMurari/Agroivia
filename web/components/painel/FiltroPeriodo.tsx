"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const doISO = (iso: string) => new Date(`${iso}T12:00:00Z`);
const menosDias = (iso: string, n: number) => {
  const d = doISO(iso);
  d.setUTCDate(d.getUTCDate() - n);
  return ISO(d);
};
const menosMeses = (iso: string, n: number) => {
  const d = doISO(iso);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  // 31 de agosto menos 6 meses cai em fevereiro: fica no último dia do mês
  const fimDoMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
  d.setUTCDate(Math.min(dia, fimDoMes));
  return ISO(d);
};
const ultimoDiaDoMes = (anoMes: string) => ISO(new Date(Date.UTC(Number(anoMes.slice(0, 4)), Number(anoMes.slice(5, 7)), 0, 12)));

/**
 * Filtro fino acima dos gráficos: períodos prontos (semana, mês, 6 meses, 1 ano) e duas datas. Ao escolher, a página recarrega
 * sozinha com os gráficos novos (sem botão de aplicar). Sem datas vale todo o histórico.
 * Os períodos prontos terminam em hoje, ou no último dia que tem dado quando hoje já passou dele.
 */
export function FiltroPeriodo({ de: deInicial, ate: ateInicial, rotulo, primeiroDia, ultimoDia, hoje }: { de: string; ate: string; rotulo: string; primeiroDia?: string; ultimoDia?: string; hoje: string }) {
  const router = useRouter();
  const [de, setDe] = React.useState(deInicial);
  const [ate, setAte] = React.useState(ateInicial);
  const [pendente, iniciar] = React.useTransition();

  function aplicar(novoDe: string, novoAte: string) {
    const q = new URLSearchParams();
    if (novoDe) q.set("de", novoDe);
    if (novoAte) q.set("ate", novoAte);
    iniciar(() => router.replace(q.size ? `/painel?${q}` : "/painel", { scroll: false }));
  }

  const fim = ultimoDia && hoje > ultimoDiaDoMes(ultimoDia.slice(0, 7)) ? ultimoDiaDoMes(ultimoDia.slice(0, 7)) : hoje;
  const periodos = [
    { rotulo: "Semana", de: menosDias(fim, 6) },
    { rotulo: "Mês", de: menosMeses(fim, 1) },
    { rotulo: "6 meses", de: menosMeses(fim, 6) },
    { rotulo: "1 ano", de: menosMeses(fim, 12) },
  ];

  const campo = "h-9 rounded-md border border-input bg-card px-2.5 text-sm tabular-nums shadow-xs focus-visible:outline-2 focus-visible:outline-ring";
  const ativo = Boolean(de || ate);

  return (
    <div role="group" aria-label="Período da análise" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarRange className="size-4 text-brand" aria-hidden="true" /> Período
      </span>
      <span className="flex flex-wrap gap-1.5" role="group" aria-label="Períodos prontos">
        {periodos.map((p) => {
          const atual = de === p.de && ate === fim;
          return (
            <Button
              key={p.rotulo}
              type="button"
              size="sm"
              variant={atual ? "default" : "outline"}
              aria-pressed={atual}
              className={cn(atual && "bg-brand text-brand-foreground hover:bg-brand/90")}
              onClick={() => {
                setDe(p.de);
                setAte(fim);
                aplicar(p.de, fim);
              }}
            >
              {p.rotulo}
            </Button>
          );
        })}
      </span>
      <input
        type="date"
        aria-label="De"
        className={campo}
        value={de}
        min={primeiroDia}
        max={ate || ultimoDia}
        onChange={(e) => {
          setDe(e.target.value);
          aplicar(e.target.value, ate);
        }}
      />
      <span className="text-sm text-muted-foreground">até</span>
      <input
        type="date"
        aria-label="Até"
        className={campo}
        value={ate}
        min={de || primeiroDia}
        max={ultimoDia}
        onChange={(e) => {
          setAte(e.target.value);
          aplicar(de, e.target.value);
        }}
      />
      {pendente && <LoaderCircle className="size-4 animate-spin text-brand" aria-label="Atualizando os gráficos" />}
      {ativo && !pendente && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setDe("");
            setAte("");
            aplicar("", "");
          }}
        >
          <X /> Limpar
        </Button>
      )}
      <span className="ml-auto text-sm text-muted-foreground" role="status">
        {ativo ? rotulo : "Todo o histórico"}
      </span>
    </div>
  );
}
