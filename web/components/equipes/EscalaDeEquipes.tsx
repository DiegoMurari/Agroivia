"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, Copy, CopyPlus, Plus, Printer, Trash2, UserPlus, Users, UsersRound, X } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Carrossel } from "@/components/dia/Carrossel";
import { DuplicarEscala } from "@/components/equipes/DuplicarEscala";
import { NovaEquipe } from "@/components/equipes/NovaEquipe";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { dataBR, diaDaSemana } from "@/lib/agendamento/datas";
import { chaveDoNome } from "@/lib/equipes/nomes";
import { diasParaImprimir, linhasDoDia, tamanhoDoTexto } from "@/lib/equipes/semana";
import type { EquipeEscala } from "@/lib/equipes/servico";
import { cn } from "@/lib/utils";

interface Props {
  data: string;
  equipes: EquipeEscala[];
  /** Nomes já cadastrados, os mais escalados primeiro. */
  sugestoes: string[];
  ultimaEscala: string | null;
  armazens: { id: number; nome: string }[];
  /** Segunda a sábado da semana do dia escolhido, com as equipes de cada dia. */
  semana: { data: string; equipes: EquipeEscala[] }[];
  /** Hoje, para o atalho de duplicar. */
  hoje: string;
  horarios: string[];
}

/** Todas as equipes usam o azul da marca: o verde é só da ação principal e dos status, e o amarelo é detalhe decorativo. */
const CORES = [
  { faixa: "border-b bg-brand/10 text-brand", suave: "bg-muted/60", avatar: "bg-brand text-brand-foreground", borda: "border-brand/30", lateral: "border-l-brand", texto: "text-brand" },
] as const;
const corDa = (i: number) => CORES[i % CORES.length];
const COR_NO_PAPEL = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";

const iniciais = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function horarioDa(e: Pick<EquipeEscala, "horarioInicio">): string | null {
  return e.horarioInicio ? e.horarioInicio.replace(":00", "h00") : null;
}

const diaCurto = (data: string) => new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const diaPorExtenso = (data: string) => new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

async function chamar(url: string, metodo: string, corpo?: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const j = (await r.json()) as { ok: boolean; erro?: { mensagem: string } };
    return j.ok ? null : (j.erro?.mensagem ?? "Não foi possível salvar.");
  } catch {
    return "Sem conexão. Tente de novo.";
  }
}

const LARGURA_DO_CARTAO = "basis-full md:basis-[calc((100%-1.25rem)/2)]";

/** Cartão de mentira, em branco e desfocado, do tamanho exato de um cartão de equipe: guarda o lugar para a tela não mudar de forma. */
function CartaoFantasma() {
  return (
    <li aria-hidden="true" className={cn("shrink-0 snap-start select-none", LARGURA_DO_CARTAO)}>
      <div className="flex h-[513px] flex-col overflow-hidden rounded-2xl border bg-card opacity-70 blur-[5px]">
        <div className="flex items-center gap-3 border-b bg-brand/10 px-4 py-3">
          <span className="size-10 rounded-full bg-muted" />
          <span className="grid flex-1 gap-2">
            <span className="h-4 w-24 rounded bg-muted" />
            <span className="h-3 w-32 rounded bg-muted" />
          </span>
        </div>
        <div className="grid gap-3 p-4">
          <div className="grid gap-2 rounded-xl bg-muted/60 p-3">
            <span className="h-8 rounded-md bg-muted" />
            <span className="h-8 rounded-md bg-muted" />
            <span className="h-8 rounded-md bg-muted" />
          </div>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-10 rounded-xl border bg-muted/40" />
          ))}
          <span className="mt-auto h-9 rounded-md bg-muted" />
        </div>
      </div>
    </li>
  );
}

