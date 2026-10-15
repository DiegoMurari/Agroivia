/** Helpers do importador do histórico: datas, texto e dígitos. Puros, sem banco. */

function dataValida(a: number, m: number, d: number): string | null {
  if (a < 1900 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(a, m - 1, d));
  if (t.getUTCFullYear() !== a || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Converte serial do Excel, Date, texto `dd/mm/aaaa` ou ISO em `YYYY-MM-DD` (D35), sem erro de fuso.
 * Date vem do exceljs em UTC à meia-noite: usa os campos UTC. Devolve null se não for uma data real.
 */
export function paraDataISO(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return dataValida(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 1 || v > 80000) return null;
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return dataValida(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return dataValida(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

export function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Texto limpo ou null se vazio. */
export function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Número do Excel (ou texto) como texto decimal com ponto, para guardar "como veio".
 * Aceita vírgula decimal. Devolve null se não for número.
 */
export function numeroComoTexto(v: unknown): string | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const s = String(v);
    // notação científica (1e-7, 1e+21) não é texto decimal válido para lib/money
    return /e/i.test(s) ? v.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }) : s;
  }
  const s = texto(v);
  if (s === null) return null;
  const n = s.replace(",", ".");
  return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(n) ? n : null;
}

export function ehFimDeSemanaISO(data: string): boolean {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

export function nomeDiaSemana(data: string): string {
  return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][new Date(`${data}T12:00:00Z`).getUTCDay()];
}

/** Soma 1 a uma contagem por motivo. */
export function contar(mapa: Record<string, number>, motivo: string): void {
  mapa[motivo] = (mapa[motivo] ?? 0) + 1;
}
