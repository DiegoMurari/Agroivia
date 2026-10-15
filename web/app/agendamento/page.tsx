import Link from "next/link";
import { Ban, ClipboardList, PackageX, Truck } from "lucide-react";

import { AgendaDescargas } from "@/components/agendamento/AgendaDescargas";
import { ComprasRecentes } from "@/components/agendamento/ComprasRecentes";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FaixaDeAvisos } from "@/components/ui/FaixaDeAvisos";
import { listarCompras } from "@/lib/agendamento/compra";
import { contadoresAgendamento } from "@/lib/agendamento/contadores";
import { somarDias } from "@/lib/agendamento/datas";
import { listarAgendamentos } from "@/lib/agendamento/descarga";
import { alertasPorPeriodo } from "@/lib/agendamento/dimensionar";
import { atrasosAvisados } from "@/lib/agendamento/portaria";
import { getDb } from "@/lib/db";
import { agoraISO, hojeISO } from "@/lib/relogio";

export default function Page() {
  const db = getDb();
  const hoje = hojeISO();
  const compras = listarCompras(db);
  const agendamentos = listarAgendamentos(db, hoje);
  const atrasos = Object.fromEntries(
    atrasosAvisados(
      db,
      agendamentos.map((a) => a.id),
    ),
  );
  const alertas = alertasPorPeriodo(db, hoje, somarDias(hoje, 14));
  const n = contadoresAgendamento(db, agoraISO());

  const cartoes = [
    {
      href: "/agendamento/portaria",
      rotulo: "Sem agendamento",
      valor: n.semAgendamento,
      icone: <Truck className="size-5" />,
      nota: "hoje",
    },
    {
      href: "/agendamento/vagas",
      rotulo: "Vagas liberadas",
      valor: n.vagasLiberadas,
      icone: <Ban className="size-5" />,
      nota: "para ocupar",
    },
    {
      href: "/agendamento/pendencias",
      rotulo: "Pendências",
      valor: n.pendenciasAbertas,
      icone: <ClipboardList className="size-5" />,
      nota: "em aberto",
    },
    {
      href: "/agendamento/nao-recebimentos",
      rotulo: "Não recebimentos",
      valor: n.naoRecebimentos,
      icone: <PackageX className="size-5" />,
      nota: "em 7 dias",
    },
  ];

  const avisos = alertas.flatMap((d) =>
    d.alertas.map((a, i) => ({
      id: `${d.data}-${i}`,
      titulo:
        a.tipo === "colaborador"
          ? "Falta de colaborador"
          : a.tipo === "equipamento"
            ? "Falta de equipamento"
            : "Falta de espaço",
      texto: a.mensagem,
    })),
  );

  return (
    <>
      <FaixaDeAvisos itens={avisos} />
      <PageWrapper
        title="Agendamento"
        description="Veja as descargas marcadas e gere o link para o fornecedor agendar."
        size="wide"
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
          <ul aria-label="Atalhos" className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-card lg:grid-cols-4">
            {cartoes.map((c, i) => (
              <li key={c.href} className={"border-b lg:border-b-0 " + (i % 2 === 1 ? "border-l " : "") + (i > 0 ? "lg:border-l" : "")}>
                <Link
                  href={c.href}
                  aria-label={`${c.rotulo}, ${c.valor}, ${c.nota}`}
                  className="group flex h-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">{c.icone}</span>
                  <p>
                    <span className="block text-3xl leading-none font-semibold tabular-nums text-brand">{c.valor}</span>
                    <span className="text-sm text-muted-foreground">
                      {c.rotulo} · {c.nota}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <section aria-labelledby="titulo-compras" className="space-y-4">
            <h2 id="titulo-compras" className="text-h2 text-brand">
              Compras recentes
            </h2>
            <ComprasRecentes compras={compras} />
          </section>

          <section aria-labelledby="titulo-agenda" className="space-y-4">
            <h2 id="titulo-agenda" className="text-h2 text-brand">
              Próximas descargas
            </h2>
            <AgendaDescargas
              linhas={agendamentos}
              hoje={hoje}
              atrasos={atrasos}
            />
          </section>
        </div>
      </PageWrapper>
    </>
  );
}