function CartaoEquipe({
  e,
  indice,
  armazens,
  horarios,
  aoMudar,
  aoErro,
  aoImprimir,
}: {
  e: EquipeEscala;
  indice: number;
  armazens: Props["armazens"];
  horarios: string[];
  aoMudar: () => void;
  aoErro: (m: string) => void;
  aoImprimir: () => void;
}) {
  const cor = corDa(indice);
  const [nome, setNome] = React.useState("");
  const [meia, setMeia] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const campo = React.useRef<HTMLInputElement>(null);
  const horario = horarioDa(e);

  async function adicionar(ev: React.FormEvent) {
    ev.preventDefault();
    if (nome.trim().length < 2 || ocupado) return;
    setOcupado(true);
    const falha = await chamar(`/api/equipes/${e.id}/chapas`, "POST", { nome, tipo: meia ? "meia" : "completa" });
    setOcupado(false);
    if (falha) return aoErro(falha);
    setNome("");
    aoMudar();
    campo.current?.focus();
  }

  async function mudar(parte: Partial<Pick<EquipeEscala, "nome" | "armazemId" | "tarefa" | "horarioInicio">>) {
    const falha = await chamar(`/api/equipes/${e.id}`, "PATCH", { nome: e.nome, armazemId: e.armazemId, tarefa: e.tarefa, horarioInicio: e.horarioInicio, horarioFim: null, ...parte });
    if (falha) aoErro(falha);
    aoMudar();
  }


  return (
    <li style={{ animationDelay: `${Math.min(indice, 8) * 90}ms` }} className="shrink-0 basis-full snap-start animate-drop-in md:basis-[calc((100%-1.25rem)/2)]">
      <article className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-elevated", cor.borda)}>
        <header className={cn("flex items-center gap-3 px-4 py-3", cor.faixa)}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg leading-tight font-semibold">{e.nome}</h2>
            <p className="flex flex-wrap items-center gap-x-3 text-sm opacity-90">
              <span>
                {e.membros.length} {e.membros.length === 1 ? "funcionário" : "funcionários"}
              </span>
              {horario && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3.5" aria-hidden="true" /> {horario}
                </span>
              )}
            </p>
          </div>
          <Button variant="secondary" size="icon-sm" aria-label={`Imprimir só a equipe ${e.nome}`} title="Imprimir só esta equipe" onClick={aoImprimir}>
            <Printer />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={`Apagar a equipe ${e.nome}`}
            onClick={async () => {
              const falha = await chamar(`/api/equipes/${e.id}`, "DELETE");
              if (falha) aoErro(falha);
              aoMudar();
            }}
          >
            <Trash2 />
          </Button>
        </header>

        <div className="flex flex-col gap-3 p-4">
          <div className={cn("grid gap-2 rounded-xl p-3", cor.suave)}>
            <div className="grid gap-2">
              <Select size="sm" aria-label={`Armazém da equipe ${e.nome}`} value={e.armazemId ?? ""} onChange={(ev) => mudar({ armazemId: ev.target.value ? Number(ev.target.value) : null })}>
                <option value="">Sem armazém</option>
                {armazens.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </Select>
              <Input size="sm" aria-label={`Tarefa da equipe ${e.nome}`} placeholder="Tarefa (opcional)" defaultValue={e.tarefa ?? ""} maxLength={200} onBlur={(ev) => ev.target.value.trim() !== (e.tarefa ?? "") && mudar({ tarefa: ev.target.value.trim() || null })} />
            </div>
            <Select size="sm" aria-label={`Horário da equipe ${e.nome}`} value={e.horarioInicio ?? ""} onChange={(ev) => mudar({ horarioInicio: ev.target.value || null })}>
              <option value="">Sem horário (o dia todo)</option>
              {horarios.map((h) => (
                <option key={h} value={h}>
                  {h.replace(":00", "h00")}
                </option>
              ))}
            </Select>
          </div>

          {e.membros.length === 0 ? (
            <p className="grid h-44 place-items-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Ninguém ainda. Escreva um nome abaixo.</p>
          ) : (
            <ol className="grid h-44 content-start gap-1.5 overflow-y-auto pr-0.5">
              {e.membros.map((m, i) => (
                <li key={m.id} className="group flex animate-fade-in-up items-center gap-3 rounded-xl border bg-card px-2.5 py-1.5 transition-colors hover:bg-accent/50">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold", cor.avatar)} aria-hidden="true">
                    {iniciais(m.nome)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.nome}</span>
                  <button
                    type="button"
                    aria-label={`${m.nome}: ${m.tipo === "meia" ? "meia diária" : "diária inteira"}. Trocar`}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      m.tipo === "meia" ? "border-brand/40 bg-brand/10 text-brand" : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                    onClick={async () => {
                      const falha = await chamar(`/api/equipes/${e.id}/chapas`, "PATCH", { membroId: m.id, tipo: m.tipo === "meia" ? "completa" : "meia" });
                      if (falha) aoErro(falha);
                      aoMudar();
                    }}
                  >
                    {m.tipo === "meia" ? "Meia" : "Inteira"}
                  </button>
                  <span className="sr-only">{i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Tirar ${m.nome} da equipe`}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={async () => {
                      const falha = await chamar(`/api/equipes/${e.id}/chapas?membroId=${m.id}`, "DELETE");
                      if (falha) aoErro(falha);
                      aoMudar();
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <form onSubmit={adicionar} className="grid grid-cols-[1fr_auto] gap-2 pt-1">
            <Input ref={campo} className="col-span-2" size="sm" aria-label={`Nome do funcionário para a equipe ${e.nome}`} placeholder="Nome do funcionário" value={nome} onChange={(ev) => setNome(ev.target.value)} autoComplete="off" maxLength={80} />
            <Select size="sm" aria-label={`Meia ou diária inteira para a equipe ${e.nome}`} value={meia ? "meia" : "completa"} onChange={(ev) => setMeia(ev.target.value === "meia")}>
              <option value="completa">Diária inteira</option>
              <option value="meia">Meia diária</option>
            </Select>
            <Button type="submit" size="sm" loading={ocupado} aria-label={`Adicionar à equipe ${e.nome}`}>
              <UserPlus /> Adicionar
            </Button>
          </form>
        </div>
      </article>
    </li>
  );
}

const NOME_CURTO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function CabecalhoDaFolha({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b-2 border-brand pb-2">
      <Image src="/agrovia-logo.png" alt="AGROVIA" width={160} height={41} unoptimized className="h-10 w-auto" />
      <div className="text-right">
        <p className="text-h2 leading-tight text-brand">{titulo}</p>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{subtitulo}</p>
      </div>
    </header>
  );
}

/** Folha A4 paisagem de um dia: equipes nas linhas (nome e função), horários da grade nas colunas, chapas nas células. */
function FolhaDoDia({ data, equipes, horarios, armazens, titulo = "Escala do dia" }: { data: string; equipes: EquipeEscala[]; horarios: string[]; armazens: Props["armazens"]; titulo?: string }) {
  const linhas = linhasDoDia(equipes, horarios, armazens);
  const letra = tamanhoDoTexto(linhas, horarios.length);
  return (
    <section className={cn("flex h-[188mm] flex-col gap-3 break-after-page last:break-after-auto", COR_NO_PAPEL)}>
      <CabecalhoDaFolha titulo={titulo} subtitulo={diaPorExtenso(data)} />
      <table className="min-h-0 w-full flex-1 table-fixed border-collapse overflow-hidden rounded-xl border-2 border-brand">
        <thead>
          <tr className="bg-brand text-brand-foreground">
            <th scope="col" className="w-48 border border-brand px-3 py-2 text-left text-sm font-semibold">
              Equipe
            </th>
            {horarios.map((h) => (
              <th key={h} scope="col" className="border border-brand px-3 py-2 text-left text-lg font-semibold tabular-nums">
                {h.replace(":00", "h00")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={horarios.length + 1} className="border p-6 text-center text-muted-foreground">
                Nenhuma equipe neste dia.
              </td>
            </tr>
          )}
          {linhas.map((l, i) => (
            <tr key={l.id} className={cn("break-inside-avoid align-top", i % 2 === 1 && "bg-brand/5")}>
              <th scope="row" className="border bg-brand/10 px-3 py-2 text-left align-top">
                <span className="block text-lg leading-tight font-semibold text-brand">{l.nome}</span>
                {l.armazem && <span className="mt-1 block text-sm font-medium text-foreground">{l.armazem}</span>}
                {l.tarefa && <span className="block text-sm font-normal text-muted-foreground">{l.tarefa}</span>}
              </th>
              {l.celulas.map((chapas, k) => (
                <td key={horarios[k]} className="border px-2.5 py-2">
                  {chapas.length === 0 ? (
                    <span className="text-muted-foreground/50">-</span>
                  ) : (
                    <ul className="grid gap-1" style={{ fontSize: `${letra}px` }}>
                      {chapas.map((c, j) => (
                        <li key={j} className="leading-tight font-semibold">
                          {c.nome}
                          {c.tipo === "meia" && <span className="font-normal text-muted-foreground"> (meia)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Folha A4 paisagem de uma equipe só: sem outros dias, com o nome grande e as chapas ocupando a página. */
function FolhaDaEquipe({ e, data, horarios, armazens }: { e: EquipeEscala; data: string; horarios: string[]; armazens: Props["armazens"] }) {
  const onde = [armazens.find((a) => a.id === e.armazemId)?.nome, e.tarefa].filter(Boolean).join(" · ");
  const [linha] = linhasDoDia([e], horarios, armazens);
  const horas = e.horarioInicio ? linha.celulas.map((c, i) => (c.length > 0 ? horarios[i] : null)).filter(Boolean) : [];
  const quando = horas.length > 0 ? horas.map((h) => h!.replace(":00", "h00")).join(" e ") : "O dia todo";
  const q = e.membros.length;
  const colunas = q > 8 ? "grid-cols-3" : q > 4 ? "grid-cols-2" : "grid-cols-1";
  const letra = q <= 4 ? "text-5xl" : q <= 8 ? "text-4xl" : q <= 12 ? "text-3xl" : "text-2xl";
  const bola = q <= 4 ? "size-16 text-2xl" : q <= 8 ? "size-14 text-xl" : "size-11 text-lg";
  return (
    <section className={cn("flex h-[188mm] flex-col gap-4", COR_NO_PAPEL)}>
      <CabecalhoDaFolha titulo="Escala da equipe" subtitulo={diaPorExtenso(data)} />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 rounded-2xl border border-l-8 border-brand/30 border-l-brand bg-brand/10 px-8 py-5">
        <h1 className="text-display leading-none text-brand">{e.nome}</h1>
        <p className="grid gap-1 text-right text-xl">
          <span className="inline-flex items-center justify-end gap-2 font-semibold tabular-nums">
            <Clock className="size-5" aria-hidden="true" /> {quando}
          </span>
          {onde && <span className="text-muted-foreground">{onde}</span>}
        </p>
      </div>
      {e.membros.length === 0 ? (
        <p className="grid flex-1 place-items-center rounded-2xl border border-dashed text-xl text-muted-foreground">Nenhum funcionário nesta equipe.</p>
      ) : (
        <ol className={cn("grid min-h-0 flex-1 auto-rows-fr gap-x-8", colunas)}>
          {e.membros.map((m, i) => (
            <li key={m.id} className={cn("flex items-center gap-5 border-b font-semibold", letra)}>
              <span className={cn("grid shrink-0 place-items-center rounded-full bg-brand font-semibold text-brand-foreground", bola)}>{i + 1}</span>
              <span className="min-w-0 flex-1">{m.nome}</span>
              {m.tipo === "meia" && <span className="rounded-full border px-4 py-1 text-base font-semibold text-muted-foreground">Meia</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** A semana no papel: um dia por página, no mesmo formato da folha do dia. */
function FolhaDaSemana({ semana, horarios, armazens }: { semana: Props["semana"]; horarios: string[]; armazens: Props["armazens"] }) {
  return (
    <>
      {diasParaImprimir(semana).map((d) => (
        <FolhaDoDia key={d.data} data={d.data} equipes={d.equipes} horarios={horarios} armazens={armazens} titulo={`Escala de ${NOME_CURTO[diaDaSemana(d.data)].toLowerCase()}`} />
      ))}
    </>
  );
}

function Numero({ icone: Icone, valor, rotulo }: { icone: typeof Users; valor: number; rotulo: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
      <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-brand">
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-2xl leading-none font-semibold tabular-nums text-brand">{valor}</p>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

export function EscalaDeEquipes({ data, equipes, sugestoes, ultimaEscala, armazens, semana, horarios, hoje }: Props) {
  const router = useRouter();
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [criando, setCriando] = React.useState(false);
  const [duplicando, setDuplicando] = React.useState<"para" | "de" | null>(null);
  const [aberturasDup, setAberturasDup] = React.useState(0);
  const [aberturas, setAberturas] = React.useState(0);
  const [papel, setPapel] = React.useState<"semana" | "dia" | number | null>(null);
  const escalados = new Set(equipes.flatMap((e) => e.membros.map((m) => chaveDoNome(m.nome))));
  const atualizar = () => router.refresh();

  // Depois de imprimir (ou cancelar), a folha some e a tela volta ao normal
  React.useEffect(() => {
    const fim = () => setPapel(null);
    window.addEventListener("afterprint", fim);
    return () => window.removeEventListener("afterprint", fim);
  }, []);

  function imprimir(o: "semana" | "dia" | number) {
    // A folha precisa estar no documento antes de abrir a impressão
    flushSync(() => setPapel(o));
    window.print();
  }

  const aImprimir = equipes.filter((e) => e.id === papel);

  return (
    <>
      <div className="grid gap-4 print:hidden">
        <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Numero icone={UsersRound} valor={equipes.length} rotulo={equipes.length === 1 ? "equipe" : "equipes"} />
          <Numero icone={Users} valor={escalados.size} rotulo={escalados.size === 1 ? "funcionário escalado" : "funcionários escalados"} />
          <div className="col-span-2 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card sm:col-span-1">
            <p className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">Dia escolhido</span>
              <span className="block text-base leading-tight font-semibold text-brand first-letter:uppercase">{diaCurto(data)}</span>
            </p>
          </div>
        </section>

        <section aria-label="Ações" className="flex flex-wrap items-center justify-between gap-3">
          <Button
            onClick={() => {
              setAberturas((n) => n + 1);
              setCriando(true);
            }}
          >
            <Plus /> Nova equipe
          </Button>
          <span className="flex flex-wrap gap-2">
            {equipes.length === 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAberturasDup((n) => n + 1);
                  setDuplicando("de");
                }}
              >
                <Copy /> Copiar de um dia
              </Button>
            )}
            {equipes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAberturasDup((n) => n + 1);
                  setDuplicando("para");
                }}
              >
                <CopyPlus /> Duplicar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => imprimir("dia")}>
              <Printer /> Imprimir dia
            </Button>
            <Button type="button" variant="outline" onClick={() => imprimir("semana")}>
              <Printer /> Imprimir semana
            </Button>
          </span>
        </section>

        {mensagem && (
          <Alert variant="destructive" title="Não deu certo">
            {mensagem}
          </Alert>
        )}

        {equipes.length === 0 ? (
          <div className="relative mb-10">
            <ul className="flex items-stretch gap-5 overflow-hidden" aria-hidden="true">
              <CartaoFantasma />
              <CartaoFantasma />
            </ul>
            <p role="status" className="absolute top-1/2 left-1/2 w-[min(90%,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card px-6 py-4 text-center shadow-elevated">
              <span className="block text-lg font-semibold text-brand">Nenhuma equipe em {dataBR(data).slice(0, 5)}</span>
              <span className="block text-sm text-muted-foreground">Crie a primeira em Nova equipe{ultimaEscala ? " ou monte a partir da última escala" : ""}.</span>
            </p>
          </div>
        ) : (
          <Carrossel rotulo="Equipes do dia" alinhado>
            {equipes.map((e, i) => (
              <CartaoEquipe key={e.id} e={e} indice={i} armazens={armazens} horarios={horarios} aoMudar={atualizar} aoErro={setMensagem} aoImprimir={() => imprimir(e.id)} />
            ))}
            {/* guarda o lugar dos cartões que faltam para completar a fileira */}
            {Array.from({ length: Math.max(0, 2 - equipes.length) }, (_, i) => (
              <CartaoFantasma key={`fantasma-${i}`} />
            ))}
          </Carrossel>
        )}
      </div>

      <NovaEquipe key={aberturas} aberto={criando} aoFechar={() => setCriando(false)} data={data} armazens={armazens} horarios={horarios} salvos={sugestoes} escalados={escalados} quantas={equipes.length} aoCriada={atualizar} />

      <DuplicarEscala key={`dup-${aberturasDup}`} aberto={duplicando !== null} aoFechar={() => setDuplicando(null)} modo={duplicando ?? "para"} dia={data} hoje={hoje} aoConcluir={(irPara) => (irPara === data ? router.refresh() : router.push(`/equipes?data=${irPara}`))} />

      {/* Papel: a semana, o dia ou só uma equipe, sempre numa folha A4 em paisagem. */}
      {papel === "semana" && (
        <div className="hidden print:block">
          <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
          <FolhaDaSemana semana={semana} horarios={horarios} armazens={armazens} />
        </div>
      )}
      {papel === "dia" && (
        <div className="hidden print:block">
          <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
          <FolhaDoDia data={data} equipes={equipes} horarios={horarios} armazens={armazens} />
        </div>
      )}
      {typeof papel === "number" && aImprimir.length > 0 && (
        <div className="hidden print:block">
          <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
          <FolhaDaEquipe e={aImprimir[0]} data={data} horarios={horarios} armazens={armazens} />
        </div>
      )}
    </>
  );
}
