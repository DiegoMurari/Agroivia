import { AbasAprovacoes } from "@/components/aprovacoes/AbasAprovacoes";
import { AprovacoesCadastros } from "@/components/aprovacoes/AprovacoesCadastros";
import { HistoricoDeDecisoes } from "@/components/aprovacoes/HistoricoDeDecisoes";
import { AprovacoesPedidos } from "@/components/agendamento/AprovacoesPedidos";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { getDb } from "@/lib/db";
import { listarPendencias } from "@/lib/aprovacoes/cadastro";
import { listarDecisoes } from "@/lib/aprovacoes/historico";
import { listarAprovacoes } from "@/lib/agendamento/pedido";
import { garantirDadosDeAuditoria } from "@/lib/auditoria/mock";
import { hojeISO } from "@/lib/relogio";

export default function Page() {
  const db = getDb();
  garantirDadosDeAuditoria(db, hojeISO());
  const { novos, alteracoes } = listarPendencias(db);
  const pedidos = listarAprovacoes(db).reduce((n, g) => n + g.pedidos.length, 0);
  return (
    <PageWrapper title="Aprovações" description="Cadastros de fornecedor e pedidos de descarga que esperam a decisão de Compras, e o histórico de quem decidiu.">
      <AbasAprovacoes
        totalCadastros={novos.length + alteracoes.length}
        totalPedidos={pedidos}
        cadastros={<AprovacoesCadastros novos={novos} alteracoes={alteracoes} />}
        pedidos={<AprovacoesPedidos />}
        historico={<HistoricoDeDecisoes decisoes={listarDecisoes(db)} />}
      />
    </PageWrapper>
  );
}
