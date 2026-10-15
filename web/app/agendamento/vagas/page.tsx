import { Vagas } from "@/components/agendamento/Vagas";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/ui/EmptyState";
import { listarVagasAbertas } from "@/lib/agendamento/desvios";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";

export default function Page() {
  const vagas = listarVagasAbertas(getDb(), agoraISO());
  return (
    <PageWrapper title="Vagas liberadas" description="O responsável escolhe quem ocupa cada vaga aberta por um cancelamento." size="default">
      {vagas.length === 0 ? (
        <EmptyState title="Nenhuma vaga aberta" description="Quando um agendamento for cancelado, a vaga aparece aqui." />
      ) : (
        <Vagas vagas={vagas} />
      )}
    </PageWrapper>
  );
}
