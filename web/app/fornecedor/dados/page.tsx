import { eq } from "drizzle-orm";
import { Building2, CircleCheck, ShieldCheck } from "lucide-react";

import { DadosFornecedorForm } from "@/components/aprovacoes/DadosFornecedorForm";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { getDb, schema } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = getDb();
  const usuario = await usuarioAtual(db);
  const c = usuario ? db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.usuarioId, usuario.id)).get() : undefined;
  if (!c) {
    return (
      <PageWrapper title="Meus dados" size="wide">
        <Alert variant="destructive" title="Cadastro não encontrado">
          Entre com a conta de fornecedor para ver os seus dados.
        </Alert>
      </PageWrapper>
    );
  }
  return (
    <PageWrapper title="Meus dados" description="Atualize os dados da sua empresa. Mudanças passam pela aprovação de Compras antes de valer." size="wide">
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
      <DadosFornecedorForm
        aguardando={c.alteracaoPendente !== null}
        inicial={{
          razaoSocial: c.razaoSocial,
          nomeFantasia: c.nomeFantasia ?? "",
          cnpj: c.cnpj,
          inscricaoEstadual: c.inscricaoEstadual ?? "",
          email: c.email,
          telefone: c.telefone ?? "",
          responsavel: c.responsavel ?? "",
          endereco: c.endereco ?? "",
          tiposMercadoria: c.tiposMercadoria ? (JSON.parse(c.tiposMercadoria) as string[]) : [],
        }}
      />
        <aside aria-label="Situação do cadastro" className="space-y-4 rounded-2xl border bg-card p-5 shadow-card lg:sticky lg:top-20">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-h3 leading-snug break-words text-brand">{c.nomeFantasia || c.razaoSocial}</p>
              <p className="mt-0.5 text-sm break-all text-muted-foreground">{c.email}</p>
            </div>
          </div>
          <Badge variant="success"><CircleCheck /> Cadastro aprovado</Badge>
          <p className="flex items-start gap-2 border-t pt-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            Mudanças passam pela aprovação de Compras antes de valer. Até lá, os dados atuais continuam valendo.
          </p>
        </aside>
      </div>
    </PageWrapper>
  );
}
