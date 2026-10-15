import { ClimaIcone } from "@/components/boletim/ClimaIcone";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { BoletimForm } from "@/components/boletim/BoletimForm";
import { getDb } from "@/lib/db";
import { agoraISO, hojeISO } from "@/lib/relogio";
import { tempoDosDias } from "@/lib/tempo";
import { climaDoDia } from "@/lib/boletim/clima";
import { armazensDoBoletim, chapasAtivas, lerParametros, tiposDoFormulario } from "@/lib/boletim/servico";

export default async function Page({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { data } = await searchParams;
  const db = getDb();
  const hoje = hojeISO();
  const dia = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hoje;
  const clima = climaDoDia(dia, hoje, (await tempoDosDias(db, dia, dia, agoraISO()))[dia]);
  return (
    <PageWrapper
      title="Novo boletim"
      size="wide"
      description={
        <span className="inline-flex items-center gap-2">
          <ClimaIcone tipo={clima.tipo} className="size-4" /> {clima.frase}, {clima.descricao.toLowerCase()}
          {clima.maxC !== null && `, ${clima.maxC}°`}
        </span>
      }
    >
      <BoletimForm
        armazens={armazensDoBoletim(db).map((a) => ({ id: a.id, nome: a.nome }))}
        tipos={tiposDoFormulario(db).map((t) => ({ id: t.id, nome: t.nome, preco: t.precoUnitario, categoria: t.categoria }))}
        chapas={chapasAtivas(db).map((c) => ({ matricula: c.matricula, nome: c.nome }))}
        hoje={dia}
        parametros={lerParametros(db)}
      />
    </PageWrapper>
  );
}
