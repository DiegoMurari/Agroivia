/** A1: reconhecimento da movimentação (41.779 linhas), cruzada com produtos e fornecedores. Só leitura. */
import ExcelJS from "exceljs";
import path from "node:path";

const pacote = process.env.PACOTE_DIR!;
type Cel = unknown;
const val = (v: Cel): unknown => (v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v);
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function ler(rel: string): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(pacote, rel));
  const ws = wb.worksheets[0];
  const linhas: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => linhas.push((row.values as unknown[]).slice(1).map(val)));
  return linhas;
}
const tipo = (v: unknown) => (v === null || v === undefined || v === "" ? "nulo" : v instanceof Date ? "data" : typeof v);
const num = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v.replace(",", ".")))) return Number(v.replace(",", "."));
  return null;
};

const mov = await ler("03_movimentacao/pedido_recebimento_notafiscal.xlsx");
const cab = mov[0] as string[];
const dados = mov.slice(1);
console.log(`Movimentação: ${dados.length} linhas de dados, colunas: ${cab.join(" | ")}`);

console.log("\n-- tipos por coluna (contagem) --");
cab.forEach((c, i) => {
  const t: Record<string, number> = {};
  for (const l of dados) t[tipo(l[i])] = (t[tipo(l[i])] ?? 0) + 1;
  console.log(`  ${c}: ${JSON.stringify(t)}`);
});

const colData = [1, 2, 11];
for (const i of colData) {
  const ds = dados.map((l) => l[i]).filter((v): v is Date => v instanceof Date).sort((a, b) => a.getTime() - b.getTime());
  console.log(`\n${cab[i]}: ${ds.length} datas, de ${ds[0] && iso(ds[0])} a ${ds.at(-1) && iso(ds.at(-1)!)}`);
  const naoMeia = ds.filter((d) => d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0).length;
  console.log(`  com hora diferente de 00:00 UTC: ${naoMeia}`);
}
const porAno: Record<string, number> = {};
const fimSem: Record<string, number> = {};
for (const l of dados) {
  const d = l[11];
  if (d instanceof Date) {
    porAno[d.getUTCFullYear()] = (porAno[d.getUTCFullYear()] ?? 0) + 1;
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) fimSem[dow === 0 ? "domingo" : "sabado"] = (fimSem[dow === 0 ? "domingo" : "sabado"] ?? 0) + 1;
  }
}
console.log("linhas por ano de recebimento:", JSON.stringify(porAno));
console.log("linhas com recebimento em fim de semana:", JSON.stringify(fimSem));
const semRec = dados.filter((l) => !(l[11] instanceof Date));
console.log("sem data de recebimento:", semRec.length, "amostra:", JSON.stringify(semRec.slice(0, 3)));
const antes = dados.filter((l) => l[11] instanceof Date && l[1] instanceof Date && (l[11] as Date) < (l[1] as Date)).length;
console.log("recebimento anterior ao lançamento:", antes);

const chaveLinha = new Map<string, number>();
for (const l of dados) {
  const k = JSON.stringify(l);
  chaveLinha.set(k, (chaveLinha.get(k) ?? 0) + 1);
}
console.log("\nlinhas inteiras duplicadas (extras além da 1ª):", [...chaveLinha.values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0));
const chaveNat = new Map<string, number>();
for (const l of dados) {
  const k = `${l[0]}|${l[5]}|${l[10]}|${l[13]}|${l[9]}`;
  chaveNat.set(k, (chaveNat.get(k) ?? 0) + 1);
}
console.log("chave (pedido, item, recebimento, chave, depósito) repetida (extras):", [...chaveNat.values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0));
const pedidos = new Set(dados.map((l) => l[0]));
console.log("pedidos distintos:", pedidos.size);

