import { Pendencias } from "@/components/agendamento/Pendencias";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/ui/EmptyState";
import { listarPendencias } from "@/lib/agendamento/descarga";
import { getDb } from "@/lib/db";

export default function Page() {
  const pendencias = listarPendencias(getDb());
  return (
    <PageWrapper title="Pendências" description="Divergências aceitas na entrada e outras pendências, abertas e resolvidas." size="default">
      {pendencias.length === 0 ? (
        <EmptyState title="Nenhuma pendência" description="Uma carga divergente autorizada abre uma pendência aqui." />
      ) : (
        <Pendencias pendencias={pendencias} />
      )}
    </PageWrapper>
  );
}
