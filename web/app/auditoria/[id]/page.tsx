import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Flag, Play } from "lucide-react";

import { EstadoDaDescarga } from "@/components/agendamento/EstadoDaDescarga";
import { LinhaDoTempo, partesDoInstante } from "@/components/auditoria/LinhaDoTempo";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { getDb } from "@/lib/db";
import { obterTrajeto } from "@/lib/auditoria/trajeto";

export const dynamic = "force-dynamic";

const dataBR = (d: string) => d.split("-").reverse().join("/");
const duracao = (min: number) => (min >= 1440 ? `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h` : min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min` : `${min} min`);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const t = obterTrajeto(getDb(), Number(id));
  if (!t) notFound();
  const [diaIni, horaIni] = partesDoInstante(t.inicio);
  const fim = t.fim ? partesDoInstante(t.fim) : null;

  return (
    <PageWrapper
      title={t.fornecedor}
      description={`Entrega nº ${t.agendamentoId} · descarga de ${dataBR(t.data)} às ${t.horario}${t.placa ? ` · placa ${t.placa}` : ""}`}
      size="default"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost">
            <Link href="/auditoria">
              <ArrowLeft /> Auditoria
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/agendamento/descarga/${t.agendamentoId}`}>Abrir a descarga</Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <section aria-label="Começo e fim" className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Play className="size-4 text-brand" aria-hidden="true" /> Começo
            </p>
            <p className="text-h3 tabular-nums">
              {diaIni} às {horaIni}
            </p>
            <p className="text-sm text-muted-foreground">Pedido criado</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flag className="size-4 text-brand" aria-hidden="true" /> Fim
            </p>
            {fim ? (
              <p className="text-h3 tabular-nums">
                {fim[0]} às {fim[1]}
              </p>
            ) : (
              <p className="text-h3">Em andamento</p>
            )}
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <EstadoDaDescarga status={t.status} />
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">Do pedido ao fim</p>
            <p className="text-h3 tabular-nums text-brand">{t.duracaoMin !== null ? duracao(t.duracaoMin) : "A contar"}</p>
            <p className="text-sm text-muted-foreground">{t.passos.length} passos registrados</p>
          </div>
        </section>

        {t.notas.length > 0 && (
          <section aria-labelledby="notas" className="grid gap-3">
            <h2 id="notas" className="text-h3 text-brand">
              Notas fiscais
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {t.notas.map((n) => {
                const ini = partesDoInstante(n.inicio);
                const f = n.fim ? partesDoInstante(n.fim) : null;
                return (
                  <li key={n.id} className="rounded-xl border bg-card p-4 shadow-card">
                    <p className="flex items-center gap-2 font-semibold">
                      <FileText className="size-4 text-brand" aria-hidden="true" /> NF {n.numero ?? "sem número"}
                    </p>
                    <p className="text-sm text-muted-foreground">{n.emitente ?? "Emitente não informado"}</p>
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Começo: </span>
                      <span className="tabular-nums">
                        {ini[0]} às {ini[1]}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Fim: </span>
                      {f ? (
                        <span className="tabular-nums">
                          {f[0]} às {f[1]}
                        </span>
                      ) : (
                        "ainda não recebida"
                      )}
                    </p>
                    <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">{n.chave}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="trajeto" className="grid gap-4">
          <h2 id="trajeto" className="text-h3 text-brand">
            Trajeto
          </h2>
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <LinhaDoTempo passos={t.passos} />
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
