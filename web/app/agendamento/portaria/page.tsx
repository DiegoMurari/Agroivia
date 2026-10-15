import { ConferirNota } from "@/components/agendamento/ConferirNota";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { aguardadosHoje } from "@/lib/agendamento/portaria";
import { usuarioAtual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";

export default async function Page() {
  const usuario = await usuarioAtual();
  return (
    <PageWrapper title="Conferir nota fiscal" description="Leia a nota e veja se bate com o agendamento." size="narrow">
      <ConferirNota podeAbrirDescarga={usuario?.perfil !== "portaria"} aguardados={aguardadosHoje(getDb(), agoraISO())} />
    </PageWrapper>
  );
}
