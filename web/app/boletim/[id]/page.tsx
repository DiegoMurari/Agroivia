import { notFound } from "next/navigation";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { BoletimForm } from "@/components/boletim/BoletimForm";
import { getDb } from "@/lib/db";
import { hojeISO } from "@/lib/relogio";
import { armazensDoBoletim, chapasAtivas, dataBR, lerBoletim, lerParametros, tiposDoFormulario } from "@/lib/boletim/servico";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const b = lerBoletim(db, Number(id));
  if (!b) notFound();

  // O armazém do boletim aparece mesmo que hoje não faça mais boletim.
  const armazens = armazensDoBoletim(db).map((a) => ({ id: a.id, nome: a.nome }));
  if (!armazens.some((a) => a.id === b.armazemId)) armazens.push({ id: b.armazemId, nome: b.armazemNome });

  return (
    <PageWrapper
      title={`Boletim ${b.armazemNome}, ${dataBR(b.data)}`}
      description={b.status === "fechado" ? "Boletim fechado." : "Boletim em edição."}
      size="wide"
    >
      <BoletimForm
        armazens={armazens}
        tipos={tiposDoFormulario(db).map((t) => ({ id: t.id, nome: t.nome, preco: t.precoUnitario, categoria: t.categoria }))}
        chapas={[...chapasAtivas(db).map((c) => ({ matricula: c.matricula, nome: c.nome })), ...b.equipe.filter((e) => !chapasAtivas(db).some((c) => c.matricula === e.matricula)).map((e) => ({ matricula: e.matricula, nome: e.nome }))]}
        hoje={hojeISO()}
        parametros={lerParametros(db)}
        inicial={{
          id: b.id,
          armazemId: b.armazemId,
          data: b.data,
          status: b.status,
          observacao: b.observacao,
          linhas: b.linhas.map((l) => ({ tipoItemId: l.tipoItemId, qtdDescarga: l.qtdDescarga, qtdRemocao: l.qtdRemocao, qtdTransferencia: l.qtdTransferencia })),
          equipe: b.equipe.map((e) => ({ matricula: e.matricula, tipo: e.tipo })),
        }}
      />
    </PageWrapper>
  );
}
