"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageWrapper } from "@/components/layout/PageWrapper";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageWrapper size="wide">
      <Alert variant="destructive" title="Não foi possível abrir o painel">
        Houve um erro ao ler os dados. Tente de novo; se continuar, avise o responsável pelo sistema e informe o horário.
      </Alert>
      <Button className="mt-4" variant="outline" onClick={reset}>
        Tentar de novo
      </Button>
    </PageWrapper>
  );
}
