"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Bell, CalendarPlus, CircleAlert, CircleCheck, CircleX, Clock, FilePen, Pencil, Truck } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { dataBR } from "@/lib/agendamento/datas";
import type { NotaDoPedido, PedidoDoFornecedor } from "@/lib/agendamento/pedido";
import type { TempoDoDia } from "@/lib/tempo";
import { cn } from "@/lib/utils";

import { postJson } from "./api";
import { CalendarioPedido } from "./CalendarioPedido";

/** O que o popup de edição precisa: calendário, tipos de mercadoria e as notas já anexadas a cada pedido. */
export interface DadosDeEdicao {
  hoje: string;
  tempo: Record<string, TempoDoDia>;
  tipos: { valor: string; rotulo: string }[];
  notas: Record<number, NotaDoPedido[]>;
}

interface Notificacao {
  id: number;
  tipo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  criadoEm: string;
}

/** Mesmo mapa de status das outras telas: concluído verde, andamento e pendência azul, erro vermelho, cancelado cinza. */
function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "Aprovado":
      return <Badge variant="success"><CircleCheck /> {estado}</Badge>;
    case "Concluído":
      return <Badge variant="success"><Truck /> {estado}</Badge>;
    case "Chegou":
    case "Em descarga":
      return <Badge variant="info"><Truck /> {estado}</Badge>;
    case "Recusado":
    case "Não recebido":
      return <Badge variant="destructive"><CircleX /> {estado}</Badge>;
    case "Cancelado":
      return <Badge variant="outline"><Ban /> {estado}</Badge>;
    case "Aguardando aprovação":
      return <Badge variant="info"><Clock /> {estado}</Badge>;
    default:
      return <Badge variant="outline"><FilePen /> {estado}</Badge>;
  }
}

