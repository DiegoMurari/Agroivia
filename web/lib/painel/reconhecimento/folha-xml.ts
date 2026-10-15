/** A1: reconhecimento da folha de chapas (CSV e xlsx em fluxo) e dos 460 XML de NF-e. Só leitura; imprime agregados. */
import ExcelJS from "exceljs";
import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import path from "node:path";

const pacote = process.env.PACOTE_DIR!;

// ---------- CSV ----------
const bruto = fs.readFileSync(path.join(pacote, "04_mao_de_obra/chapas_por_dia.csv"));
const temBom = bruto[0] === 0xef && bruto[1] === 0xbb;
const linhasCsv = bruto.toString("utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
console.log(`CSV: BOM=${temBom}, quebras CRLF=${bruto.toString("latin1").includes("\r\n")}, cabeçalho: ${linhasCsv[0]}`);
const csv = linhasCsv.slice(1).map((l) => l.split(","));
console.log(`CSV: ${csv.length} linhas; colunas por linha: ${JSON.stringify([...new Set(csv.map((c) => c.length))])}`);
const datas = csv.map((c) => c[0]);
console.log(`datas: ${datas[0]} a ${datas.at(-1)}; formato ISO em ${datas.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).length}; repetidas: ${datas.length - new Set(datas).size}; fora de ordem: ${datas.filter((d, i) => i > 0 && d < datas[i - 1]).length}`);
const dsem: Record<string, number> = {};
let semDiverge = 0;
const nomes = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
for (const c of csv) {
  dsem[c[1]] = (dsem[c[1]] ?? 0) + 1;
  const dow = new Date(c[0] + "T12:00:00Z").getUTCDay();
  if (nomes[dow] !== c[1]) semDiverge++;
}
console.log("dia_semana:", JSON.stringify(dsem), "| dia_semana diverge da data:", semDiverge);
const pres = csv.map((c) => Number(c[2]));
const cafe = csv.map((c) => Number(c[3]));
const vp = csv.map((c) => Number(c[4]));
console.log(`presentes: min ${Math.min(...pres)}, máx ${Math.max(...pres)}, não inteiros ${pres.filter((x) => !Number.isInteger(x)).length}, zero ${pres.filter((x) => x === 0).length}`);
console.log(`café: dias com café>0: ${cafe.filter((x) => x > 0).length}; café > presentes: ${csv.filter((_, i) => cafe[i] > pres[i]).length}; café == presentes: ${csv.filter((_, i) => cafe[i] === pres[i] && cafe[i] > 0).length}`);
console.log(`valor_pago: min ${Math.min(...vp)}, máx ${Math.max(...vp)}, nulo/NaN ${vp.filter((x) => isNaN(x)).length}`);
const vpp = csv.map((_, i) => vp[i] / pres[i]).sort((a, b) => a - b);
console.log(`valor pago por presente: p5 ${vpp[Math.floor(vpp.length * 0.05)].toFixed(2)}, mediana ${vpp[Math.floor(vpp.length / 2)].toFixed(2)}, p95 ${vpp[Math.floor(vpp.length * 0.95)].toFixed(2)}`);
const mes: Record<string, number[]> = {};
for (const c of csv) (mes[c[0].slice(0, 7)] ??= []).push(Number(c[2]) - Number(c[3]));
console.log("por mês [dias, média de efetivo (presentes - café)]:");
for (const [m, a] of Object.entries(mes).sort()) console.log(`  ${m}: ${a.length}d média ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}`);
const meses = new Set(Object.keys(mes));
const todos: string[] = [];
for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= 12; m++) todos.push(`${y}-${String(m).padStart(2, "0")}`);
console.log("meses de 2025-01 a 2026-12 sem nenhuma linha:", todos.filter((m) => !meses.has(m)).join(", "));
const c17 = csv.find((c) => c[0] === "2025-11-17");
console.log("2025-11-17:", c17?.join(","));
const intervalos: number[] = [];
for (let i = 1; i < datas.length; i++) intervalos.push((new Date(datas[i] + "T00:00:00Z").getTime() - new Date(datas[i - 1] + "T00:00:00Z").getTime()) / 864e5);
console.log("lacunas de mais de 4 dias entre linhas:", intervalos.map((x, i) => (x > 4 ? `${datas[i]}→${datas[i + 1]}(${x}d)` : "")).filter(Boolean).join(" "));

// ---------- xlsx da folha (fluxo) ----------
for (const ano of ["2025", "2026"]) {
  const arq = path.join(pacote, `04_mao_de_obra/chapas_por_dia_${ano}.xlsx`);
  console.log(`\nFolha ${ano}:`);
  let abas = 0;
  for await (const aba of new ExcelJS.stream.xlsx.WorkbookReader(arq, { sharedStrings: "cache", worksheets: "emit" })) {
    abas++;
    let linhas = 0, colunas = 0, primeira: unknown[] = [];
    for await (const linha of aba) {
      linhas++;
      const v = linha.values as unknown[];
      colunas = Math.max(colunas, v.length - 1);
      if (linhas === 1) primeira = v.slice(1, 8);
    }
    const nome = (aba as unknown as { name?: string }).name ?? `aba${abas}`;
    console.log(`  ${nome}: ${linhas} linhas, até ${colunas} colunas; 1ª linha: ${JSON.stringify(primeira).slice(0, 140)}`);
  }
}

