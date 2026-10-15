import { CircleCheck, CircleDashed, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { formatNumero } from "@/lib/money";
import type { MesResumo } from "@/lib/painel/sobra-falta";

function Status({ status }: { status: MesResumo["status"] }) {
  if (status === "ok")
    return (
      <Badge variant="success">
        <CircleCheck /> Com dado
      </Badge>
    );
  if (status === "parcial")
    return (
      <Badge variant="warning">
        <TriangleAlert /> Parcial
      </Badge>
    );
  return (
    <Badge variant="outline">
      <CircleDashed /> Sem dado
    </Badge>
  );
}

/** Um mês por linha. Mês sem dado ou parcial fica como lacuna: não tem número e fica fora das médias. */
export function TabelaMeses({ meses }: { meses: MesResumo[] }) {
  return (
    <Table>
      <TableCaption>Um mês por linha; mês sem dado ou parcial fica como lacuna, fora das médias.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="text-right">Dias comparados</TableHead>
          <TableHead className="text-right">Efetivo médio</TableHead>
          <TableHead className="text-right">Excesso médio (funcionários/dia)</TableHead>
          <TableHead className="text-right">Falta média (funcionários/dia)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {meses.map((m) => (
          <TableRow key={m.anoMes}>
            <TableCell className="font-medium tabular-nums">{m.anoMes}</TableCell>
            <TableCell>
              <Status status={m.status} />
            </TableCell>
            {m.resumo ? (
              <>
                <TableCell className="text-right tabular-nums">{m.resumo.diasConsiderados}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumero(m.resumo.efetivoMedio)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumero(m.resumo.excessoMedioChapas)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumero(m.resumo.faltaMediaChapas)}</TableCell>
              </>
            ) : (
              <TableCell colSpan={4} className="text-muted-foreground">
                {m.status === "parcial" ? "Poucos dias de folha: fora das médias." : "Sem dado: fora das médias, sem interpolação."}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
