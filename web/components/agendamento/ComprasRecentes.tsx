"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Ban, CircleCheck, CircleX, Clock, Hourglass, ShoppingCart, Truck, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Carrossel } from "@/components/dia/Carrossel";
import { EmptyState } from "@/components/ui/EmptyState";
import { dataBR } from "@/lib/agendamento/datas";
import { cn } from "@/lib/utils";

/**
 * Compras recentes no mesmo cartão de Cadastros: ícone num círculo azul-claro, selo da situação no canto,
 * nome em destaque, nota em cinza e "Abrir". O selo leva ícone e texto (status nunca só por cor).
 */

export interface CompraLinha {
  id: number;
  token: string;
  status: string;
  fornecedor: string;
  agendamentoId: number | null;
  agendamentoData: string | null;
  agendamentoHorario: string | null;
  agendamentoStatus: string | null;
}

/** Cartões à vista de uma vez; os outros ficam atrás da seta. */
const CARTAS = 6;
/** Largura de cada cartão no carrossel: 2 no celular, 3 no médio e 6 no largo (espaço de 12 px). */
const LARGURA_DA_CARTA = "shrink-0 snap-start basis-[calc((100%-0.75rem)/2)] md:basis-[calc((100%-1.5rem)/3)] xl:basis-[calc((100%-3.75rem)/6)]";

interface Situacao {
  rotulo: string;
  icone: LucideIcon;
  variante: "success" | "info" | "outline" | "destructive" | "warning";
}

function situacaoDa(c: CompraLinha): Situacao {
  if (c.status === "criada") return { rotulo: "Aguardando", icone: Hourglass, variante: "warning" };
  switch (c.agendamentoStatus) {
    case "concluido":
      return { rotulo: "Concluído", icone: CircleCheck, variante: "success" };
    case "em_descarga":
      return { rotulo: "Em descarga", icone: Truck, variante: "info" };
    case "chegou":
      return { rotulo: "No pátio", icone: Truck, variante: "info" };
    case "agendado":
      return { rotulo: "Agendado", icone: Clock, variante: "outline" };
    case "nao_recebido":
      return { rotulo: "Não recebido", icone: CircleX, variante: "destructive" };
    case "cancelado":
      return { rotulo: "Cancelado", icone: Ban, variante: "outline" };
    default:
      return { rotulo: c.status === "cancelada" ? "Cancelada" : "Confirmada", icone: CircleCheck, variante: "outline" };
  }
}

function destinoDa(c: CompraLinha): { href: string; nota: string; aria: string } | null {
  if (c.status === "criada") return { href: `/agendamento/agendar/${c.token}`, nota: "Aguardando o fornecedor agendar", aria: `Abrir o link de ${c.fornecedor}` };
  if (c.agendamentoId && c.agendamentoData) {
    const quando = `${dataBR(c.agendamentoData).slice(0, 5)} às ${c.agendamentoHorario}`;
    return { href: `/agendamento/descarga/${c.agendamentoId}`, nota: quando, aria: `Abrir descarga de ${c.fornecedor}, ${quando}` };
  }
  return null;
}

function Carta({ c, indice, className }: { c: CompraLinha; indice: number; className?: string }) {
  const s = situacaoDa(c);
  const Icone = s.icone;
  const destino = destinoDa(c);
  const corpo = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <ShoppingCart className="size-5" aria-hidden="true" />
        </span>
      </span>
      <span className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold break-words">{c.fornecedor}</span>
      <Badge variant={s.variante} className="w-fit">
        <Icone /> {s.rotulo}
      </Badge>
      <span className="text-sm text-muted-foreground">{destino?.nota ?? "Sem descarga"}</span>
      {destino && (
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-brand">
          Abrir <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </span>
      )}
    </>
  );
  const classes = "group flex h-full flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-card transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <li className={cn("animate-drop-in", className)} style={{ animationDelay: `${indice * 90}ms` }}>
      {destino ? (
        <Link href={destino.href} aria-label={destino.aria} className={classes}>
          {corpo}
        </Link>
      ) : (
        <div className={classes}>{corpo}</div>
      )}
    </li>
  );
}

export function ComprasRecentes({ compras }: { compras: CompraLinha[] }) {
  const [todas, setTodas] = useState(false);
  if (compras.length === 0) {
    return <EmptyState title="Nenhuma compra ainda" description="Use Nova compra para gerar o primeiro link." />;
  }
  const grade = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6";
  return (
    <div className="space-y-4">
      {todas ? (
        <ul className={grade}>
          {compras.map((c, i) => (
            <Carta key={c.id} c={c} indice={i % CARTAS} />
          ))}
        </ul>
      ) : (
        <Carrossel rotulo="Compras recentes" compacto>
          {compras.slice(0, 24).map((c, i) => (
            <Carta key={c.id} c={c} indice={i % CARTAS} className={LARGURA_DA_CARTA} />
          ))}
        </Carrossel>
      )}
      {compras.length > CARTAS && (
        <Button variant="outline" size="sm" onClick={() => setTodas((v) => !v)}>
          {todas ? "Ver menos" : `Ver todas (${compras.length})`}
        </Button>
      )}
    </div>
  );
}