let qtdNeg = 0, qtdZero = 0, qtdNaoNum = 0, pesoNeg = 0, pesoZero = 0, pesoNaoNum = 0, qtdFrac = 0;
for (const l of dados) {
  const q = num(l[7]); const p = num(l[8]);
  if (q === null) qtdNaoNum++; else { if (q < 0) qtdNeg++; if (q === 0) qtdZero++; if (!Number.isInteger(q)) qtdFrac++; }
  if (p === null) pesoNaoNum++; else { if (p < 0) pesoNeg++; if (p === 0) pesoZero++; }
}
console.log(`\nQtd: negativa ${qtdNeg}, zero ${qtdZero}, não numérica ${qtdNaoNum}, fracionária ${qtdFrac}`);
console.log(`Peso: negativo ${pesoNeg}, zero ${pesoZero}, não numérico ${pesoNaoNum}`);

let chaveVazia = 0, chaveTam = 0, chaveNaoDigito = 0, nfDiverge = 0;
const chavesDist = new Set<string>();
for (const l of dados) {
  const c = l[13];
  if (c === null || c === undefined || c === "") { chaveVazia++; continue; }
  const s = String(c).trim();
  chavesDist.add(s);
  if (!/^\d+$/.test(s)) chaveNaoDigito++;
  if (s.length !== 44) chaveTam++;
  else if (num(l[12]) !== null && Number(s.slice(25, 34)) !== num(l[12])) nfDiverge++;
}
console.log(`\nChave: vazia ${chaveVazia}, tamanho != 44: ${chaveTam}, não só dígitos ${chaveNaoDigito}, nº NF diverge do trecho da chave ${nfDiverge}, distintas ${chavesDist.size}`);

const prod = (await ler("02_cadastros/produtos.xlsx")).slice(1);
const forn = (await ler("02_cadastros/fornecedores.xlsx")).slice(1).filter((l) => l[0]);
console.log(`\nProdutos: ${prod.length} linhas; fornecedores: ${forn.length} linhas`);
const pItem = new Map<string, unknown[][]>();
for (const l of prod) { const k = String(l[0]).trim(); (pItem.get(k) ?? pItem.set(k, []).get(k)!).push(l); }
console.log("itens distintos no cadastro:", pItem.size, "| unidades:", JSON.stringify([...new Set(prod.map((l) => l[2]))].slice(0, 40)));
console.log("grupos:", JSON.stringify(Object.entries(prod.reduce((a: Record<string, number>, l) => { const g = String(l[5]).trim(); a[g] = (a[g] ?? 0) + 1; return a; }, {}))));
console.log("depósitos:", JSON.stringify(Object.entries(prod.reduce((a: Record<string, number>, l) => { const g = String(l[7]).trim(); a[g] = (a[g] ?? 0) + 1; return a; }, {}))));
console.log("produtos com Peso nulo/zero:", prod.filter((l) => !num(l[3])).length);
const fCod = new Map(forn.map((l) => [String(l[0]).trim(), l]));
const cnpjDup = new Map<string, number>();
for (const l of forn) { const c = String(l[2] ?? "").replace(/\D/g, ""); cnpjDup.set(c, (cnpjDup.get(c) ?? 0) + 1); }
console.log("fornecedores: CNPJ vazio", forn.filter((l) => !String(l[2] ?? "").replace(/\D/g, "")).length, "| CNPJ com pontuação", forn.filter((l) => /\D/.test(String(l[2] ?? ""))).length, "| CNPJ repetido (extras)", [...cnpjDup.entries()].filter(([c, n]) => c && n > 1).reduce((s, [, n]) => s + n - 1, 0));

let semForn = 0, semItem = 0, semPar = 0;
const grupoDeposito: Record<string, number> = {};
const itensSemItem = new Set<string>();
for (const l of dados) {
  if (!fCod.has(String(l[3]).trim())) semForn++;
  const it = pItem.get(String(l[5]).trim());
  if (!it) { semItem++; itensSemItem.add(String(l[5])); continue; }
  if (!it.some((p) => String(p[7]).trim() === String(l[9]).trim())) semPar++;
  const g = String(it[0][5]).trim() + "/" + String(l[9]).trim();
  grupoDeposito[g] = (grupoDeposito[g] ?? 0) + 1;
}
console.log(`\nCod PN fora do cadastro de fornecedores: ${semForn}; Cod Item fora do cadastro: ${semItem} (${itensSemItem.size} itens); par (item, depósito) fora do cadastro: ${semPar}`);
console.log("grupo/depósito (linhas):", JSON.stringify(grupoDeposito));
const depMov: Record<string, number> = {};
for (const l of dados) depMov[String(l[9])] = (depMov[String(l[9])] ?? 0) + 1;
console.log("depósitos na movimentação:", JSON.stringify(depMov));

