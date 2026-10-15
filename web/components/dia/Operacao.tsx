"use client";

/**
 * Operação da descarga na AGROVIA Hoje: um card por entrega, com barra de progresso.
 * Etapas: a chegar, portaria, pátio, descarga e concluído. Cada card tem o botão da próxima etapa e o de voltar atrás.
 * Fala com a API do agendamento por fetch (POST /api/agendamento/descarga/[id]); não importa código de lib/agendamento.
 */
import * as React from "react";
import Link from "next/link";
import { Ban, CircleCheck, Clock, PackageOpen, Play, ShieldCheck, Square, TimerReset, TriangleAlert, Truck, Undo2, Warehouse } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { AgendamentoDia, EmDescarga, EquipamentoDoGalpao, NoPatio } from "@/lib/dia/servico";

const hora = (iso: string) => iso.slice(11, 16);

type Corpo = Record<string, unknown>;
type Resultado = { ok: true } | { ok: false; mensagem: string; campos: Record<string, string> };
type RespostaApi = { ok: true; data: unknown } | { ok: false; erro: { mensagem: string; campos?: Record<string, string> } };

/** Estado e chamadas das ações; o erro fica guardado por agendamento para aparecer no card certo. */
export function useAcoes(recarregar: () => Promise<void>) {
  const [ocupado, setOcupado] = React.useState<number | null>(null);
  const [erros, setErros] = React.useState<Record<number, string>>({});

  const limpar = React.useCallback((id: number) => setErros((e) => ({ ...e, [id]: "" })), []);

  const executar = React.useCallback(
    async (id: number, corpo: Corpo): Promise<Resultado> => {
      setOcupado(id);
      limpar(id);
      let falha: Resultado = { ok: true };
      try {
        const r = await fetch(`/api/agendamento/descarga/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
        const json = (await r.json()) as RespostaApi;
        if (!json.ok) {
          const campos = json.erro.campos ?? {};
          falha = { ok: false, mensagem: json.erro.mensagem, campos };
        }
      } catch {
        falha = { ok: false, mensagem: "Não foi possível falar com o servidor. Confira a conexão e tente de novo.", campos: {} };
      }
      if (!falha.ok) {
        const mensagem = falha.mensagem;
        setErros((e) => ({ ...e, [id]: mensagem }));
      }
      await recarregar();
      setOcupado(null);
      return falha;
    },
    [recarregar, limpar],
  );

  return { ocupado, erros, executar, limpar };
}
export type Acoes = ReturnType<typeof useAcoes>;

export function ErroDaLinha({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <Alert variant="destructive" title="Não foi possível concluir" className="mt-2">
      {texto}
    </Alert>
  );
}

/** Instante do servidor estimado no navegador: o horário da demo pode diferir do relógio do aparelho. */
export function useRelogioDoServidor(agoraISO: string, recebidoEm: number | null): number {
  const [local, setLocal] = React.useState<number | null>(null);
  React.useEffect(() => {
    const id = setInterval(() => setLocal(performance.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const passou = recebidoEm !== null && local !== null ? Math.max(0, local - recebidoEm) : 0;
  return Date.parse(agoraISO) + passou;
}

function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${String(min % 60).padStart(2, "0")} min` : `${min} min`;
}

// ───────────────────────── Etapas e progresso ─────────────────────────

const ETAPAS = ["A chegar", "Portaria", "Pátio", "Descarga", "Concluído"] as const;

/** Posição de cada etapa na barra (em %). O preenchimento cresce até a etapa em que o caminhão está. */
function progresso(a: AgendamentoDia, agoraMs: number, previsaoFimEm: string | null): number {
  if (a.status === "concluido") return 100;
  if (a.status === "em_descarga" && a.entradaEm) {
    const inicio = Date.parse(a.entradaEm);
    const fim = previsaoFimEm ? Date.parse(previsaoFimEm) : inicio + 90 * 60_000;
    const fracao = fim > inicio ? Math.min(1, Math.max(0, (agoraMs - inicio) / (fim - inicio))) : 0;
    return 55 + fracao * 40;
  }
  if (a.status === "chegou") return 50;
  return 4;
}

const ICONES_ETAPA = [Clock, ShieldCheck, Warehouse, PackageOpen, CircleCheck] as const;
const ETAPA_ATUAL: Record<string, number> = { agendado: 0, chegou: 2, em_descarga: 3, concluido: 4 };

/** Stepper da entrega: cinco nós com ícone ligados por uma trilha que cresce até a etapa atual. */
function Passos({ a, valor, tom, compacto }: { a: AgendamentoDia; valor: number; tom: "brand" | "success" | "destructive" | "muted"; compacto?: boolean }) {
  const [montada, setMontada] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMontada(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const etapa = ETAPA_ATUAL[a.status] ?? 0;
  const parcial = a.status === "em_descarga" ? Math.min(1, Math.max(0, (valor - 55) / 40)) : 0;
  const preenchido = Math.min(1, (etapa + parcial) / 4);
  const cor = { brand: "bg-brand", success: "bg-success", destructive: "bg-destructive", muted: "bg-muted-foreground/40" }[tom];
  const corTexto = { brand: "text-brand", success: "text-success", destructive: "text-destructive", muted: "text-muted-foreground" }[tom];
  const tamanho = compacto ? "size-6" : "size-8";
  return (
    <div
      className="grid gap-2"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={etapa}
      aria-valuetext={`Etapa ${etapa + 1} de 5: ${ETAPAS[etapa]}`}
      aria-label={`Etapa da entrega de ${a.fornecedor}`}
    >
      <div className="relative">
        {/* trilha entre o centro do primeiro e o do último nó */}
        <span className="absolute inset-x-[10%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" aria-hidden="true">
          <span className={cn("block h-full rounded-full transition-[width] duration-700 ease-out-expo", cor)} style={{ width: `${montada ? preenchido * 100 : 0}%` }} />
        </span>
        <ol className="relative grid grid-cols-5" aria-hidden="true">
          {ICONES_ETAPA.map((Icone, i) => {
            const feito = i < etapa || (a.status === "concluido" && i === etapa);
            const atual = i === etapa && a.status !== "concluido";
            return (
              <li key={i} className="grid place-items-center">
                <span
                  className={cn(
                    "relative grid place-items-center rounded-full border-2 transition-colors duration-500",
                    tamanho,
                    feito ? `${cor} border-transparent text-white` : atual ? `border-current bg-card ${corTexto}` : "border-muted bg-card text-muted-foreground/60",
                  )}
                >
                  {atual && a.status === "em_descarga" && <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />}
                  <Icone className={compacto ? "size-3" : "size-4"} />
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="grid grid-cols-5 text-center text-xs sm:text-[13px]" aria-hidden="true">
        {ETAPAS.map((e, i) => (
          <li key={e} className={cn("truncate", i === etapa ? "font-semibold text-foreground" : "text-muted-foreground")}>
            {e}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Pontualidade da chegada, no próprio card. */
function Pontualidade({ a, hoje, toleranciaMin }: { a: AgendamentoDia; hoje: string; toleranciaMin: number }) {
  if (a.status === "cancelado" || a.status === "nao_recebido") return null;
  if (a.status === "agendado") {
    return a.atrasoMin !== null ? (
      <Badge variant="destructive">
        <TriangleAlert /> Atrasado {a.atrasoMin} min
      </Badge>
    ) : (
      <Badge variant="outline">
        <Clock /> Esperado às {a.horario}
      </Badge>
    );
  }
  if (!a.chegadaEm) return null;
  const marcado = Date.parse(`${hoje}T${a.horario}:00-03:00`);
  const dif = Math.round((Date.parse(a.chegadaEm) - marcado) / 60000);
  if (dif <= toleranciaMin) {
    return (
      <Badge variant="success">
        <CircleCheck /> {dif <= 0 ? "Chegou no horário" : `Chegou ${dif} min depois, dentro da tolerância`}
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <TriangleAlert /> Chegou {dif} min atrasado
    </Badge>
  );
}

function agruparGrupo(linhas: EmDescarga[]) {
  if (linhas.length === 0) return null;
  const base = linhas[0];
  const equipamentos: EquipamentoDoGalpao[] = [];
  for (const e of linhas) {
    for (const q of e.equipamentos) {
      const i = equipamentos.findIndex((x) => x.id === q.id);
      if (i < 0) equipamentos.push(q);
      else equipamentos[i] = { ...equipamentos[i], sugerido: equipamentos[i].sugerido || q.sugerido };
    }
  }
  return {
    galpoes: linhas.map((l) => l.armazem),
    previsaoFimEm: linhas.map((l) => l.previsaoFimEm).filter((x): x is string => !!x).sort().at(-1) ?? null,
    chapasPrevistas: base.chapasPrevistas,
    equipamentos,
  };
}

// ───────────────────────── Card da entrega ─────────────────────────

export interface CartaoEntregaProps {
  a: AgendamentoDia;
  hoje: string;
  toleranciaMin: number;
  agoraMs: number;
  patio: NoPatio | undefined;
  emDescarga: EmDescarga[];
  galpoes: { id: number; nome: string }[];
  acoes: Acoes;
  podeOperar: boolean;
  className?: string;
}

export function CartaoEntrega({ a, hoje, toleranciaMin, agoraMs, patio, emDescarga, galpoes, acoes, podeOperar, className }: CartaoEntregaProps) {
  const grupo = React.useMemo(() => agruparGrupo(emDescarga), [emDescarga]);
  const encerrado = a.status === "cancelado" || a.status === "nao_recebido";
  const ocupado = acoes.ocupado === a.id;
  const bloqueado = acoes.ocupado !== null;

  const valor = progresso(a, agoraMs, grupo?.previsaoFimEm ?? null);
  const tom = encerrado ? "muted" : a.status === "concluido" ? "success" : a.atrasoMin !== null ? "destructive" : "brand";
  const galpao = (grupo?.galpoes ?? patio?.galpoes.map((g) => g.nome) ?? a.armazens).join(", ") || "galpão a definir";

  return (
    <li
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-elevated",
        a.status === "em_descarga" && "border-brand/50",
        a.atrasoMin !== null && "border-destructive/50",
        encerrado && "opacity-70",
        className,
      )}
      data-status={a.status}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5">
            {a.status === "agendado" && <Badge variant={a.atrasoMin !== null ? "destructive" : "outline"}><Clock /> {a.atrasoMin !== null ? "Atrasado" : "A chegar"}</Badge>}
            {a.status === "chegou" && <Badge variant="info"><Truck /> No pátio</Badge>}
            {a.status === "em_descarga" && <Badge variant="info"><PackageOpen /> Descarregando</Badge>}
          </p>
          <Link href={`/agendamento/descarga/${a.id}`} className="text-xl leading-snug font-semibold break-words text-brand underline-offset-4 hover:underline">
            {a.fornecedor}
          </Link>
          <p className="mt-1 text-base text-muted-foreground">
            {a.placa ?? "Sem placa"} · nº {a.id} · {galpao}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-3xl font-semibold tabular-nums">{a.horario}</span>
          <span className="block text-sm text-muted-foreground">marcado</span>
        </p>
      </div>

      <Passos a={a} valor={valor} tom={tom} />

      <div className="flex flex-wrap items-center gap-2">
        <Pontualidade a={a} hoje={hoje} toleranciaMin={toleranciaMin} />
        {a.chegadaEm && (
          <span className="text-sm text-muted-foreground">
            Chegada {hora(a.chegadaEm)}
            {a.entradaEm ? ` · início ${hora(a.entradaEm)}` : ""}
            {a.saidaEm ? ` · fim ${hora(a.saidaEm)}` : ""}
          </span>
        )}
      </div>

      <div className="grid min-h-16 content-center">
      {a.status === "agendado" && (
        <p className="flex items-center gap-3 rounded-xl bg-muted px-4 py-4 text-base text-muted-foreground">
          <Clock className="size-6 shrink-0" aria-hidden="true" /> Aguardando o caminhão
        </p>
      )}
      {a.status === "chegou" && (
        <p className="flex items-center gap-3 rounded-xl bg-brand/10 px-4 py-4 text-base text-brand">
          <Truck className="size-6 shrink-0" aria-hidden="true" /> No pátio, esperando a descarga
        </p>
      )}
      {a.status === "em_descarga" && a.entradaEm && (
        <div className="flex items-end justify-between gap-3 rounded-xl bg-brand/5 px-4 py-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
              </span>
              Descarregando há
            </p>
            <p className="text-h1 tabular-nums text-brand" role="timer" aria-label={`Descarregando há ${formatarTempo(agoraMs - Date.parse(a.entradaEm))}`}>
              {formatarTempo(agoraMs - Date.parse(a.entradaEm))}
            </p>
          </div>
          <p className="text-right text-sm text-muted-foreground">
            Termina às
            <br />
            <span className="font-semibold tabular-nums text-foreground">{grupo?.previsaoFimEm ? hora(grupo.previsaoFimEm) : "sem previsão"}</span>
          </p>
        </div>
      )}


      {encerrado && (
        <p className="flex items-center gap-3 rounded-xl bg-muted px-4 py-4 text-base text-muted-foreground">
          <Ban className="size-6 shrink-0" aria-hidden="true" /> {a.status === "cancelado" ? "Agendamento cancelado" : "O caminhão não veio"}
        </p>
      )}
      </div>

      {podeOperar && !encerrado && (
        <div className="mt-auto grid gap-2">
          {a.status === "agendado" && <BotaoChegada id={a.id} acoes={acoes} />}
          {a.status === "chegou" && <BotaoIniciar id={a.id} patio={patio} galpoes={galpoes} acoes={acoes} fornecedor={a.fornecedor} placa={a.placa} />}
          {a.status === "em_descarga" && grupo && <BotaoEncerrar id={a.id} fornecedor={a.fornecedor} placa={a.placa} grupo={grupo} acoes={acoes} />}
          {a.status !== "agendado" && (
            <Button type="button" variant="ghost" size="sm" className="justify-self-start text-muted-foreground" loading={ocupado} disabled={bloqueado} onClick={() => void acoes.executar(a.id, { acao: "desfazer" })}>
              <Undo2 /> {a.status === "em_descarga" ? "Voltar para o pátio" : "Desfazer chegada"}
            </Button>
          )}
        </div>
      )}
      <ErroDaLinha texto={acoes.erros[a.id]} />
    </li>
  );
}

// ───────────────────────── Linha da entrega finalizada ─────────────────────────

/** Entrega concluída, cancelada ou não recebida: uma linha só, para não competir com o que está andando. */
export function LinhaEntrega({ a, hoje, toleranciaMin, acoes, podeOperar }: Pick<CartaoEntregaProps, "a" | "hoje" | "toleranciaMin" | "acoes" | "podeOperar">) {
  const encerrado = a.status === "cancelado" || a.status === "nao_recebido";
  const ocupado = acoes.ocupado === a.id;
  return (
    <li data-status={a.status} className={cn("grid gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[4rem_minmax(0,1.3fr)_minmax(0,1.5fr)_auto] sm:items-center", encerrado && "opacity-60")}>
      <p className="text-lg font-semibold tabular-nums text-muted-foreground">{a.horario}</p>
      <div className="min-w-0">
        <Link href={`/agendamento/descarga/${a.id}`} className="block truncate font-semibold text-brand underline-offset-4 hover:underline">
          {a.fornecedor}
        </Link>
        <p className="truncate text-sm text-muted-foreground">
          {a.placa ?? "Sem placa"} · nº {a.id} · {a.armazens.join(", ") || "galpão a definir"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {encerrado ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Ban className="size-4" aria-hidden="true" /> {a.status === "cancelado" ? "Agendamento cancelado" : "O caminhão não veio"}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 font-medium">
              <CircleCheck className="size-4 text-success" aria-hidden="true" /> Concluída
              {a.duracaoMin !== null && <span className="font-normal text-muted-foreground">em {formatarMin(a.duracaoMin)}</span>}
            </span>
            {a.chegadaEm && (
              <span className="text-muted-foreground">
                {hora(a.chegadaEm)}
                {a.saidaEm ? ` a ${hora(a.saidaEm)}` : ""}
              </span>
            )}
            <Pontualidade a={a} hoje={hoje} toleranciaMin={toleranciaMin} />
          </>
        )}
      </div>
      <div className="sm:justify-self-end">
        {podeOperar && !encerrado && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" loading={ocupado} disabled={acoes.ocupado !== null} onClick={() => void acoes.executar(a.id, { acao: "desfazer" })}>
            <Undo2 /> Reabrir
          </Button>
        )}
      </div>
      <ErroDaLinha texto={acoes.erros[a.id]} />
    </li>
  );
}

/** Primeiro toque. Carga acima de 500 kg pede o peso da balança. */
function BotaoChegada({ id, acoes }: { id: number; acoes: Acoes }) {
  const [pedirPeso, setPedirPeso] = React.useState(false);
  const [peso, setPeso] = React.useState("");

  async function chegar(pesoBalancaKg?: string) {
    const r = await acoes.executar(id, pesoBalancaKg ? { acao: "chegada", pesoBalancaKg } : { acao: "chegada" });
    if (r.ok) setPedirPeso(false);
    else if (r.campos.pesoBalancaKg && !pesoBalancaKg) setPedirPeso(true);
  }

  return (
    <>
      <Button size="lg" variant="outline" className="w-full" loading={acoes.ocupado === id} disabled={acoes.ocupado !== null} onClick={() => chegar()}>
        <Truck /> Caminhão chegou
      </Button>
      <Dialog
        open={pedirPeso}
        onClose={() => setPedirPeso(false)}
        title="Peso da balança"
        description="Carga acima de 500 kg: informe o peso que a balança marcou na chegada."
        footer={
          <>
            <Button variant="outline" onClick={() => setPedirPeso(false)}>Voltar</Button>
            <Button loading={acoes.ocupado === id} disabled={!peso.trim()} onClick={() => chegar(peso.trim().replace(",", "."))}>
              <Truck /> Registrar chegada
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <ErroDaLinha texto={acoes.erros[id]} />
          <Field label="Peso da balança (kg)" required>
            <Input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** O botão grande da etapa do pátio. Sem galpão definido, pergunta em qual vai descarregar. */
function BotaoIniciar({ id, patio, galpoes, acoes, fornecedor, placa }: { id: number; patio: NoPatio | undefined; galpoes: { id: number; nome: string }[]; acoes: Acoes; fornecedor: string; placa: string | null }) {
  const [escolhendo, setEscolhendo] = React.useState(false);
  const [galpaoId, setGalpaoId] = React.useState("");
  const definido = (patio?.galpoes.length ?? 0) > 0;

  return (
    <>
      <Button
        size="lg"
        className="group/iniciar h-14 w-full rounded-xl text-base font-semibold shadow-elevated"
        loading={acoes.ocupado === id}
        disabled={acoes.ocupado !== null}
        onClick={() => {
          if (definido) void acoes.executar(id, { acao: "iniciar" });
          else {
            setGalpaoId("");
            acoes.limpar(id);
            setEscolhendo(true);
          }
        }}
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/20 transition-transform duration-200 ease-out-expo group-hover/iniciar:scale-110">
          <Play className="size-4 fill-current" />
        </span>
        Iniciar descarga
      </Button>
      <Dialog
        open={escolhendo}
        onClose={() => setEscolhendo(false)}
        title="Em qual galpão vai descarregar?"
        description={`${fornecedor}${placa ? `, placa ${placa}` : ""}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEscolhendo(false)}>Voltar</Button>
            <Button
              loading={acoes.ocupado === id}
              disabled={!galpaoId}
              onClick={async () => {
                const r = await acoes.executar(id, { acao: "iniciar", armazemId: Number(galpaoId) });
                if (r.ok) setEscolhendo(false);
              }}
            >
              <Play /> Iniciar descarga
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <ErroDaLinha texto={acoes.erros[id]} />
          <Field label="Galpão" required>
            <Select value={galpaoId} onChange={(e) => setGalpaoId(e.target.value)}>
              <option value="">Escolha o galpão</option>
              {galpoes.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </>
  );
}

function BotaoEncerrar({
  id,
  fornecedor,
  placa,
  grupo,
  acoes,
}: {
  id: number;
  fornecedor: string;
  placa: string | null;
  grupo: NonNullable<ReturnType<typeof agruparGrupo>>;
  acoes: Acoes;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [chapas, setChapas] = React.useState("");
  const [equip, setEquip] = React.useState<number[]>([]);

  function abrir() {
    acoes.limpar(id);
    setChapas(String(grupo.chapasPrevistas));
    setEquip(grupo.equipamentos.filter((q) => q.sugerido && q.disponivel).map((q) => q.id));
    setAberto(true);
  }

  const chapasNum = chapas.trim() === "" ? null : Number(chapas);
  const chapasInvalido = chapasNum !== null && (!Number.isInteger(chapasNum) || chapasNum < 0 || chapasNum > 20);

  return (
    <>
      <Button size="lg" className="h-14 w-full rounded-xl text-base font-semibold shadow-elevated" disabled={acoes.ocupado !== null} onClick={abrir}>
        <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/20">
          <Square className="size-4 fill-current" />
        </span>
        Encerrar descarga
      </Button>
      <Dialog
        open={aberto}
        onClose={() => setAberto(false)}
        title="Encerrar descarga"
        description={`${fornecedor}${placa ? `, placa ${placa}` : ""}. Confira o que foi usado.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAberto(false)}>Voltar</Button>
            <Button
              loading={acoes.ocupado !== null}
              disabled={chapasInvalido}
              onClick={async () => {
                const r = await acoes.executar(id, { acao: "encerrar", ...(chapasNum !== null ? { chapasQtd: chapasNum } : {}), equipamentoIds: equip });
                if (r.ok) setAberto(false);
              }}
            >
              <TimerReset /> Encerrar descarga
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <ErroDaLinha texto={acoes.erros[id]} />
          <Field label="Funcionários que atuaram" description={`Previsto: ${grupo.chapasPrevistas}. Corrija se foi diferente.`} error={chapasInvalido ? "Informe um número inteiro de 0 a 20." : undefined}>
            <Input type="number" inputMode="numeric" min={0} max={20} value={chapas} onChange={(e) => setChapas(e.target.value)} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Equipamentos usados</legend>
            {grupo.equipamentos.length === 0 && <p className="text-sm text-muted-foreground">Este galpão não tem equipamento cadastrado.</p>}
            {grupo.equipamentos.map((q) => (
              <Checkbox
                key={q.id}
                label={q.nome}
                description={q.disponivel ? undefined : "Indisponível agora"}
                disabled={!q.disponivel && !equip.includes(q.id)}
                checked={equip.includes(q.id)}
                onChange={(e) => setEquip((atual) => (e.target.checked ? [...atual, q.id] : atual.filter((x) => x !== q.id)))}
              />
            ))}
          </fieldset>
        </div>
      </Dialog>
    </>
  );
}
