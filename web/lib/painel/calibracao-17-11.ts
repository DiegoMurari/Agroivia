/**
 * A5: calibração com o único boletim real (Adubo, 17/11/2025: 2.378 de fertilizante e 30 de agroquímico em descarga).
 * Cruza com os recebimentos do mesmo dia em `hist_movimentacao` e testa se peso / 50 kg fecha.
 * Só leitura. Rode: npm run run:s3 -- lib/painel/calibracao-17-11.ts
 */
import { getDb, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { dec, dividir, formatNumero, paraTexto, somar, subtrair, ZERO } from "@/lib/money";

const DIA = "2025-11-17";
const BOLETIM_FERTILIZANTE_DESCARGA = "2378";
const BOLETIM_AGROQUIMICO_DESCARGA = "30";

const db = getDb();
const linhas = db
  .select()
  .from(schema.histMovimentacao)
  .where(and(eq(schema.histMovimentacao.dataRecebimento, DIA), eq(schema.histMovimentacao.considerada, true)))
  .all();

console.log(`Recebimentos de ${DIA} (consideradas): ${linhas.length} linhas`);
const cadaGrupo = (g: string) => linhas.filter((l) => l.grupo === g);

for (const g of ["FER", "AGR"]) {
  console.log(`\nGrupo ${g}:`);
  for (const l of cadaGrupo(g)) {
    console.log(
      `  ${l.codItem} ${String(l.descItem).slice(0, 34).padEnd(34)} ${String(l.unidade).padEnd(4)} qtd ${String(l.qtd).padStart(6)} pesoNF ${String(l.peso).padStart(8)} pesoKg ${String(l.pesoKg).padStart(8)} dep ${l.deposito}`,
    );
  }
}

const fer = cadaGrupo("FER");
const sacas = (ls: typeof fer) => somar(...ls.map((l) => (l.pesoKg ? dividir(l.pesoKg, "50") : ZERO)));
const ehCorretivo = (d: string | null) => /CALC|GESSO|DOLOM/i.test(d ?? "");
const todas = sacas(fer);
const semCorretivo = sacas(fer.filter((l) => !ehCorretivo(l.descItem)));
const corretivo = sacas(fer.filter((l) => ehCorretivo(l.descItem)));
const alvo = dec(BOLETIM_FERTILIZANTE_DESCARGA);

function linha(nome: string, v: ReturnType<typeof dec>) {
  const diff = subtrair(v, alvo);
  const pct = dividir(diff.times(100), alvo);
  console.log(`  ${nome.padEnd(46)} ${formatNumero(v, 0).padStart(7)} sacas | diferença ${formatNumero(diff, 0).padStart(6)} (${formatNumero(pct, 1)}%)`);
}
console.log(`\nBoletim real (descarga): fertilizante ${BOLETIM_FERTILIZANTE_DESCARGA}, agroquímico ${BOLETIM_AGROQUIMICO_DESCARGA}; total do boletim 2.848 (com remoção 400 e serviços 40).`);
console.log("Fertilizante, peso ÷ 50 kg contra 2.378:");
linha("todas as linhas FER", todas);
linha("sem calcário, gesso e dolomita (corretivos)", semCorretivo);
linha("só os corretivos", corretivo);

const agr = cadaGrupo("AGR");
console.log(`\nAgroquímico (conversão unidade): recebimento ${paraTexto(somar(...agr.map((l) => l.qtd ?? "0")))} unidades contra ${BOLETIM_AGROQUIMICO_DESCARGA} no boletim.`);
console.log("\nTotal em unidades do boletim no dia (FER sem corretivos + AGR):", paraTexto(somar(semCorretivo, ...agr.map((l) => l.qtd ?? "0"))));

// Quanto pesam os corretivos no fertilizante do histórico inteiro?
const todasFer = db
  .select({ d: schema.histMovimentacao.descItem, p: schema.histMovimentacao.pesoKg })
  .from(schema.histMovimentacao)
  .where(and(eq(schema.histMovimentacao.grupo, "FER"), eq(schema.histMovimentacao.considerada, true)))
  .all();
const soma = (xs: typeof todasFer) => somar(...xs.map((x) => x.p ?? "0"));
const totalFer = soma(todasFer);
const totalCorr = soma(todasFer.filter((x) => ehCorretivo(x.d)));
console.log(
  `\nHistórico inteiro, peso conhecido de FER: ${formatNumero(dividir(totalFer, "1000"), 0)} t; corretivos: ${formatNumero(dividir(totalCorr, "1000"), 0)} t (${formatNumero(dividir(totalCorr.times(100), totalFer), 1)}%).`,
);
