"use client";

import { PiggyBank, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { DiaProjetado, OrigemDia, Projecao } from "@/lib/painel/projecao";
import { cn } from "@/lib/utils";

const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const ORIGEM: Record<OrigemDia, { rotulo: string; detalhe: string; variante: "success" | "info" | "outline" }> = {
  agendado: { rotulo: "Pela agenda", detalhe: "caminhões agendados", variante: "success" },
  parcial: { rotulo: "Agenda + histórico", detalhe: "caminhões já agendados; a agenda ainda está incompleta", variante: "info" },
  estimado: { rotulo: "Média do histórico", detalhe: "caminhões em média nesse dia da semana", variante: "outline" },
};

const ALTURA = 270;
const TOPO = 24;
const BASE = 46;
const ESQ = 40;
const DIR = 96;

function GraficoDias({ dias, escala, escolhido, aoEscolher }: { dias: DiaProjetado[]; escala: number | null; escolhido: string; aoEscolher: (data: string) => void }) {
  const col = dias.length <= 10 ? 70 : dias.length <= 20 ? 44 : 26;
  const largura = ESQ + dias.length * col + DIR;
  const maximo = Math.max(1, escala ?? 0, ...dias.map((d) => d.ate));
  const util = ALTURA - TOPO - BASE;
  const y = (v: number) => TOPO + util - (v / maximo) * util;
  const grade = [0, 0.5, 1].map((g) => Math.round(g * maximo));
  return (
    <svg role="group" aria-label="Funcionários recomendados por dia" width="100%" viewBox={`0 0 ${largura} ${ALTURA}`} className="max-h-[22rem]">
      {grade.map((g) => (
        <g key={g}>
          <line x1={ESQ} x2={largura - DIR + 8} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray={g === 0 ? undefined : "3 4"} />
          <text x={ESQ - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{g}</text>
        </g>
      ))}
      {dias.map((d, i) => {
        const x = ESQ + i * col + Math.max(3, col * 0.14);
        const w = col - 2 * Math.max(3, col * 0.14);
        const ativo = d.data === escolhido;
        const novaSemana = i > 0 && d.diaSemana === "seg";
        return (
          <g
            key={d.data}
            tabIndex={0}
            role="button"
            aria-pressed={ativo}
            aria-label={`${d.diaSemana} ${dataCurta(d.data)}: ${d.recomendado} funcionários, de ${d.de} a ${d.ate}. ${ORIGEM[d.origem].rotulo}.`}
            onClick={() => aoEscolher(d.data)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                aoEscolher(d.data);
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[var(--ring)] [&:focus-visible>rect:first-child]:stroke-2"
          >
            <rect x={x - 3} y={TOPO - 4} width={w + 6} height={util + BASE - 6} rx="8" fill={ativo ? "var(--brand)" : "transparent"} opacity={ativo ? 0.08 : 1} stroke="transparent" />
            {novaSemana && <line x1={ESQ + i * col} x2={ESQ + i * col} y1={TOPO} y2={ALTURA - BASE + 4} stroke="var(--border)" strokeDasharray="2 4" />}
            {/* faixa do histórico: do 25º ao 75º percentil (ou da agenda) */}
            <rect x={x + w * 0.2} y={y(d.ate)} width={w * 0.6} height={Math.max(2, y(d.de) - y(d.ate))} rx="3" fill="var(--brand)" opacity="0.14" />
            <rect
              x={x}
              y={y(d.recomendado)}
              width={w}
              height={Math.max(2, TOPO + util - y(d.recomendado))}
              rx="5"
              fill="var(--brand)"
              opacity={d.origem === "estimado" ? 0.38 : d.origem === "parcial" ? 0.68 : 1}
              stroke={d.origem === "estimado" ? "var(--brand)" : "none"}
              strokeDasharray={d.origem === "estimado" ? "4 3" : undefined}
            />
            {(col >= 44 || d.recomendado === Math.max(...dias.map((x) => x.recomendado))) && (
              <text x={x + w / 2} y={y(d.recomendado) - 5} textAnchor="middle" fontSize={col >= 44 ? 12 : 10} fontWeight="600" fill="var(--foreground)">{d.recomendado}</text>
            )}
            <text x={x + w / 2} y={ALTURA - BASE + 18} textAnchor="middle" fontSize={col >= 44 ? 12 : 10} fontWeight={ativo ? 700 : 400} fill="var(--foreground)">{Number(d.data.slice(8))}</text>
            <text x={x + w / 2} y={ALTURA - BASE + 32} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{col >= 44 ? d.diaSemana : d.diaSemana[0]}</text>
          </g>
        );
      })}
      {escala !== null && (
        <g>
          <line x1={ESQ} x2={largura - DIR + 8} y1={y(escala)} y2={y(escala)} stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={largura - DIR + 12} y={y(escala) - 2} fontSize="11" fontWeight="600" fill="var(--foreground)">escala de hoje</text>
          <text x={largura - DIR + 12} y={y(escala) + 12} fontSize="11" fontWeight="600" fill="var(--foreground)">{String(escala).replace(".", ",")} funcionários</text>
        </g>
      )}
    </svg>
  );
}

function Indicador({ icone: Icone, valor, rotulo, detalhe, destaque }: { icone: typeof Users; valor: string; rotulo: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-3.5 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand")}>
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <p className="min-w-0">
        <span className={cn("block text-2xl leading-none font-semibold tabular-nums", destaque ? "text-success" : "text-brand")}>{valor}</span>
        <span className="mt-1 block text-sm text-foreground">{rotulo}</span>
        <span className="block text-xs text-muted-foreground">{detalhe}</span>
      </p>
    </div>
  );
}

/** Projeção das próximas semanas: chapas por dia, custo de pessoal e quanto a escala de hoje se afasta disso. */
export function ProjecaoChapas({ projecao }: { projecao: Projecao }) {
  const [semanas, setSemanas] = useState<number>(4);
  const resumo = projecao.resumos.find((r) => r.semanas === semanas) ?? projecao.resumos[0];
  const dias = projecao.dias.slice(0, resumo.uteis);
  const [escolhido, setEscolhido] = useState(projecao.dias[0].data);
  const dia = dias.find((d) => d.data === escolhido) ?? dias[0];
  const escala = resumo.escalaAtual === null ? null : Number(resumo.escalaAtual.replace(",", "."));
  const diferenca = escala === null ? null : dia.recomendado - escala;
  const estacao = projecao.estacao === "safra" ? "safra" : "entressafra";

  return (
    <section aria-labelledby="projecao" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="projecao" className="text-h2 text-brand">Quanto vamos precisar e quanto vai custar</h2>
          <p className="text-sm text-muted-foreground">
            Funcionários por dia nas próximas semanas: a agenda onde ela está completa e a média do histórico da {estacao} onde não está.
          </p>
        </div>
        <div role="radiogroup" aria-label="Horizonte da projeção" className="inline-flex rounded-xl border bg-muted p-1">
          {projecao.resumos.map((r) => (
            <button
              key={r.semanas}
              type="button"
              role="radio"
              aria-checked={r.semanas === semanas}
              onClick={() => setSemanas(r.semanas)}
              className={cn(
                "h-9 cursor-pointer rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                r.semanas === semanas ? "bg-card text-brand shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.semanas} semanas
            </button>
          ))}
        </div>
      </div>

      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-card sm:grid-cols-2 lg:grid-cols-5">
        <Indicador icone={Users} valor={resumo.chapasPorDia} rotulo="funcionários por dia, em média" detalhe={`faixa de ${resumo.de} a ${resumo.ate}`} />
        <Indicador icone={Wallet} valor={resumo.custoRecomendado} rotulo="custo mínimo de pessoal" detalhe={`${resumo.uteis} dias úteis × diária de R$ ${projecao.piso.slice(0, 5).replace(".", ",")}`} />
        <Indicador icone={TrendingUp} valor={resumo.pico ? `${resumo.pico.chapas} ${resumo.pico.chapas === 1 ? "funcionário" : "funcionários"}` : "-"} rotulo="no dia de maior necessidade" detalhe={resumo.pico ? `${dataCurta(resumo.pico.data)}, ${dias.find((d) => d.data === resumo.pico!.data)?.diaSemana ?? ""}` : ""} />
        <Indicador
          icone={UserPlus}
          valor={resumo.escalaAtual === null ? "-" : `${resumo.diasDeReforco} de ${resumo.uteis}`}
          rotulo="dias pedem reforço"
          detalhe={resumo.reforcoMedio ? `em média ${resumo.reforcoMedio} funcionários acima da escala de hoje` : "a escala de hoje cobre"}
        />
        <Indicador
          icone={PiggyBank}
          valor={resumo.economia ?? "-"}
          rotulo="de economia possível"
          detalhe={`ajustando a escala dia a dia${resumo.diasDeSobra > 0 ? `, em ${resumo.diasDeSobra} dias com sobra` : ""}`}
          destaque
        />
      </div>

      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-h3 text-brand">Funcionários recomendados por dia</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-brand" /> Pela agenda</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-brand/70" /> Agenda + histórico</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-dashed border-brand bg-brand/35" /> Média do histórico</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-2 rounded-sm bg-brand/15" /> Faixa provável</li>
          </ul>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:p-0">
          <div className="min-w-[860px] sm:min-w-0">
            <GraficoDias dias={dias} escala={escala} escolhido={dia.data} aoEscolher={setEscolhido} />
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center" aria-live="polite">
          <p className="text-xl font-semibold">
            {dia.diaSemana} <span className="tabular-nums">{dataCurta(dia.data)}</span>
          </p>
          <p className="text-sm">
            <Badge variant={ORIGEM[dia.origem].variante}>{ORIGEM[dia.origem].rotulo}</Badge>{" "}
            <span className="tabular-nums">{dia.cargas}</span> {ORIGEM[dia.origem].detalhe}. Peça <strong className="tabular-nums">{dia.recomendado} {dia.recomendado === 1 ? "funcionário" : "funcionários"}</strong>
            {dia.de !== dia.ate && <> (faixa provável de {dia.de} a {dia.ate})</>}
            {diferenca !== null && diferenca !== 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {diferenca > 0 ? `${String(Math.round(diferenca * 10) / 10).replace(".", ",")} a mais` : `${String(Math.round(-diferenca * 10) / 10).replace(".", ",")} a menos`} que a escala de hoje
              </span>
            )}
            .
          </p>
          <p className="text-right sm:text-left">
            <span className="block text-xl font-semibold tabular-nums text-brand">{dia.custo}</span>
            <span className="text-xs text-muted-foreground">custo mínimo do dia</span>
          </p>
        </div>
      </Card>

      <Card className="gap-3 p-5">
        <h3 className="text-h3 text-brand">Semana a semana</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead className="text-right">Dias pela agenda</TableHead>
              <TableHead className="text-right">Funcionários por dia</TableHead>
              <TableHead className="text-right">Custo mínimo</TableHead>
              <TableHead className="text-right">Economia possível</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumo.semanasDetalhe.map((s) => (
              <TableRow key={s.inicio}>
                <TableCell className="whitespace-nowrap font-medium tabular-nums">{dataCurta(s.inicio)} a {dataCurta(s.fim)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.agendados} de {s.dias}</TableCell>
                <TableCell className="text-right tabular-nums">{s.chapasPorDia}</TableCell>
                <TableCell className="text-right tabular-nums">{s.custo}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{s.economia ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

    </section>
  );
}
