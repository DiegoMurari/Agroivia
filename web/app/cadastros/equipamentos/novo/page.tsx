import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EquipamentoForm } from "@/components/cadastros/EquipamentoForm";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { getDb } from "@/lib/db";
import { listarArmazens } from "@/lib/cadastros/servico";

export default function Page() {
  const armazens = listarArmazens(getDb())
    .filter((a) => a.ativo)
    .map((a) => ({ id: a.id, nome: a.nome }));
  return (
    <PageWrapper
      title="Novo equipamento"
      description="Cada equipamento é único: cadastre uma unidade por vez."
      size="narrow"
      actions={
        <Button asChild variant="ghost">
          <Link href="/cadastros">
            <ArrowLeft /> Cadastros
          </Link>
        </Button>
      }
    >
      <EquipamentoForm armazens={armazens} inicial={null} />
    </PageWrapper>
  );
}
