"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CircleCheck, CircleX, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DecisaoRegistrada } from "@/lib/aprovacoes/historico";
import { cn } from "@/lib/utils";

const PERFIL: Record<string, string> = { adm_master: "Adm Master", compras: "Compras", portaria: "Portaria", armazem: "Gestor de armazém" };
const FILTROS = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "cadastro", rotulo: "Fornecedores" },
  { valor: "pedido", rotulo: "Pedidos" },
] as const;

/** "2026-10-03T14:05:00-03:00" → "03/10/2026 às 14:05" (o texto já está no horário de Brasília). */
const quando = (iso: string) => `${iso.slice(0, 10).split("-").reverse().join("/")} às ${iso.slice(11, 16)}`;

/** Quem aprovou ou recusou cada fornecedor e cada pedido, do mais recente para o mais antigo. */
export function HistoricoDeDecisoes({ decisoes }: { decisoes: DecisaoRegistrada[] }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("todos");
  const lista = decisoes.filter((d) => filtro === "todos" || d.alvo === filtro);

  return (
    <div className="grid gap-4">
      <div role="group" aria-label="Filtrar o histórico" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              filtro === f.valor ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <EmptyState title="Nenhuma decisão registrada" description="Quando Compras aprovar ou recusar, aparece aqui com o nome de quem decidiu." />
      ) : (
        <ul className="grid gap-3">
          {lista.map((d) => {
            const aprovado = d.decisao === "aprovado";
            const Icone = d.alvo === "cadastro" ? Building2 : PackageCheck;
            const corpo = (
              <>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", aprovado ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  <Icone className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{d.titulo}</span>
                  <span className="block text-sm text-muted-foreground">{d.detalhe}</span>
                  {d.comentario && <span className="mt-1 block text-sm">Motivo: {d.comentario}</span>}
                </span>
                <span className="grid shrink-0 justify-items-end gap-1 text-right text-sm">
                  {aprovado ? (
                    <Badge variant="success"><CircleCheck /> Aprovado</Badge>
                  ) : (
                    <Badge variant="destructive"><CircleX /> Recusado</Badge>
                  )}
                  <span>
                    por <span className="font-semibold">{d.por}</span>
                    {d.porPerfil && PERFIL[d.porPerfil] && <span className="text-muted-foreground"> ({PERFIL[d.porPerfil]})</span>}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{quando(d.em)}</span>
                </span>
              </>
            );
            return (
              <li key={d.id}>
                {d.link ? (
                  <Link href={d.link} className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring sm:flex-nowrap">
                    {corpo}
                  </Link>
                ) : (
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-card sm:flex-nowrap">{corpo}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
