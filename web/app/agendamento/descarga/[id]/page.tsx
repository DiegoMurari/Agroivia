import Link from "next/link";

import { Descarga } from "@/components/agendamento/Descarga";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Alert } from "@/components/ui/Alert";
import { listarArmazensEEquipamentos, obterDetalhe } from "@/lib/agendamento/descarga";
import { cargaElegivelPrioridade } from "@/lib/agendamento/desvios";
import { alertasDaData } from "@/lib/agendamento/dimensionar";
import { calcularAtraso } from "@/lib/agendamento/estado";
import { numeroDoAgendamento } from "@/lib/agendamento/numero";
import { atrasosAvisados, listarAvisos } from "@/lib/agendamento/portaria";
import { lerParametro } from "@/lib/agendamento/comum";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  let detalhe;
  try {
    detalhe = Number.isInteger(id) ? obterDetalhe(db, id) : null;
  } catch {
    detalhe = null;
  }
  if (!detalhe) {
    return (
      <PageWrapper title="Descarga" size="narrow">
        <Alert variant="destructive" title="Agendamento não encontrado">
          Confira o número ou volte à <Link className="underline" href="/agendamento">lista de agendamentos</Link>.
        </Alert>
      </PageWrapper>
    );
  }
  const agora = agoraISO();
  const a = detalhe.agendamento;
  if (a.aprovacao !== "aprovado") {
    return (
      <PageWrapper title={`Pedido ${a.id}`} size="narrow">
        <Alert variant="warning" title="Pedido ainda não aprovado">
          Este pedido está em &quot;{a.aprovacao === "aguardando" ? "aguardando aprovação" : a.aprovacao}&quot;. Decida em <Link className="underline" href="/aprovacoes">Aprovações</Link>; a descarga só abre depois de aprovado.
        </Alert>
      </PageWrapper>
    );
  }
  const atraso = calcularAtraso(
    { id: a.id, status: a.status, data: a.data, horario: a.horario, chegadaEm: a.chegadaEm, acondicionamento: a.acondicionamentoOcupacao },
    agora,
    Number(lerParametro(db, "tolerancia_min", "30")),
  );
  const { armazens, equipamentos } = listarArmazensEEquipamentos(db);
  return (
    <PageWrapper title={`Descarga ${numeroDoAgendamento(detalhe.agendamento.id, detalhe.agendamento.criadoEm)}`} description="Chegada, entrada e saída por armazém." size="default">
      <Descarga
        detalhe={detalhe}
        armazens={armazens.map((a) => ({ id: a.id, nome: a.nome }))}
        equipamentos={equipamentos}
        agora={agora}
        atraso={atraso}
        elegivelPrioridade={cargaElegivelPrioridade(db, a.id)}
        atrasoAvisado={atrasosAvisados(db, [a.id]).get(a.id) ?? null}
        alertasDia={alertasDaData(db, a.data)}
        avisos={listarAvisos(db, a.id).map((x) => ({ id: x.id, mensagem: x.mensagem, criadoEm: x.criadoEm }))}
      />
    </PageWrapper>
  );
}
