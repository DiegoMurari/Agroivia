import { redirect } from "next/navigation";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { Usuarios } from "@/components/usuarios/Usuarios";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";
import { listarUsuarios } from "@/lib/usuarios/servico";

export default async function Page() {
  const db = getDb();
  // O proxy confere o cookie; aqui a sessão é conferida no banco (conta desativada ou rebaixada não entra).
  const eu = await exigirAcesso("adm_master", db).catch(() => null);
  if (!eu) redirect("/login?voltar=%2Fusuarios");
  return (
    <PageWrapper title="Usuários" description="Contas da Agrovia. Você não pode desativar nem excluir a sua própria conta." size="wide">
      <Usuarios usuarios={listarUsuarios(db, agoraISO())} meuId={eu.id} />
    </PageWrapper>
  );
}
