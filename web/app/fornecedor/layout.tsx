import { Clock, CircleX } from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { usuarioAtual } from "@/lib/auth";

// Renderização dinâmica: as telas do módulo leem o banco a cada pedido. Não remover.
export const dynamic = "force-dynamic";

/**
 * Portão do Espaço Fornecedores (D49), da janela geral: só o cadastro aprovado vê as telas.
 * Pendente vê "aguardando aprovação"; recusado vê o motivo. As rotas de /api/fornecedor
 * repetem a conferência com `exigirAcesso("fornecedor")`.
 */
export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const usuario = await usuarioAtual();
  if (usuario?.perfil === "fornecedor" && usuario.cadastroStatus === "aprovado") return children;

  const recusado = usuario?.cadastroStatus === "recusado";
  return (
    <PageWrapper title="Espaço Fornecedores" size="narrow">
      {recusado ? (
        <Alert variant="destructive" title="Cadastro recusado">
          Compras recusou o seu cadastro. Fale com o comprador que enviou o convite para corrigir os dados.
        </Alert>
      ) : (
        <EmptyState
          icon={recusado ? <CircleX /> : <Clock />}
          title="Aguardando aprovação"
          description="Seu cadastro foi recebido e está em análise por Compras. Você recebe o acesso assim que for aprovado."
        />
      )}
    </PageWrapper>
  );
}
