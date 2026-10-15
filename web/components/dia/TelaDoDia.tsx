"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, Forklift, Megaphone, PackageOpen, Truck, Warehouse, X } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { cn } from "@/lib/utils";
import type { AgendamentoDia, PendenciaAberta } from "@/lib/dia/servico";
import type { DadosDia as Dados } from "@/lib/dia/tela";
import { Carrossel, CartaoFantasma, CARTOES_VISIVEIS, LARGURA_DO_CARTAO, QuadroVazio } from "./Carrossel";
import { CartaoEntrega, LinhaEntrega, useAcoes, useRelogioDoServidor } from "./Operacao";

/** HH:MM de um instante ISO com fuso -03:00 (o texto já está no horário de Brasília). */
const hora = (iso: string) => iso.slice(11, 16);
function idade(desdeISO: string, hoje: string) {
  const dias = Math.max(0, Math.round((Date.parse(`${hoje}T12:00:00-03:00`) - Date.parse(`${desdeISO.slice(0, 10)}T12:00:00-03:00`)) / 86400000));
  return dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/** Faixa no topo da tela com as pendências abertas passando, como manchetes. Pausa no hover e no foco. */
function FaixaDePendencias({ pendencias, hoje }: { pendencias: PendenciaAberta[]; hoje: string }) {
  const [fechada, setFechada] = React.useState(false);
  const ordenadas = [...pendencias].sort((x, y) => x.abertaEm.localeCompare(y.abertaEm));
  if (fechada) return null;
  if (ordenadas.length === 0) {
    return (
      <div className="border-b bg-success/10 text-success" role="status">
        <p className="mx-auto flex h-10 max-w-7xl items-center gap-2 px-4 text-sm font-medium sm:px-6">
          <Megaphone className="size-4" aria-hidden="true" /> Nenhuma pendência aberta
        </p>
      </div>
    );
  }
  const itens = (copia: number) =>
    ordenadas.map((p) => (
      <li key={`${copia}-${p.id}`} className="flex shrink-0 items-center gap-2 pr-10 text-sm">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
        <Link href={`/agendamento/descarga/${p.agendamentoId}`} className="hover:underline focus-visible:underline" tabIndex={copia === 0 ? 0 : -1}>
          <span className="font-semibold">{p.fornecedor}</span>: {p.descricao ?? "sem descrição"}
        </Link>
        <span className="text-muted-foreground">{idade(p.abertaEm, hoje)}</span>
      </li>
    ));
  return (
    <section aria-label="Pendências abertas" className="border-b bg-warning/10">
      <div className="mx-auto flex h-10 max-w-7xl items-center gap-3 overflow-hidden px-4 sm:px-6">
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-warning">
          <Megaphone className="size-4" aria-hidden="true" /> {ordenadas.length} {ordenadas.length === 1 ? "pendência" : "pendências"}
        </p>
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
          <ul className="group flex w-max animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]" style={{ animationDuration: `${Math.max(25, ordenadas.length * 12)}s` }}>
            {itens(0)}
            <span aria-hidden="true" className="contents">
              {itens(1)}
            </span>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setFechada(true)}
          aria-label="Fechar o aviso de pendências"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/50 transition-colors hover:bg-warning/10 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/** Painel do dia: uma faixa fina com os números e as empilhadeiras, no topo da tela. */
function PainelDoDia({ total, patio, descarregando, concluidos, emUso, empilhadeiras }: { total: number; patio: number; descarregando: number; concluidos: number; emUso: number; empilhadeiras: number }) {
  const pct = empilhadeiras > 0 ? Math.min(100, Math.round((emUso / empilhadeiras) * 100)) : 0;
  const itens = [
    { rotulo: "Caminhões hoje", valor: total, icone: Truck },
    { rotulo: "No pátio", valor: patio, icone: Warehouse },
    { rotulo: "Descarregando", valor: descarregando, icone: PackageOpen, vivo: descarregando > 0 },
    { rotulo: "Concluídos", valor: concluidos, icone: CircleCheck },
  ];
  return (
    <section aria-label="Painel do dia" className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-card lg:grid-cols-[repeat(4,1fr)_1.4fr]">
      {itens.map(({ rotulo, valor, icone: Icone, vivo }, i) => (
        <div key={rotulo} className={"group flex items-center gap-3 border-b px-5 py-3.5 transition-colors hover:bg-accent/60 lg:border-b-0 " + (i > 0 ? "lg:border-l " : "") + (i % 2 === 1 ? "border-l lg:border-l" : "")}>
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
            {vivo && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-xl bg-brand/20" />}
            <Icone className="relative size-5" aria-hidden="true" />
          </span>
          <p>
            <span className="block text-3xl leading-none font-semibold tabular-nums text-brand">{valor}</span>
            <span className="text-sm text-muted-foreground">{rotulo}</span>
          </p>
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-3 border-t px-5 py-3.5 lg:col-span-1 lg:border-t-0 lg:border-l">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Forklift className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1 tabular-nums">
            <span className="text-3xl leading-none font-semibold text-brand">{emUso}</span>
            <span className="text-lg text-muted-foreground">/ {empilhadeiras}</span>
            <span className="ml-1 text-sm text-muted-foreground">empilhadeiras</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Empilhadeiras: ${emUso} de ${empilhadeiras} em uso`}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Em andamento primeiro, por horário; concluídos vão para o fim da lista; cancelados por último. */
function ordenar(lista: AgendamentoDia[]): AgendamentoDia[] {
  const peso = (a: AgendamentoDia) => (a.status === "cancelado" || a.status === "nao_recebido" ? 2 : a.status === "concluido" ? 1 : 0);
  return [...lista].sort((x, y) => peso(x) - peso(y) || x.horario.localeCompare(y.horario) || x.id - y.id);
}

export function TelaDoDia({ inicial, podeOperar }: { inicial: Dados; podeOperar: boolean }) {
  const [d, setD] = React.useState(inicial);
  const [falhou, setFalhou] = React.useState(false);
  /** Instante do navegador em que os dados chegaram: base do cronômetro ao vivo. */
  const [recebidoEm, setRecebidoEm] = React.useState<number | null>(null);
  const seq = React.useRef(0);

  const recarregar = React.useCallback(async () => {
    const n = ++seq.current;
    try {
      const r = await fetch("/api/dia", { cache: "no-store" });
      const json = (await r.json()) as { ok: boolean; data: Dados };
      if (n !== seq.current) return; // resposta antiga: já há uma leitura mais nova
      if (json.ok) {
        setD(json.data);
        setRecebidoEm(performance.now());
        setFalhou(false);
      } else setFalhou(true);
    } catch {
      setFalhou(true);
    }
  }, []);

  React.useEffect(() => {
    const inicio = setTimeout(() => setRecebidoEm(performance.now()), 0);
    const id = setInterval(recarregar, 20000);
    return () => {
      clearTimeout(inicio);
      clearInterval(id);
    };
  }, [recarregar]);

  const acoes = useAcoes(recarregar);
  const agoraMs = useRelogioDoServidor(d.agora, recebidoEm);

  const ativos = d.agendamentos.filter((a) => a.status !== "cancelado" && a.status !== "nao_recebido");
  const concluidos = ativos.filter((a) => a.status === "concluido").length;
  const descarregando = ativos.filter((a) => a.status === "em_descarga").length;
  const pontualidade = d.chegadas.dia[0]?.pontualidadePct ?? null;
  const patioPorId = new Map(d.noPatio.map((p) => [p.agendamentoId, p]));
  const lista = ordenar(d.agendamentos);
  const finalizadas = lista.filter((a) => a.status === "concluido" || a.status === "cancelado" || a.status === "nao_recebido");
  const andamento = lista.filter((a) => !finalizadas.includes(a));

  return (
    <>
      <FaixaDePendencias pendencias={d.pendencias} hoje={d.hoje} />
      <PageWrapper title="AGROVIA Hoje" size="wide">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
          <PainelDoDia total={ativos.length} patio={d.noPatio.length} descarregando={descarregando} concluidos={concluidos} emUso={d.resumo.recursos.empilhadeirasEmUso} empilhadeiras={d.resumo.recursos.empilhadeirasTotal} />
          {falhou && (
            <Alert variant="warning" title="Sem atualização">
              Os dados são das {hora(d.agora)}. A tela tenta de novo em 20 segundos.
            </Alert>
          )}

          {d.alertasEquipamento.map((a) => (
            <Alert key={`${a.tipo}-${a.armazem}-${a.equipamento ?? ""}`} variant="warning" title={a.tipo === "em_uso" ? `Falta equipamento no ${a.armazem}` : a.armazem === "Todos os armazéns" ? "Sem empilhadeira disponível" : `Sem empilhadeira no ${a.armazem}`}>
              {a.mensagem}
            </Alert>
          ))}

          <section aria-label="Entregas de hoje" className="grid min-w-0 gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h2 text-brand">Entregas de hoje</h2>
              <p className="text-base text-muted-foreground">
                {pontualidade !== null && (
                  <>
                    Pontualidade <span className="font-semibold tabular-nums text-foreground">{pontualidade}%</span>
                    {d.resumo.duracaoMediaMin !== null && " · "}
                  </>
                )}
                {d.resumo.duracaoMediaMin !== null && (
                  <>
                    Descarga média <span className="font-semibold tabular-nums text-foreground">{d.resumo.duracaoMediaMin} min</span>
                  </>
                )}
              </p>
            </div>
            {lista.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma entrega agendada para hoje.</p>
            ) : (
              <>
                {andamento.length > 0 ? (
                  <Carrossel rotulo="Entregas em andamento">
                    {andamento.map((a) => (
                      <CartaoEntrega
                        key={a.id}
                        a={a}
                        hoje={d.hoje}
                        toleranciaMin={d.toleranciaMin}
                        agoraMs={agoraMs}
                        patio={patioPorId.get(a.id)}
                        emDescarga={d.emDescarga.filter((e) => e.agendamentoId === a.id)}
                        galpoes={d.galpoes}
                        acoes={acoes}
                        podeOperar={podeOperar}
                        className={cn("shrink-0 snap-start", LARGURA_DO_CARTAO)}
                      />
                    ))}
                    {/* guarda o lugar dos cartões que faltam para completar a fileira */}
                    {Array.from({ length: Math.max(0, CARTOES_VISIVEIS - andamento.length) }, (_, i) => (
                      <CartaoFantasma key={`fantasma-${i}`} />
                    ))}
                  </Carrossel>
                ) : (
                  <QuadroVazio mensagem="Tudo resolvido por agora" />
                )}
                {finalizadas.length > 0 && (
                  <div className="mt-2 grid gap-3">
                    <h3 className="text-h3 text-muted-foreground">
                      Finalizadas <span className="tabular-nums">({finalizadas.length})</span>
                    </h3>
                    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
                      {finalizadas.map((a) => (
                        <LinhaEntrega key={a.id} a={a} hoje={d.hoje} toleranciaMin={d.toleranciaMin} acoes={acoes} podeOperar={podeOperar} />
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </PageWrapper>
    </>
  );
}
