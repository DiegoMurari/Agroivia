"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronRight, CircleCheck, CircleX, FileText, Package, ScanSearch, Weight } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Textarea } from "@/components/ui/Input";
import { dataBR } from "@/lib/agendamento/datas";
import type { GrupoDeAprovacao, NotaParaAprovar, PedidoParaAprovar } from "@/lib/agendamento/pedido";
import { formatBRL, formatNumero } from "@/lib/money";
import { cn } from "@/lib/utils";

import { chamar, postJson } from "./api";

const kg = (v: string | null) => (v ? `${formatNumero(v, 2)} kg` : "não informado");
const brl = (v: string | null) => (v ? formatBRL(v) : "-");

/** A NF-e em formato de DANFE simplificado: emitente, número, chave e itens. */
function PainelNfe({ nota }: { nota: NotaParaAprovar }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-4 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <FileText className="size-5 text-brand" aria-hidden="true" /> NF-e {nota.numero ?? "sem número"}
          {nota.serie ? <span className="font-normal text-muted-foreground"> · série {nota.serie}</span> : null}
        </p>
        <p className="text-sm text-muted-foreground">{nota.emitidaEm ? `Emitida em ${dataBR(nota.emitidaEm.slice(0, 10))}` : "Data de emissão não informada"}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Emitente</dt>
          <dd className="font-medium">{nota.emitente ?? "não informado"}</dd>
          {nota.emitenteCnpj && <dd className="font-mono text-xs text-muted-foreground">CNPJ {nota.emitenteCnpj}</dd>}
        </div>
        <div>
          <dt className="text-muted-foreground">Valor total</dt>
          <dd className="font-medium tabular-nums">{brl(nota.valorTotal)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peso bruto</dt>
          <dd className="font-medium tabular-nums">{kg(nota.pesoBrutoKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Transporte</dt>
          <dd className="font-medium">{[nota.transportadora, nota.placa].filter(Boolean).join(" · ") || "não informado"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Chave de acesso</dt>
          <dd className="font-mono text-xs break-all">{nota.chave}</dd>
        </div>
      </dl>
      <div className="border-t">
        <p className="px-4 pt-3 text-sm font-medium text-muted-foreground">Itens ({nota.linhas.length})</p>
        {nota.linhas.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Sem itens lidos nesta nota.</p>
        ) : (
          <ul className="divide-y">
            {nota.linhas.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                <span className="min-w-0 break-words">{l.descricao}</span>
                <span className="tabular-nums text-muted-foreground">
                  {l.quantidade ? `${formatNumero(l.quantidade, 2)} ${l.unidade ?? ""}` : "-"}
                  {l.valorUnitario ? ` × ${brl(l.valorUnitario)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotasDoPedido({ notas }: { notas: NotaParaAprovar[] }) {
  if (notas.length === 0) return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Este pedido não tem nota fiscal ligada.</p>;
  return (
    <div className="grid gap-3">
      {notas.map((n) => (
        <PainelNfe key={n.chave} nota={n} />
      ))}
    </div>
  );
}

/**
 * Aprovação de pedidos do portal, agrupada por fornecedor (D49). A página /aprovacoes só renderiza
 * `<AprovacoesPedidos />`: o componente busca a lista em /api/agendamento/aprovacoes e a recarrega a cada decisão.
 */
export function AprovacoesPedidos() {
  const [grupos, setGrupos] = useState<GrupoDeAprovacao[] | null>(null);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [nfeAberta, setNfeAberta] = useState<Set<number>>(new Set());
  const [analisando, setAnalisando] = useState<{ fornecedor: string; p: PedidoParaAprovar } | null>(null);
  const [recusando, setRecusando] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const r = await chamar<GrupoDeAprovacao[]>("/api/agendamento/aprovacoes");
      if (!ativo) return;
      if (r.ok && r.data) {
        const lista = r.data;
        setGrupos(lista);
        setAbertos((a) => (a.size === 0 && lista.length === 1 ? new Set([lista[0].fornecedorId]) : a));
      } else setErro(r.mensagem ?? "Não foi possível carregar os pedidos.");
    })();
    return () => {
      ativo = false;
    };
  }, [versao]);

  async function decidir(id: number, decisao: "aprovado" | "recusado") {
    setErro(null);
    setErroCampo(null);
    setOcupado(id);
    const r = await postJson("/api/agendamento/aprovacoes", { id, decisao, comentario: decisao === "recusado" ? comentario : null });
    setOcupado(null);
    if (!r.ok) {
      if (r.campos?.comentario) setErroCampo(r.campos.comentario);
      else setErro(r.mensagem ?? "Não foi possível registrar a decisão.");
      if (r.status === 409) setVersao((v) => v + 1);
      return;
    }
    setRecusando(null);
    setComentario("");
    setAnalisando(null);
    setVersao((v) => v + 1);
  }

  if (grupos === null) {
    return erro ? <Alert variant="destructive" title="Não foi possível carregar">{erro}</Alert> : <div className="skeleton h-24 w-full rounded-xl" aria-busy="true" aria-label="Carregando" />;
  }

  if (grupos.length === 0) {
    return <EmptyState icon={<CircleCheck />} title="Nenhum pedido aguardando" description="Quando um fornecedor enviar um pedido, ele aparece aqui para você aprovar ou recusar." />;
  }

  const alternar = (set: Set<number>, id: number) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  /** Os botões de decisão, iguais no card e na janela de análise. */
  const decisao = (p: PedidoParaAprovar) =>
    recusando === p.id ? (
      <div className="space-y-3">
        <Field label="Motivo da recusa" description="O fornecedor lê este texto para corrigir o pedido." required error={erroCampo ?? undefined}>
          <Textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="destructive" className="w-full sm:w-auto" loading={ocupado === p.id} onClick={() => decidir(p.id, "recusado")}>
            <CircleX /> Confirmar recusa
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setRecusando(null); setComentario(""); setErroCampo(null); }}>
            Voltar
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="w-full sm:w-auto" loading={ocupado === p.id} onClick={() => decidir(p.id, "aprovado")}>
          <CircleCheck /> Aprovar
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" disabled={ocupado !== null} onClick={() => { setRecusando(p.id); setComentario(""); setErroCampo(null); }}>
          <CircleX /> Recusar
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      {erro && <Alert variant="destructive" title="Não foi possível registrar">{erro}</Alert>}
      {grupos.map((g) => {
        const aberto = abertos.has(g.fornecedorId);
        return (
          <section key={g.fornecedorId} className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <h3>
              <button
                type="button"
                aria-expanded={aberto}
                className={cn("flex w-full items-center justify-between gap-3 bg-muted/60 px-5 py-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring", aberto && "border-b")}
                onClick={() => setAbertos((a) => alternar(a, g.fornecedorId))}
              >
                <span className="flex min-w-0 items-center gap-3 text-lg font-semibold text-brand">
                  <ChevronRight className={cn("size-5 shrink-0 transition-transform duration-300", aberto && "rotate-90")} aria-hidden="true" />
                  <span className="break-words">{g.fornecedor}</span>
                </span>
                <Badge variant="warning">{g.pedidos.length} {g.pedidos.length === 1 ? "pedido" : "pedidos"}</Badge>
              </button>
            </h3>
            {aberto && (
              <ul className="grid gap-4 bg-background/60 p-4 sm:p-5 motion-safe:animate-fade-in-down lg:grid-cols-2">
                {g.pedidos.map((p) => {
                  const nfe = nfeAberta.has(p.id);
                  return (
                    <li key={p.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-elevated">
                      <button
                        type="button"
                        onClick={() => setAnalisando({ fornecedor: g.fornecedor, p })}
                        className="group grid gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                        aria-label={`Analisar o pedido ${p.numero}`}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-lg font-semibold">
                            <CalendarClock className="size-5 text-brand" aria-hidden="true" /> {dataBR(p.data)} às {p.horario}
                          </span>
                          <Badge variant="outline">{p.acondicionamento === "batido" ? "Carga batida" : "Paletizado ou big bag"}</Badge>
                        </span>
                        <span className="grid gap-1.5 text-sm">
                          <span className="flex items-center gap-2"><Package className="size-4 text-muted-foreground" aria-hidden="true" /> {p.tipoMercadoria ?? "Mercadoria não informada"}</span>
                          <span className="flex items-center gap-2"><Weight className="size-4 text-muted-foreground" aria-hidden="true" /> {kg(p.pesoKg)}</span>
                          <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                          Analisar pedido <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </button>

                      {p.observacao && <p className="text-sm">Observação: {p.observacao}</p>}

                      <div className="grid gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-self-start"
                          aria-expanded={nfe}
                          onClick={() => setNfeAberta((s) => alternar(s, p.id))}
                        >
                          <ScanSearch /> {nfe ? "Ocultar NF-e" : `Mostrar NF-e${p.notas.length > 1 ? "s" : ""}`}
                        </Button>
                        {nfe && (
                          <div className="motion-safe:animate-fade-in-down">
                            <NotasDoPedido notas={p.notas} />
                          </div>
                        )}
                      </div>

                      {decisao(p)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <Dialog
        open={analisando !== null}
        onClose={() => { setAnalisando(null); setRecusando(null); setErroCampo(null); }}
        title={analisando ? `Analisar pedido de ${analisando.fornecedor}` : "Analisar pedido"}
        description={analisando ? `${dataBR(analisando.p.data)} às ${analisando.p.horario} · ${analisando.p.numero}` : undefined}
        className="max-w-3xl"
      >
        {analisando && (
          <div className="grid gap-5">
            {erro && <Alert variant="destructive" title="Não foi possível registrar">{erro}</Alert>}
            <dl className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Mercadoria</dt><dd className="font-medium">{analisando.p.tipoMercadoria ?? "não informada"}</dd></div>
              <div><dt className="text-muted-foreground">Peso declarado</dt><dd className="font-medium">{kg(analisando.p.pesoKg)}</dd></div>
              <div><dt className="text-muted-foreground">Carga</dt><dd className="font-medium">{analisando.p.acondicionamento === "batido" ? "Batida" : "Paletizada ou big bag"}</dd></div>
              {analisando.p.observacao && <div className="sm:col-span-3"><dt className="text-muted-foreground">Observação</dt><dd>{analisando.p.observacao}</dd></div>}
            </dl>
            <div className="grid gap-2">
              <h3 className="text-h3 text-brand">Nota fiscal</h3>
              <NotasDoPedido notas={analisando.p.notas} />
            </div>
            {decisao(analisando.p)}
          </div>
        )}
      </Dialog>
    </div>
  );
}
