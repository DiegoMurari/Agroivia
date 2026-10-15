/**
 * A5: roda as consultas no s3.db e confere 3 dias à mão, por um caminho independente (direto de hist_movimentacao).
 * Só leitura. Rode: npm run run:s3 -- lib/painel/conferir-consultas.ts
 */
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { dec, deInteiro, dividir, formatNumero, multiplicar, somar, subtrair, ZERO } from "@/lib/money";
import { demandaPorArmazem, lerParametros, resumoBoletins, resumoHistorico, serieHistorica, type Filtro } from "./consultas";

const db = getDb();
const p = lerParametros(db);
const f = (v: Parameters<typeof formatNumero>[0], c = 2) => formatNumero(v, c);

function mostrar(titulo: string, filtro: Filtro) {
  const r = resumoHistorico(db, filtro);
  console.log(`\n== ${titulo} (${r.rotulo}) | origem ${r.origem}`);
  console.log(`   meses: ${r.meses.map((m) => `${m.anoMes}:${m.status}`).join(" ")}`);
  if (!r.resumo) return console.log("   sem dado");
  const s = r.resumo;
  console.log(
    `   dias comparados ${s.diasConsiderados} (excesso ${s.diasExcesso}, falta ${s.diasFalta}, equilíbrio ${s.diasEquilibrio}); sem recebimento ${s.semProducao}; inconsistentes ${s.inconsistentes}`,
  );
  console.log(`   efetivo médio ${f(s.efetivoMedio)} | diárias justificadas médias ${f(dividir(s.producaoTotal, multiplicar(p.piso, deInteiro(s.diasConsiderados))))}`);
  console.log(`   excesso médio ${f(s.excessoMedioChapas)} chapas/dia (R$ ${f(s.excessoReaisMedio)}/dia) | falta média ${f(s.faltaMediaChapas)} chapas/dia (R$ ${f(s.faltaReaisMedia)}/dia)`);
  console.log(`   pico (${s.pico.dias} dias): falta média ${f(s.pico.faltaMediaChapas)}, excesso médio ${f(s.pico.excessoMedioChapas)}`);
}

mostrar("Tudo", { tipo: "tudo" });
mostrar("Safra", { tipo: "safra" });
mostrar("Entressafra", { tipo: "entressafra" });
mostrar("Mês 2025-11", { tipo: "mes", anoMes: "2025-11" });
mostrar("Mês 2025-12 (sem dado)", { tipo: "mes", anoMes: "2025-12" });
mostrar("Semana de 2025-11-17", { tipo: "semana", inicio: "2025-11-17" });

const d = demandaPorArmazem(db, { tipo: "safra" });
console.log("\nDemanda por armazém na safra (rateio é premissa):");
for (const a of d?.armazens ?? [])
  console.log(
    a.fazBoletim
      ? `   ${a.nome}: ${f(a.diariasPorDia)} diárias/dia, ${f(a.participacao!.times(100), 1)}% da demanda, efetivo rateado ${f(a.efetivoRateado!)}`
      : `   ${a.nome}: ${f(a.diariasPorDia)} diárias/dia (sem boletim: fora da comparação com a folha)`,
  );

console.log("\nBoletins novos:", resumoBoletins(db, { tipo: "tudo" }).length, "combinações armazém x origem");

// Conferência à mão de 3 dias: recalcula a partir das linhas de hist_movimentacao, sem passar pelas cargas.
const serie = serieHistorica(db);
const candidatos = serie.dias.filter((x) => x.producao !== null && x.efetivo !== null);
const escolhidos = [candidatos[10], candidatos[Math.floor(candidatos.length / 2)], candidatos.find((x) => x.data === "2025-11-17") ?? candidatos.at(-5)!];
for (const dia of escolhidos) {
  const linhas = db
    .select()
    .from(schema.histMovimentacao)
    .where(and(eq(schema.histMovimentacao.dataRecebimento, dia.data), eq(schema.histMovimentacao.considerada, true)))
    .all();
  const comBoletim = new Set(db.select().from(schema.armazem).all().filter((a) => a.fazBoletim).map((a) => a.id));
  const aMao = somar(...linhas.filter((l) => l.armazemId !== null && comBoletim.has(l.armazemId)).map((l) => (l.extra ? ((JSON.parse(l.extra) as { producaoEstimada: string | null }).producaoEstimada ?? ZERO) : ZERO)));
  const folha = db.select().from(schema.histChapasDia).where(eq(schema.histChapasDia.data, dia.data)).get()!;
  const efetivo = deInteiro((folha.presentes ?? 0) - (folha.cafe ?? 0));
  const saldo = subtrair(efetivo, dividir(aMao, p.piso));
  const confere = aMao.eq(dec(dia.producao!));
  console.log(
    `\nDia ${dia.data}: folha ${folha.presentes} presentes, ${folha.cafe} café => efetivo ${efetivo}; ${linhas.length} linhas de recebimento; produção estimada à mão ${f(aMao, 4)} | consulta ${f(dia.producao!, 4)} | ${confere ? "CONFERE" : "DIVERGE"}; saldo ${f(saldo)} (${saldo.gt(0) ? "excesso" : "falta"})`,
  );
}
