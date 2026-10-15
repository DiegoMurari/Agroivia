import { PageWrapper } from "@/components/layout/PageWrapper";
import { Cadastros } from "@/components/cadastros/Cadastros";
import { getDb } from "@/lib/db";
import { consultas, garantirEquipamentosUnicos, listarArmazens, listarChapas, listarEquipamentos } from "@/lib/cadastros/servico";

export default function Page() {
  const db = getDb();
  // Cada equipamento é uma unidade: linhas antigas com quantidade maior são separadas na primeira visita
  garantirEquipamentosUnicos(db);
  return (
    <PageWrapper title="Cadastros" description="Cada equipamento é único. Nada é apagado: use inativo ou manutenção." size="wide">
      <Cadastros armazens={listarArmazens(db)} equipamentos={listarEquipamentos(db)} chapas={listarChapas(db)} consulta={consultas(db)} />
    </PageWrapper>
  );
}
