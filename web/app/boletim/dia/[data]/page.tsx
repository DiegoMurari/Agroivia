import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Pencil, Users, Wallet, Warehouse, Boxes } from "lucide-react";

import { BotaoImprimir } from "@/components/boletim/BotaoImprimir";
import { ClimaIcone } from "@/components/boletim/ClimaIcone";
import { Numero } from "@/components/boletim/Numero";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { getDb } from "@/lib/db";
import { agoraISO, hojeISO } from "@/lib/relogio";
import { tempoDosDias } from "@/lib/tempo";
import { climaDoDia } from "@/lib/boletim/clima";
import { dec, formatBRL, formatNumero } from "@/lib/money";
import { somarBoletins } from "@/lib/boletim/dia";
import { dataBR, lerBoletim, listarBoletins } from "@/lib/boletim/servico";

const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });

export default async function Page({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) notFound();
  const db = getDb();
  const clima = climaDoDia(data, hojeISO(), (await tempoDosDias(db, data, data, agoraISO()))[data]);
  const boletins = listarBoletins(db, { data })
    .sort((a, b) => a.armazemNome.localeCompare(b.armazemNome, "pt-BR"))
    .map((r) => lerBoletim(db, r.id)!);
  const totais = somarBoletins(boletins.map((b) => ({ id: b.id, data: b.data, producaoTotal: b.producaoTotal, totalAPagar: b.totalAPagar, complemento: b.complemento, chapas: b.equipe.length })));

  return (
    <PageWrapper
      title={`Boletim de ${dataBR(data)}`}
      size="wide"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border bg-card px-4 py-1.5 text-base font-semibold text-brand first-letter:uppercase">{diaDaSemana(data)}, {dataBR(data)}</span>
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-base">
            <ClimaIcone tipo={clima.tipo} className="size-5" /> <span className="font-medium">{clima.frase}</span>
            {clima.maxC !== null && <span className="text-muted-foreground">{clima.descricao.toLowerCase()}, {clima.maxC}°</span>}
          </span>
          <span className="ml-auto flex gap-2">
            <BotaoImprimir />
          </span>
        </div>
        {boletins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum boletim neste dia.</p>
        ) : (
          <>
            <section aria-label="Totais do dia" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Numero rotulo="Produção" valor={formatBRL(totais.producao)} icone={Boxes} />
              <Numero rotulo="Total a pagar" valor={formatBRL(totais.totalAPagar)} icone={Wallet} />
              <Numero rotulo="Complemento" valor={formatBRL(totais.complemento)} icone={Banknote} />
              <Numero rotulo="Funcionários" valor={totais.chapas} icone={Users} />
            </section>

            {boletins.map((b) => {
              const usadas = b.linhas.filter((l) => dec(l.quantidadeTotal).gt(0));
              return (
                <section key={b.id} aria-label={`Boletim ${b.armazemNome}`} className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-3 text-h3 text-brand">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                        <Warehouse className="size-5" aria-hidden="true" />
                      </span>
                      {b.armazemNome}
                      {b.status !== "fechado" && <Badge variant="outline">Rascunho</Badge>}
                    </h2>
                    <Button asChild variant="outline" size="sm" className="print:hidden">
                      <Link href={`/boletim/${b.id}`} aria-label={`Editar boletim de ${b.armazemNome}, ${dataBR(b.data)}`}>
                        <Pencil /> Editar
                      </Link>
                    </Button>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Preço (R$)</TableHead>
                          <TableHead className="text-right">Valor (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usadas.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-muted-foreground">
                              Sem produção lançada.
                            </TableCell>
                          </TableRow>
                        )}
                        {usadas.map((l) => (
                          <TableRow key={l.tipoItemId}>
                            <TableCell>{l.nome}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumero(l.quantidadeTotal, 0)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumero(l.precoUsado, 4)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumero(l.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-border bg-muted/40 px-5 py-3 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-muted-foreground">Produção</dt>
                        <dd className="font-semibold tabular-nums">{formatBRL(b.producaoTotal)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Funcionários</dt>
                        <dd className="font-semibold tabular-nums">{b.equipe.length}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Complemento</dt>
                        <dd className="font-semibold tabular-nums">{formatBRL(b.complemento)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Total a pagar</dt>
                        <dd className="font-semibold tabular-nums text-brand">{formatBRL(b.totalAPagar)}</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              );
            })}

            <section aria-label="Total geral" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
              <h2 className="flex items-center gap-3 text-h3 text-brand">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <Wallet className="size-5" aria-hidden="true" />
                </span>
                Total geral
              </h2>
              <p className="tabular-nums">
                <span className="text-3xl font-semibold text-brand">{formatBRL(totais.totalAPagar)}</span>
                <span className="text-sm text-muted-foreground"> · {totais.chapas} funcionários</span>
              </p>
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
