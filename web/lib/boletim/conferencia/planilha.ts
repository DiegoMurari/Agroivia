/**
 * B1: reconferência da planilha do boletim. Só lê e imprime; não grava em banco nem em arquivo.
 * Rodar: npm run run:s2 -- lib/boletim/conferencia/planilha.ts
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { dec, dividir, igual, menorQue, multiplicar, somar, subtrair, paraTexto, paraTextoCasas } from "@/lib/money";

const pacote = process.env.PACOTE_DIR;
if (!pacote) {
  console.error("PACOTE_DIR não está definido em web/.env. Defina o caminho do pacote de dados e rode de novo.");
  process.exit(1);
}
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.resolve(pacote, "05_operacao", "boletim_diario_chapas.xlsx"));
const aba = wb.worksheets[0];

const formula = (end: string): string => {
  const v = aba.getCell(end).value as { formula?: string } | null;
  return v && typeof v === "object" && v.formula ? v.formula.replace(/\s/g, "") : "";
};
const numero = (end: string) => {
  const v = aba.getCell(end).value;
  return v === null || v === undefined || v === "" ? null : dec(String(v));
};

let falhas = 0;
const marca = (nome: string, ok: boolean, detalhe = "") => {
  if (!ok) falhas++;
  console.log(`${ok ? "bateu    " : "NÃO BATEU"} | ${nome}${detalhe ? " | " + detalhe : ""}`);
};

// Fórmulas
const linhasItem = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
marca("G = SOMA(C:F) em todas as 16 linhas", linhasItem.every((l) => formula(`G${l}`) === `SUM(C${l}:F${l})`), formula("G10"));
marca("I = G * H em todas as 16 linhas", linhasItem.every((l) => formula(`I${l}`) === `G${l}*H${l}`), formula("I10"));
marca("I42 = SOMA(I10:I41)", formula("I42") === "SUM(I10:I41)", formula("I42"));
marca("C62 = D61 - J60 - K60 (funcionários menos 0,5 por MEIA)", formula("C62") === "D61-J60-K60", formula("C62"));
marca("J47 = SE(D47=\"MEIA\";0,5)", formula("J47") === 'IF(D47="MEIA",0.5,"")', formula("J47"));
marca("J64 = I42 / C62", formula("J64") === "I42/C62", formula("J64"));
marca("J65 = SE(J64 < H38; H38; J64) * C62", formula("J65") === "IF(J64<H38,H38,J64)*C62", formula("J65"));
marca("J66 = J65 - I42", formula("J66") === "J65-I42", formula("J66"));
let arred = false;
aba.eachRow((l) => l.eachCell((c) => { const v = c.value as { formula?: string } | null; if (v && typeof v === "object" && v.formula && /ROUND|TRUNC|INT\(|CEILING|FLOOR/i.test(v.formula)) arred = true; }));
marca("nenhuma função de arredondamento na aba", !arred);

// Preços (PRD)
const precos: Record<number, string> = { 10: "0.1824", 12: "0.2635", 14: "0.3224", 16: "1.1780", 18: "2.3561", 20: "0.3387", 22: "0.3224", 24: "0.3224", 26: "0.3224", 28: "0.3224", 30: "0.3387", 32: "0.3387", 34: "0.3224", 36: "0.3224", 38: "90.1731", 40: "45.0786" };
for (const l of linhasItem) {
  const p = numero(`H${l}`);
  marca(`preço linha ${l} (${String(aba.getCell(`A${l}`).value).trim()})`, p !== null && igual(p, precos[l]), p ? paraTexto(p) : "vazio");
}

// Exemplo de 17/11/2025
const data = aba.getCell("I5").value;
marca("data do exemplo = 17/11/2025", data instanceof Date && data.toISOString().slice(0, 10) === "2025-11-17", String(data));
const q = (l: number) => ({ desc: numero(`C${l}`) ?? dec("0"), rem: numero(`D${l}`) ?? dec("0"), tr: numero(`F${l}`) ?? dec("0") });
marca("Fertilizantes 2.378 descarga + 400 remoção", igual(q(26).desc, "2378") && igual(q(26).rem, "400"));
marca("Agroquímico 30 descarga", igual(q(24).desc, "30"));
marca("Serviços diversos 40 remoção", igual(q(36).rem, "40"));
const matriculas = [...Array(10).keys()].map((i) => String(aba.getCell(`C${47 + i}`).value)).concat(String(aba.getCell("H47").value));
marca("11 funcionários, matrículas 158 137 35 155 161 15 69 13 75 74 79", matriculas.join(" ") === "158 137 35 155 161 15 69 13 75 74 79", matriculas.join(" "));
const nomes = new Map<string, string>();
for (let l = 3; l <= 303; l++) { const m = aba.getCell(`N${l}`).value; const n = aba.getCell(`O${l}`).value; if (m != null && n != null) nomes.set(String(m), String(n)); }
console.log("nomes:", matriculas.map((m) => `${m}=${nomes.get(m) ?? "?"}`).join(", "));

// Recalcula com decimal.js
const producao = somar(...linhasItem.map((l) => { const x = q(l); return multiplicar(somar(x.desc, x.rem, x.tr), precos[l]); }));
const piso = "90.1731";
const calc = (diarias: string) => {
  const vd = dividir(producao, diarias);
  const total = menorQue(vd, piso) ? multiplicar(piso, diarias) : producao;
  return { vd: paraTextoCasas(vd, 10), total: paraTexto(total), compl: paraTexto(subtrair(total, producao)) };
};
console.log("produção:", paraTexto(producao), "| 11 diárias:", calc("11"), "| 10,5 diárias:", calc("10.5"));
marca("produção do exemplo = 918,1952", igual(producao, "918.1952"));
marca("11 diárias: total 991,9041 e complemento 73,7089", igual(calc("11").total, "991.9041") && igual(calc("11").compl, "73.7089"));
marca("10,5 diárias: total 946,81755 e complemento 28,62235", igual(calc("10.5").total, "946.81755") && igual(calc("10.5").compl, "28.62235"));

console.log(falhas === 0 ? "\nTudo bateu." : `\n${falhas} item(ns) NÃO bateram.`);
