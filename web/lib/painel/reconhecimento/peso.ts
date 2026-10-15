/** A1: o que significa `Peso` na movimentação? Só leitura. Imprime agregados e algumas linhas de itens (sem dado pessoal). */
import ExcelJS from "exceljs";
import path from "node:path";

const pacote = process.env.PACOTE_DIR!;
const val = (v: unknown): unknown => (v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v);
const iso = (d: Date) => d.toISOString().slice(0, 10);
async function ler(rel: string): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(pacote, rel));
  const out: unknown[][] = [];
  wb.worksheets[0].eachRow({ includeEmpty: false }, (r) => out.push((r.values as unknown[]).slice(1).map(val)));
  return out;
}
const n = (v: unknown) => (typeof v === "number" ? v : Number(v));

const dados = (await ler("03_movimentacao/pedido_recebimento_notafiscal.xlsx")).slice(1);
const prod = (await ler("02_cadastros/produtos.xlsx")).slice(1);
const pItem = new Map<string, unknown[]>();
for (const l of prod) if (!pItem.has(String(l[0]).trim())) pItem.set(String(l[0]).trim(), l);

const prefixoOk = prod.filter((l) => String(l[0]).trim().slice(0, 3) === String(l[5]).trim()).length;
console.log(`Cadastro: prefixo do código = grupo em ${prefixoOk} de ${prod.length} linhas`);
const semCad: Record<string, number> = {};
for (const l of dados) if (!pItem.has(String(l[5]).trim())) { const p = String(l[5]).trim().slice(0, 3); semCad[p] = (semCad[p] ?? 0) + 1; }
console.log("linhas cujo item não está no cadastro, por prefixo:", JSON.stringify(semCad));
const formato: Record<string, number> = {};
for (const l of dados) { const f = String(l[5]).replace(/\d/g, "9"); formato[f] = (formato[f] ?? 0) + 1; }
console.log("formatos de código de item:", JSON.stringify(formato));

const porChave = new Map<string, unknown[][]>();
for (const l of dados) { const c = l[13]; if (!c) continue; const k = String(c); (porChave.get(k) ?? porChave.set(k, []).get(k)!).push(l); }
let multi = 0, todasIguais = 0;
for (const ls of porChave.values()) {
  if (ls.length < 2) continue;
  multi++;
  if (new Set(ls.map((l) => n(l[8]))).size === 1) todasIguais++;
}
console.log(`\nNF (chave) com 2+ linhas: ${multi}; com Peso idêntico em todas as linhas: ${todasIguais} (${((todasIguais / multi) * 100).toFixed(1)}%)`);
const porPedidoNf = new Map<string, unknown[][]>();
for (const l of dados) { const k = `${l[0]}|${l[12]}`; (porPedidoNf.get(k) ?? porPedidoNf.set(k, []).get(k)!).push(l); }
let m2 = 0, i2 = 0;
for (const ls of porPedidoNf.values()) if (ls.length > 1) { m2++; if (new Set(ls.map((l) => n(l[8]))).size === 1) i2++; }
console.log(`(pedido, NF) com 2+ linhas: ${m2}; Peso idêntico em todas: ${i2} (${((i2 / m2) * 100).toFixed(1)}%)`);

const ton: number[] = [];
for (const l of dados) { const it = pItem.get(String(l[5]).trim()); if (it && String(it[2]).trim().toUpperCase() === "TON" && n(l[7]) > 0) ton.push(n(l[8]) / n(l[7])); }
ton.sort((a, b) => a - b);
const q = (a: number[], p: number) => a[Math.floor(p * (a.length - 1))];
console.log(`\nTON: peso/qtd n=${ton.length}; p5=${q(ton, 0.05)}, p25=${q(ton, 0.25)}, mediana=${q(ton, 0.5)}, p75=${q(ton, 0.75)}, p95=${q(ton, 0.95)}, máx=${ton.at(-1)}`);
const faixa: Record<string, number> = {};
for (const x of ton) { const k = x === 0 ? "0" : x < 100 ? "<100" : x < 900 ? "100-900" : x <= 1100 ? "900-1100 (≈1000 kg/t)" : x <= 2000 ? "1100-2000" : ">2000"; faixa[k] = (faixa[k] ?? 0) + 1; }
console.log("faixas de kg por TON:", JSON.stringify(faixa));

const ferUn: Record<string, number[]> = {};
for (const l of dados) { const it = pItem.get(String(l[5]).trim()); const g = it ? String(it[5]).trim() : String(l[5]).slice(0, 3); if (g !== "FER") continue; const u = it ? String(it[2]).trim() : "?"; (ferUn[u] ??= []).push(n(l[8]) / n(l[7])); }
for (const [u, a] of Object.entries(ferUn)) { a.sort((x, y) => x - y); console.log(`FER unidade ${u}: n=${a.length}, kg/unid mediana=${q(a, 0.5)}, p5=${q(a, 0.05)}, p95=${q(a, 0.95)}`); }

const top = [...dados].sort((a, b) => n(b[8]) - n(a[8])).slice(0, 8);
console.log("\nmaiores pesos [data, item, desc, qtd, peso, depósito]:");
for (const l of top) console.log("  ", iso(l[11] as Date), l[5], String(l[6]).slice(0, 30), l[7], l[8], l[9]);

const z: Record<string, number> = {};
for (const l of dados) if (n(l[8]) === 0) { const p = String(l[5]).slice(0, 3); z[p] = (z[p] ?? 0) + 1; }
console.log("\npeso zero por prefixo:", JSON.stringify(z));

console.log("\n17/11/2025 grupo FER:");
for (const l of dados) if (l[11] instanceof Date && iso(l[11]) === "2025-11-17" && String(l[5]).startsWith("FER")) console.log("  ", l[0], l[3], l[5], String(l[6]).slice(0, 28), "qtd", l[7], "peso", l[8], l[9], "NF", l[12], "rec", l[10], "lanç", iso(l[1] as Date));
