import Link from "next/link";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { listarNaoRecebimentos } from "@/lib/agendamento/desvios";
import { getDb } from "@/lib/db";

const MOTIVO: Record<string, string> = {
  divergencia_nota_pedido: "Divergência entre nota e pedido",
  sem_agendamento_sem_vaga: "Sem agendamento e sem vaga",
  caso_fortuito: "Caso fortuito",
  outro: "Outro",
};

export default function Page() {
  const linhas = listarNaoRecebimentos(getDb());
  return (
    <PageWrapper title="Não recebimentos" description="Cargas que não foram recebidas, com o motivo." size="wide">
      {linhas.length === 0 ? (
        <EmptyState title="Nenhum não recebimento" description="Registre na tela da descarga ou na portaria." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registrado em</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Agendamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.registradoEm.slice(0, 16).replace("T", " ")}</TableCell>
                <TableCell>{l.fornecedor ?? "-"}</TableCell>
                <TableCell>{l.placa ?? "-"}</TableCell>
                <TableCell>{MOTIVO[l.motivo ?? ""] ?? l.motivo}</TableCell>
                <TableCell>{l.descricao ?? "-"}</TableCell>
                <TableCell>
                  {l.agendamentoId ? (
                    <Link className="text-brand underline" href={`/agendamento/descarga/${l.agendamentoId}`}>Abrir</Link>
                  ) : (
                    "Nunca agendou"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageWrapper>
  );
}
