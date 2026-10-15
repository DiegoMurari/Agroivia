import { PedidosFornecedor } from "@/components/agendamento/PedidosFornecedor";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { dataDoInstante, somarDias } from "@/lib/agendamento/datas";
import { listarNotificacoes, listarPedidosDoFornecedor, listarTiposMercadoria, notasDoPedido } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";
import { tempoDosDias, type TempoDoDia } from "@/lib/tempo";

/** Histórico de pedidos do fornecedor e central de notificações (D49). A edição abre em popup nesta mesma tela. */
export default async function Page() {
  const usuario = await exigirAcesso("fornecedor");
  const db = getDb();
  const agora = agoraISO();
  const hoje = dataDoInstante(agora);
  const pedidos = listarPedidosDoFornecedor(db, usuario.id);
  let tempo: Record<string, TempoDoDia> = {};
  try {
    tempo = await tempoDosDias(db, hoje, somarDias(hoje, 15), agora);
  } catch {
    tempo = {}; // sem previsão o calendário funciona igual
  }
  const notas = Object.fromEntries(pedidos.filter((p) => p.emAberto).map((p) => [p.id, notasDoPedido(db, p.id)]));
  return (
    <PageWrapper title="Meus pedidos" description="Acompanhe a aprovação de cada pedido." size="wide">
      <PedidosFornecedor pedidos={pedidos} notificacoes={listarNotificacoes(db, usuario.id)} edicao={{ hoje, tempo, tipos: listarTiposMercadoria(db), notas }} />
    </PageWrapper>
  );
}
