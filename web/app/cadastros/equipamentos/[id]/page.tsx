import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EquipamentoForm } from "@/components/cadastros/EquipamentoForm";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { getDb } from "@/lib/db";
import { listarArmazens, obterEquipamento } from "@/lib/cadastros/servico";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const e = obterEquipamento(db, Number(id));
  if (!e) notFound();
  const armazens = listarArmazens(db)
    .filter((a) => a.ativo || a.id === e.armazemId)
    .map((a) => ({ id: a.id, nome: a.nome }));
  return (
    <PageWrapper
      title={e.nome ?? "Equipamento"}
      description={`${e.armazemNome} · usado em ${e.usos} ${e.usos === 1 ? "descarga" : "descargas"}`}
      size="narrow"
      actions={
        <Button asChild variant="ghost">
          <Link href="/cadastros">
            <ArrowLeft /> Cadastros
          </Link>
        </Button>
      }
    >
      <EquipamentoForm
        armazens={armazens}
        inicial={{ id: e.id, armazemId: e.armazemId, nome: e.nome ?? "", finalidade: e.finalidade ?? "", status: e.status, indisponivelMotivo: e.indisponivelMotivo ?? "" }}
      />
    </PageWrapper>
  );
}
