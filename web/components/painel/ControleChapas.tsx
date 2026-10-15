import { CircleCheck, Forklift, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { CopiarTexto } from "@/components/painel/CopiarTexto";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { Db } from "@/lib/db";
import { formatBRL, formatNumero } from "@/lib/money";
import { chapasEscaladasHoje, saldoDeChapas, ultimosBoletins, type SaldoDeChapas } from "@/lib/painel/controle-chapas";
import { dataSeguinte } from "@/lib/painel/dia-seguinte";
import { previsaoDoDia, type PrevisaoDoDia } from "@/lib/painel/previsao-chapas";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const ORIGEM = { teste: "Teste", operacao: "Operação" } as const;

function corDoSaldo(s: SaldoDeChapas): string {
  if (s.tipo === "faltam") return "text-lack";
  if (s.tipo === "sobram") return "text-excess";
  if (s.tipo === "sem_equipe") return "text-muted-foreground";
  return "text-success";
}

function faixaDe(p: PrevisaoDoDia): string | null {
  const { previsao, necessidade } = p;
  if (necessidade.agendamentos === 0) return "Sem agenda";
  if (previsao.ate !== null && previsao.ate !== previsao.de && (previsao.tipo === "cobre" || previsao.tipo === "nao_cobre")) return `mín. ${previsao.de}, máx. ${previsao.ate}`;
  return `mín. ${previsao.de}`;
}

function DiaCompacto({ titulo, data, p, rodape }: { titulo: string; data: string; p: PrevisaoDoDia; rodape?: React.ReactNode }) {
  return (
    <Card className="gap-1 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-h3 text-brand">
          {titulo}, {dataBR(data)}
        </h3>
        {p.necessidade.maximo.empilhadeira && (
          <Badge variant="outline">
            <Forklift /> Empilhadeira
          </Badge>
        )}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-display font-semibold tabular-nums text-brand">{p.previsao.recomendado}</span>
        <span className="text-lg">{p.previsao.recomendado === 1 ? "funcionário" : "funcionários"}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        {faixaDe(p)}
        {p.necessidade.agendamentos > 0 && `, ${p.necessidade.agendamentos} ${p.necessidade.agendamentos === 1 ? "caminhão" : "caminhões"}`}
      </p>
      {rodape}
    </Card>
  );
}

/**
 * Controle de chapas da tela inicial, versão compacta: hoje (agenda contra equipe lançada) e amanhã
 * (com o aviso ao prestador). Quem monta passa a data de hoje (lib/relogio): <ControleChapas db={getDb()} hoje={hojeISO()} />.
 */
export function ControleChapas({ db, hoje }: { db: Db; hoje: string }) {
  const amanha = dataSeguinte(hoje);
  const pHoje = previsaoDoDia(db, hoje);
  const pAmanha = previsaoDoDia(db, amanha);
  const escalados = chapasEscaladasHoje(db, hoje);
  const saldo = saldoDeChapas(pHoje.necessidade, escalados);
  const boletins = ultimosBoletins(db, 5);

  return (
    <section aria-labelledby="controle-chapas" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="controle-chapas" className="text-h2 text-brand">
          Chapas
        </h2>
        <Link href="/painel" className="text-sm font-medium text-brand underline">
          Ver previsão da semana
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DiaCompacto
          titulo="Hoje"
          data={hoje}
          p={pHoje}
          rodape={
            <p className={`flex items-center gap-2 pt-2 text-sm font-medium ${corDoSaldo(saldo)}`}>
              {saldo.tipo === "faltam" ? <TrendingDown aria-hidden className="size-4" /> : saldo.tipo === "sobram" ? <TrendingUp aria-hidden className="size-4" /> : saldo.tipo === "sem_equipe" ? null : <CircleCheck aria-hidden className="size-4" />}
              {escalados === null ? "Equipe ainda não lançada" : `${escalados} ${escalados === 1 ? "escalada" : "escaladas"}: ${saldo.texto}`}
            </p>
          }
        />
        <DiaCompacto
          titulo="Amanhã"
          data={amanha}
          p={pAmanha}
          rodape={
            <div className="pt-2">
              <p id="controle-aviso-amanha" className="sr-only" aria-hidden="true">
                {pAmanha.aviso}
              </p>
              <CopiarTexto texto={pAmanha.aviso} idDoTexto="controle-aviso-amanha" rotulo="Copiar aviso ao prestador" />
            </div>
          }
        />
      </div>

      {boletins.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-h3 text-brand">Últimos boletins</summary>
          <div className="border-t px-5 py-5">
            <Table>
              <TableCaption className="sr-only">Resultado de cada boletim fechado, pelo piso gravado nele.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Galpão</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Funcionários</TableHead>
                  <TableHead className="text-right">Reais</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boletins.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="tabular-nums">{dataBR(b.data)}</TableCell>
                    <TableCell>{b.armazem}</TableCell>
                    <TableCell>{ORIGEM[b.origem]}</TableCell>
                    <TableCell>
                      {b.rotulo === "excesso" ? (
                        <Badge variant="warning">
                          <TrendingUp /> Excesso
                        </Badge>
                      ) : b.rotulo === "falta" ? (
                        <Badge variant="destructive">
                          <TrendingDown /> Falta
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <CircleCheck /> Equilíbrio
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-brand">{formatNumero(b.chapas)}</TableCell>
                    <TableCell className="text-right tabular-nums text-brand">{formatBRL(b.reais)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      )}
    </section>
  );
}