// ---------- XML ----------
const dirXml = path.join(pacote, "01_notas_fiscais/xml");
const arqs = fs.readdirSync(dirXml).filter((f) => f.toLowerCase().endsWith(".xml"));
console.log(`\nXML: ${arqs.length} arquivos`);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, isArray: (n) => ["det", "vol"].includes(n) });
let semInf = 0, semVol = 0, volMulti = 0, semEsp = 0, semPeso = 0, semPlaca = 0, comXPed = 0, semTransp = 0;
const esp: Record<string, number> = {};
const chaves = new Map<string, number>();
const anos: Record<string, number> = {};
const emitentes = new Set<string>();
const cnpjs: string[] = [];
let itens = 0, cProdsNum = 0;
let primeiro: Record<string, unknown> | null = null;
for (const a of arqs) {
  const j = parser.parse(fs.readFileSync(path.join(dirXml, a), "utf8"));
  const nfe = j.nfeProc?.NFe ?? j.NFe;
  const inf = nfe?.infNFe;
  if (!inf) { semInf++; continue; }
  const chave = String(inf["@Id"] ?? "").replace(/^NFe/, "");
  chaves.set(chave, (chaves.get(chave) ?? 0) + 1);
  if (!/^\d{44}$/.test(chave)) console.log("  chave estranha:", a, chave);
  if (!a.startsWith(chave)) console.log("  nome do arquivo difere da chave:", a);
  const ano = String(inf.ide?.dhEmi ?? inf.ide?.dEmi ?? "").slice(0, 4);
  anos[ano] = (anos[ano] ?? 0) + 1;
  const emit = inf.emit; cnpjs.push(String(emit?.CNPJ ?? emit?.CPF ?? "")); emitentes.add(String(emit?.CNPJ ?? ""));
  const transp = inf.transp;
  if (!transp) semTransp++;
  const vols = transp?.vol ?? [];
  if (vols.length === 0) semVol++;
  if (vols.length > 1) volMulti++;
  for (const v of vols) { const e = String(v.esp ?? "(vazio)").trim().toUpperCase(); esp[e] = (esp[e] ?? 0) + 1; }
  if (!vols.some((v: Record<string, unknown>) => v.esp)) semEsp++;
  if (!vols.some((v: Record<string, unknown>) => v.pesoL || v.pesoB)) semPeso++;
  if (!transp?.veicTransp?.placa) semPlaca++;
  const dets = inf.det ?? [];
  itens += dets.length;
  if (dets.some((d: { prod: Record<string, unknown> }) => d.prod?.xPed)) comXPed++;
  cProdsNum += dets.filter((d: { prod: { cProd?: string } }) => /^[A-Z]{3}\d{6}$/.test(String(d.prod?.cProd))).length;
  if (!primeiro) primeiro = { emitCampos: Object.keys(emit ?? {}), ideCampos: Object.keys(inf.ide ?? {}), transpCampos: Object.keys(transp ?? {}), volCampos: Object.keys(vols[0] ?? {}), prodCampos: Object.keys(dets[0]?.prod ?? {}) };
}
console.log(`sem infNFe: ${semInf}; sem transp: ${semTransp}; sem vol: ${semVol}; vol múltiplo: ${volMulti}; sem esp: ${semEsp}; sem peso (pesoL/pesoB): ${semPeso}; sem placa: ${semPlaca}; com xPed em algum item: ${comXPed}`);
console.log("espécies (vol):", JSON.stringify(esp));
console.log("ano de emissão:", JSON.stringify(anos), "| itens (det):", itens, "| cProd no formato Agrovia (AAA999999):", cProdsNum);
console.log("chaves repetidas entre XML:", [...chaves.values()].filter((n) => n > 1).length, "| emitentes distintos:", emitentes.size);
console.log("campos do 1º XML:", JSON.stringify(primeiro));

// cruzamento com a movimentação e o cadastro de fornecedores
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.join(pacote, "03_movimentacao/pedido_recebimento_notafiscal.xlsx"));
const chavesMov = new Set<string>();
wb.worksheets[0].eachRow((r, i) => { if (i > 1) { const v = (r.values as unknown[])[14]; if (v) chavesMov.add(String(v).trim()); } });
let casam = 0;
for (const c of chaves.keys()) if (chavesMov.has(c)) casam++;
console.log(`XML cuja chave existe na movimentação: ${casam} de ${chaves.size}`);
const wf = new ExcelJS.Workbook();
await wf.xlsx.readFile(path.join(pacote, "02_cadastros/fornecedores.xlsx"));
const cnpjForn = new Set<string>();
wf.worksheets[0].eachRow((r, i) => { if (i > 1) { const v = (r.values as unknown[])[3]; if (v) cnpjForn.add(String(v).replace(/\D/g, "")); } });
console.log(`CNPJ do emitente no cadastro de fornecedores: ${cnpjs.filter((c) => cnpjForn.has(c)).length} de ${cnpjs.length}`);