function PainelDePedidos({ aguardando, aprovados, recusados, novas }: { aguardando: number; aprovados: number; recusados: number; novas: number }) {
  const itens = [
    { rotulo: "Aguardando aprovação", valor: aguardando, icone: Clock },
    { rotulo: "Aprovados", valor: aprovados, icone: CircleCheck },
    { rotulo: "Recusados", valor: recusados, icone: CircleAlert },
    { rotulo: "Notificações novas", valor: novas, icone: Bell },
  ];
  return (
    <section aria-label="Resumo dos pedidos" className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-card lg:grid-cols-4">
      {itens.map(({ rotulo, valor, icone: Icone }, i) => (
        <div key={rotulo} className={cn("group flex items-center gap-3 border-b px-5 py-3.5 transition-colors hover:bg-accent/60 lg:border-b-0", i > 0 && "lg:border-l", i % 2 === 1 && "border-l")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
            <Icone className="size-5" aria-hidden="true" />
          </span>
          <p>
            <span className="block text-3xl leading-none font-semibold tabular-nums text-brand">{valor}</span>
            <span className="text-sm text-muted-foreground">{rotulo}</span>
          </p>
        </div>
      ))}
    </section>
  );
}

function CartaoPedido({ p, posicao, aoEditar }: { p: PedidoDoFornecedor; posicao: number; aoEditar: () => void }) {
  const encerrado = p.estado === "Cancelado" || p.estado === "Não recebido";
  const acao = p.aprovacao === "recusado" ? "Corrigir e reenviar" : p.aprovacao === "rascunho" ? "Continuar preenchendo" : "Editar";
  return (
    <li
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-elevated motion-safe:animate-fade-in-up",
        p.aprovacao === "recusado" && "border-destructive/50",
        encerrado && "opacity-70",
      )}
      style={{ animationDelay: `${Math.min(posicao, 7) * 60}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5"><EstadoBadge estado={p.estado} /></p>
          <p className="text-xl leading-snug font-semibold text-brand">{dataBR(p.data)}</p>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{p.numero}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-3xl font-semibold tabular-nums">{p.horario}</span>
          <span className="block text-sm text-muted-foreground">marcado</span>
        </p>
      </div>

      <dl className="grid gap-1.5 text-sm">
        <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Mercadoria</dt><dd className="min-w-0 font-medium">{p.tipoMercadoria ?? "-"}</dd></div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">Notas</dt>
          <dd className="min-w-0 truncate font-medium" title={p.notas.join(", ")}>{p.notas.length > 0 ? p.notas.join(", ") : "-"}</dd>
        </div>
        {p.observacao && (
          <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">Observação</dt><dd className="line-clamp-2 min-w-0" title={p.observacao}>{p.observacao}</dd></div>
        )}
      </dl>

      {p.aprovacao === "recusado" && p.recusaComentario && (
        <div role="note" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive"><CircleAlert className="size-4 shrink-0" aria-hidden="true" /> Motivo da recusa</p>
          <p className="mt-1 line-clamp-3" title={p.recusaComentario}>{p.recusaComentario}</p>
        </div>
      )}

      {p.estado === "Não recebido" && (
        <Button asChild size="sm" className="mt-auto w-full sm:w-fit">
          <Link href="/fornecedor"><CalendarPlus /> Agendar de novo</Link>
        </Button>
      )}

      {p.emAberto && (
        <Button variant="outline" size="sm" className="mt-auto w-full sm:w-fit" onClick={aoEditar} aria-label={`${acao} ${p.numero}`}>
          <Pencil /> {acao}
        </Button>
      )}
    </li>
  );
}

export function PedidosFornecedor({ pedidos, notificacoes, edicao }: { pedidos: PedidoDoFornecedor[]; notificacoes: Notificacao[]; edicao: DadosDeEdicao }) {
  const router = useRouter();
  const [editando, setEditando] = useState<PedidoDoFornecedor | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const aguardando = pedidos.filter((p) => p.estado === "Aguardando aprovação").length;
  const aprovados = pedidos.filter((p) => p.estado === "Aprovado" || p.estado === "Chegou" || p.estado === "Em descarga" || p.estado === "Concluído").length;
  const recusados = pedidos.filter((p) => p.estado === "Recusado").length;

  async function marcar(ids?: number[]) {
    setErro(null);
    const r = await postJson("/api/fornecedor/notificacoes", { ids });
    if (!r.ok) setErro(r.mensagem ?? "Não foi possível marcar como lida.");
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      <PainelDePedidos aguardando={aguardando} aprovados={aprovados} recusados={recusados} novas={naoLidas} />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-4" aria-labelledby="titulo-pedidos">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-pedidos" className="text-h2 text-brand">Histórico de pedidos</h2>
            <Button asChild size="sm">
              <Link href="/fornecedor"><CalendarPlus /> Agendar descarga</Link>
            </Button>
          </div>
          {pedidos.length === 0 ? (
            <EmptyState title="Nenhum pedido ainda" description="Use Agendar descarga para marcar o primeiro." />
          ) : (
            <ul className="grid gap-4 xl:grid-cols-2">
              {pedidos.map((p, i) => (
                <CartaoPedido key={p.id} p={p} posicao={i} aoEditar={() => setEditando(p)} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-notificacoes" className="rounded-2xl border bg-card shadow-card lg:sticky lg:top-20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <h2 id="titulo-notificacoes" className="flex items-center gap-2 text-h3 text-brand">
              <Bell className="size-5" aria-hidden="true" /> Notificações
              {naoLidas > 0 && <Badge variant="info">{naoLidas} {naoLidas === 1 ? "nova" : "novas"}</Badge>}
            </h2>
            {naoLidas > 0 && (
              <Button variant="outline" size="sm" onClick={() => marcar()}>
                Marcar todas como lidas
              </Button>
            )}
          </div>
          {erro && <div className="px-5 pt-4"><Alert variant="destructive" title="Não foi possível atualizar">{erro}</Alert></div>}
          {notificacoes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="max-h-[32rem] divide-y overflow-y-auto text-sm">
              {notificacoes.map((n) => (
                <li key={n.id} className={cn("flex flex-wrap items-start justify-between gap-2 px-5 py-3", !n.lida && "bg-brand/10")}>
                  <div className="min-w-0 space-y-1">
                    <p className={cn(!n.lida && "font-medium")}>
                      {!n.lida && <span className="sr-only">Não lida. </span>}
                      {n.mensagem}
                    </p>
                    <p className="text-xs text-muted-foreground">{dataBR(n.criadoEm.slice(0, 10))} às {n.criadoEm.slice(11, 16)}</p>
                  </div>
                  {!n.lida && (
                    <Button variant="ghost" size="sm" onClick={() => marcar([n.id])}>
                      Marcar como lida
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editando && (
        <Dialog
          open
          onClose={() => setEditando(null)}
          title={`${editando.aprovacao === "recusado" ? "Corrigir" : "Editar"} pedido ${editando.numero}`}
          description="Ao enviar, o pedido volta para a aprovação de Compras."
          className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto"
        >
          <CalendarioPedido
            key={editando.id}
            popup
            hoje={edicao.hoje}
            tempo={edicao.tempo}
            tipos={edicao.tipos}
            aoConcluir={() => {
              setEditando(null);
              router.refresh();
            }}
            inicial={{
              id: editando.id,
              data: editando.data,
              horario: editando.horario,
              numero: editando.numero,
              tipoValor: editando.tipoValor,
              tipoOutros: editando.tipoOutros,
              observacao: editando.observacao,
              recusaComentario: editando.recusaComentario,
              estado: editando.estado,
              notas: edicao.notas[editando.id] ?? [],
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
