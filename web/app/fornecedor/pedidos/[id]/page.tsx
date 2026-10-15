import Link from "next/link";

import { CalendarioPedido } from "@/components/agendamento/CalendarioPedido";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Alert } from "@/components/ui/Alert";
import { dataDoInstante, somarDias } from "@/lib/agendamento/datas";
import { listarPedidosDoFornecedor, listarTiposMercadoria, notasDoPedido } from "@/lib/agendamento/pedido";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";
import { tempoDosDias, type TempoDoDia } from "@/lib/tempo";

/** Editar pedido em aberto: a edição devolve o pedido para aprovação. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const usuario = await exigirAcesso("fornecedor");
  const db = getDb();
  const pedido = Number.isInteger(id) ? listarPedidosDoFornecedor(db, usuario.id).find((p) => p.id === id) : undefined;
  if (!pedido || !pedido.emAberto) {
    return (
      <PageWrapper title="Editar pedido" size="narrow">
        <Alert variant="warning" title="Este pedido não pode ser editado">
          Ele não existe ou já foi aprovado. Volte ao <Link className="underline" href="/fornecedor/pedidos">histórico de pedidos</Link>.
        </Alert>
      </PageWrapper>
    );
  }
  const agora = agoraISO();
  const hoje = dataDoInstante(agora);
  let tempo: Record<string, TempoDoDia> = {};
  try {
    tempo = await tempoDosDias(db, hoje, somarDias(hoje, 15), agora);
  } catch {
    tempo = {};
  }
  return (
    <PageWrapper title={`Editar pedido ${pedido.id}`} description="Ao enviar, volta para a aprovação de Compras." size="wide">
      <CalendarioPedido
        hoje={hoje}
        tempo={tempo}
        tipos={listarTiposMercadoria(db)}
        inicial={{
          id: pedido.id,
          data: pedido.data,
          horario: pedido.horario,
          numero: pedido.numero,
          tipoValor: pedido.tipoValor,
          tipoOutros: pedido.tipoOutros,
          observacao: pedido.observacao,
          recusaComentario: pedido.recusaComentario,
          estado: pedido.estado,
          notas: notasDoPedido(db, pedido.id),
        }}
      />
    </PageWrapper>
  );
}
