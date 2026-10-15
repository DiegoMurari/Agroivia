/** A1: cabeçalhos, tipos e amostra de cada planilha do pacote. Só leitura. */
import ExcelJS from "exceljs";
import path from "node:path";

const pacote = process.env.PACOTE_DIR;
if (!pacote) throw new Error("PACOTE_DIR ausente no .env");

function valor(v: unknown): unknown {
  if (v && typeof v === "object" && "result" in (v as object)) return (v as { result: unknown }).result;
  if (v && typeof v === "object" && "richText" in (v as object)) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  return v;
}

async function ver(rel: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(pacote!, rel));
  console.log(`\n=== ${rel} ===`);
  for (const ws of wb.worksheets) {
    console.log(`aba "${ws.name}": ${ws.rowCount} linhas x ${ws.columnCount} colunas`);
    for (let r = 1; r <= Math.min(4, ws.rowCount); r++) {
      const vals = (ws.getRow(r).values as unknown[]).slice(1).map((v) => {
        const x = valor(v);
        return x instanceof Date ? `Date(${x.toISOString()})` : `${typeof x}:${String(x)}`;
      });
      console.log(`  L${r}: ${vals.join(" | ")}`);
    }
  }
}

for (const rel of process.argv.slice(2)) await ver(rel);
