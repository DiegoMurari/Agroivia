import { CalendarioPedido } from "@/components/agendamento/CalendarioPedido";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { dataDoInstante, somarDias } from "@/lib/agendamento/datas";
import { listarTiposMercadoria } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";
import { tempoDosDias, type TempoDoDia } from "@/lib/tempo";

/** Agendar descarga: calendário do mês com vagas e tempo de cada dia (D49, D52). */
export default async function Page() {
  await exigirAcesso("fornecedor");
  const db = getDb();
  const agora = agoraISO();
  const hoje = dataDoInstante(agora);
  let tempo: Record<string, TempoDoDia> = {};
  try {
    tempo = await tempoDosDias(db, hoje, somarDias(hoje, 15), agora);
  } catch {
    tempo = {}; // sem previsão o calendário funciona igual
  }
  return (
    <PageWrapper title="Agendar descarga" description="Escolha o dia da descarga e preencha os dados." size="wide">
      <CalendarioPedido hoje={hoje} tipos={listarTiposMercadoria(db)} tempo={tempo} />
    </PageWrapper>
  );
}
