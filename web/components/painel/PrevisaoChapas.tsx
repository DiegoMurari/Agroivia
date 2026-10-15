import { TriangleAlert } from "lucide-react";

import { CopiarTexto } from "@/components/painel/CopiarTexto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { Db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { previsaoDoDia } from "@/lib/painel/previsao-chapas";

interface Props {
  db: Db;
  /** Dia da previsão, AAAA-MM-DD. */
  data: string;
  titulo: string;
  /** Com seletor de data (formulário GET que envia `?<nomeParametro>=`). */
  seletor?: { nomeParametro: string; rotulo?: string; campos?: Record<string, string> };
  /** Prefixo único para os ids da página (dois cartões na mesma tela). */
  idBase: string;
}

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const faixa = (a: number, b: number | null) => (b === null || a === b ? String(a) : `${a} a ${b}`);

/** Cartão de um dia: número recomendado, faixa, motivo, complemento previsto, tabela por horário e aviso ao prestador. */
export function PrevisaoChapas({ db, data, titulo, seletor, idBase }: Props) {
  const p = previsaoDoDia(db, data);
  const { previsao, necessidade } = p;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h3 text-brand">
            {titulo}: {dataBR(data)}
          </h3>
          <Badge variant="outline">Origem: {necessidade.origens.length > 0 ? necessidade.origens.join(" e ") : p.temMediaBoletim ? "teste ou operação" : "sem agendamento"}</Badge>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-display font-semibold text-brand tabular-nums">{previsao.recomendado}</span>
          <span className="text-lg">{previsao.recomendado === 1 ? "funcionário recomendado" : "funcionários recomendados"}</span>
          {(previsao.tipo === "cobre" || previsao.tipo === "nao_cobre") && previsao.ate !== null && previsao.ate !== previsao.de && (
            <span className="text-muted-foreground">de {faixa(previsao.de, previsao.ate)}</span>
          )}
        </div>

        <p>{previsao.motivo}</p>

        {previsao.complementoPrevisto && (
          <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning" />
            <span>
              Complemento previsto de <strong>{formatBRL(previsao.complementoPrevisto)}</strong>: a produção prevista não cobre as diárias dos chapas necessários.
            </span>
          </p>
        )}

        {!p.temMediaBoletim && necessidade.agendamentos > 0 && (
          <p className="text-sm text-muted-foreground">Sem boletim fechado recente neste armazém: a remoção e a transferência entram como zero.</p>
        )}

        {necessidade.porHorario.length > 0 && (
          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Ver por horário</summary>
            <div className="pt-3">
              <Table>
                <TableCaption>Funcionários pedidas pela norma por horário e armazém. Mesmo horário soma; entre horários vale o maior.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead className="text-right">Recebimentos</TableHead>
                    <TableHead>Armazéns</TableHead>
                    <TableHead className="text-right">Funcionários</TableHead>
                    <TableHead>Empilhadeira</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {necessidade.porHorario.map((h) => (
                    <TableRow key={h.horario}>
                      <TableCell className="font-medium tabular-nums">{h.horario}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.agendamentos}</TableCell>
                      <TableCell>{h.porArmazem.map((a) => `${a.nome} ${faixa(a.minimo.chapas, a.maximo.chapas)}`).join(", ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{faixa(h.minimo.chapas, h.maximo.chapas)}</TableCell>
                      <TableCell>{h.maximo.empilhadeira ? "Sim" : "Não"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(necessidade.semPeso > 0 || necessidade.semNf > 0) && (
                <p className="pt-2 text-sm text-muted-foreground">
                  Incerteza: {necessidade.semPeso} NF sem peso e {necessidade.semNf} agendamentos sem NF ligada entram como faixa.
                </p>
              )}
            </div>
          </details>
        )}

        <p id={`${idBase}-aviso`} className="sr-only" aria-hidden="true">
          {p.aviso}
        </p>
        <CopiarTexto texto={p.aviso} idDoTexto={`${idBase}-aviso`} rotulo="Copiar aviso ao prestador" />

        {seletor && (
          <form method="get" action="/painel" className="flex flex-wrap items-end gap-3">
            {Object.entries(seletor.campos ?? {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Field label={seletor.rotulo ?? "Ver outro dia"}>
              <Input type="date" name={seletor.nomeParametro} size="sm" defaultValue={data} />
            </Field>
            <Button type="submit" size="sm" variant="secondary">
              Ver dia
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
