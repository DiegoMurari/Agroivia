import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";

import { partesDoInstante } from "@/components/auditoria/LinhaDoTempo";
import { EstadoDaDescarga } from "@/components/agendamento/EstadoDaDescarga";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { getDb } from "@/lib/db";
import { garantirDadosDeAuditoria } from "@/lib/auditoria/mock";
import { listarAuditoria } from "@/lib/auditoria/trajeto";
import { hojeISO } from "@/lib/relogio";

export const dynamic = "force-dynamic";

const dataBR = (d: string) => d.split("-").reverse().join("/");

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const busca = (Array.isArray(q) ? q[0] : q)?.slice(0, 80) ?? "";
  const db = getDb();
  garantirDadosDeAuditoria(db, hojeISO());
  const linhas = listarAuditoria(db, busca);

  return (
    <PageWrapper title="Auditoria" description="O trajeto de cada entrega, do pedido ao fim da descarga: quem fez, o que fez e quando." size="wide">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <form method="get" action="/auditoria" role="search" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
          <Search className="size-5 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={busca} placeholder="Fornecedor, número da nota, placa ou nº do agendamento" aria-label="Buscar entrega" className="min-w-64 flex-1" />
          <Button type="submit">Buscar</Button>
          {busca && (
            <Button asChild variant="outline">
              <Link href="/auditoria">
                <X /> Limpar
              </Link>
            </Button>
          )}
        </form>

        {linhas.length === 0 ? (
          <EmptyState title="Nenhuma entrega encontrada" description="Confira o nome do fornecedor, o número da nota ou a placa." />
        ) : (
          <ul className="grid gap-3">
            {linhas.map((l) => {
              const [diaIni, horaIni] = partesDoInstante(l.inicio);
              const fim = l.fim ? partesDoInstante(l.fim) : null;
              return (
                <li key={l.agendamentoId}>
                  <Link
                    href={`/auditoria/${l.agendamentoId}`}
                    className="group grid gap-3 rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">{l.fornecedor}</span>
                      <span className="block text-sm text-muted-foreground">
                        nº {l.agendamentoId} · descarga {dataBR(l.data)} às {l.horario}
                        {l.placa ? ` · ${l.placa}` : ""}
                      </span>
                      <span className="block text-sm text-muted-foreground">{l.notas.length > 0 ? `NF ${l.notas.join(", ")}` : "Sem nota fiscal ligada"}</span>
                    </span>
                    <span className="text-sm">
                      <span className="block text-xs font-medium text-muted-foreground uppercase">Começo</span>
                      <span className="tabular-nums">
                        {diaIni} às {horaIni}
                      </span>
                    </span>
                    <span className="text-sm">
                      <span className="block text-xs font-medium text-muted-foreground uppercase">Fim</span>
                      {fim ? (
                        <span className="tabular-nums">
                          {fim[0]} às {fim[1]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Em andamento</span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-3 md:justify-end">
                      <EstadoDaDescarga status={l.status} />
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                        {l.passos} passos <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageWrapper>
  );
}