const razoes: number[] = [];
const porUnid: Record<string, { n: number; ok: number; pesoNaoMul: number; unitario: number }> = {};
for (const l of dados) {
  const it = pItem.get(String(l[5]).trim()); if (!it) continue;
  const q = num(l[7]), p = num(l[8]), pu = num(it[0][3]); const u = String(it[0][2]).trim();
  const o = (porUnid[u] ??= { n: 0, ok: 0, pesoNaoMul: 0, unitario: 0 });
  o.n++;
  if (q && p && pu) {
    const r = p / (q * pu); razoes.push(r);
    if (Math.abs(r - 1) < 0.01) o.ok++; else if (Math.abs(p / pu - 1) < 0.01) o.unitario++; else o.pesoNaoMul++;
  }
}
razoes.sort((a, b) => a - b);
const pct = (q: number) => razoes[Math.floor(q * (razoes.length - 1))];
console.log(`\nPeso / (Qtd × peso unitário do cadastro): n=${razoes.length}; p5=${pct(0.05)}, p25=${pct(0.25)}, mediana=${pct(0.5)}, p75=${pct(0.75)}, p95=${pct(0.95)}`);
console.log("por unidade [unidade, n, peso≈qtd×unit, peso≈unit, outro]:", JSON.stringify(Object.entries(porUnid).map(([u, o]) => [u, o.n, o.ok, o.unitario, o.pesoNaoMul])));

const porDia = new Map<string, Set<string>>();
const pesoDia = new Map<string, number>();
for (const l of dados) {
  if (!(l[11] instanceof Date)) continue;
  const d = iso(l[11] as Date);
  (porDia.get(d) ?? porDia.set(d, new Set()).get(d)!).add(String(l[3]));
  pesoDia.set(d, (pesoDia.get(d) ?? 0) + (num(l[8]) ?? 0));
}
const dist = [...porDia.values()].map((s) => s.size).sort((a, b) => a - b);
console.log(`\nCaminhões/dia (fornecedor × data): ${dist.length} dias com recebimento; mediana ${dist[Math.floor(dist.length / 2)]}, p90 ${dist[Math.floor(dist.length * 0.9)]}, máx ${dist.at(-1)}`);
const porMes: Record<string, number[]> = {};
for (const [d, s] of porDia) (porMes[d.slice(0, 7)] ??= []).push(s.size);
const linhasMes = Object.entries(porMes).sort().filter(([m]) => m >= "2025-01").map(([m, a]) => `${m}: ${a.length}d média ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}`);
console.log("média de caminhões por dia com recebimento, 2025+:\n  " + linhasMes.join("\n  "));
const pesos = [...pesoDia.values()].sort((a, b) => a - b);
console.log(`Peso/dia (kg): mediana ${pesos[Math.floor(pesos.length / 2)]}, p99 ${pesos[Math.floor(pesos.length * 0.99)]}, máx ${pesos.at(-1)}`);
const maiores = dados.map((l) => ({ p: num(l[8]) ?? 0, l })).sort((a, b) => b.p - a.p).slice(0, 5);
console.log("5 maiores pesos de linha [peso, item, qtd]:", JSON.stringify(maiores.map((m) => [m.p, m.l[5], m.l[7]])));

const d1711 = dados.filter((l) => l[11] instanceof Date && iso(l[11] as Date) === "2025-11-17");
console.log(`\nRecebimentos em 2025-11-17: ${d1711.length} linhas`);
for (const l of d1711) {
  const it = pItem.get(String(l[5]).trim());
  console.log(`  ${l[3]} ${String(l[4]).slice(0, 22)} | ${l[5]} ${it ? it[0][5] : "?"} ${it ? it[0][2] : "?"} | qtd ${l[7]} peso ${l[8]} | ${l[9]}`);
}
