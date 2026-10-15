import { AgendarFornecedor } from "@/components/agendamento/AgendarFornecedor";
import { AvisarAtraso } from "@/components/agendamento/AvisarAtraso";
import { CancelarLink } from "@/components/agendamento/CancelarLink";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Alert } from "@/components/ui/Alert";
import { obterVisaoDoLink } from "@/lib/agendamento/agendar";
import { carregarContexto } from "@/lib/agendamento/comum";
import { dataBR } from "@/lib/agendamento/datas";
import { listarAvisos } from "@/lib/agendamento/portaria";
import { resumoNf } from "@/lib/agendamento/resumo";
import { proximosDias } from "@/lib/agendamento/ocupacao";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const visao = obterVisaoDoLink(db, token);

  if (!visao) {
    return (
      <PageWrapper title="Agendamento de descarga" size="narrow">
        <Alert variant="destructive" title="Link inválido">
          Não encontramos este link. Peça um novo link a Compras.
        </Alert>
      </PageWrapper>
    );
  }

  if (visao.agendamento) {
    const ag = visao.agendamento;
    return (
      <PageWrapper title={ag.status === "cancelado" ? "Agendamento cancelado" : "Agendamento confirmado"} description={visao.compra.fornecedor} size="narrow">
        <div className="space-y-4">
          <Alert variant={ag.status === "cancelado" ? "warning" : "success"} title={ag.status === "cancelado" ? "Agendamento cancelado" : "Descarga agendada"}>
            {dataBR(ag.data)} às {ag.horario}
            {ag.motivoCancelamento ? `. Motivo: ${ag.motivoCancelamento}. Para uma nova data, peça um novo link a Compras.` : "."}
          </Alert>
          {listarAvisos(db, ag.id).map((av) => (
            <Alert key={av.id} variant="warning" title="Aviso da Agrovia">{av.mensagem}</Alert>
          ))}
          <ul className="divide-y rounded-lg border text-sm">
            {ag.nfs.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm">{resumoNf(n)}</span>
                {ag.arquivos
                  .filter((a) => a.notaFiscalId === n.id)
                  .map((a) => (
                    <a key={a.id} className="text-brand underline" href={`/api/agendamento/arquivos/${a.id}`}>
                      Baixar {a.nome}
                    </a>
                  ))}
              </li>
            ))}
          </ul>
          {ag.status === "agendado" && <AvisarAtraso token={token} />}
          {ag.status === "agendado" && <CancelarLink token={token} />}
        </div>
      </PageWrapper>
    );
  }

  if (visao.compra.status !== "criada") {
    return (
      <PageWrapper title="Agendamento de descarga" size="narrow">
        <Alert variant="warning" title="Link encerrado">
          Este link não aceita mais agendamentos. Para uma nova data, peça um novo link a Compras.
        </Alert>
      </PageWrapper>
    );
  }

  const ctx = carregarContexto(db, agoraISO());
  return (
    <PageWrapper title="Agendamento de descarga" description={`Fornecedor: ${visao.compra.fornecedor}`} size="default">
      <AgendarFornecedor token={token} diasBatido={proximosDias(ctx, "batido", 10)} diasUnitizado={proximosDias(ctx, "unitizado", 10)} />
    </PageWrapper>
  );
}
