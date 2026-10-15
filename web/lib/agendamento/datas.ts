/**
 * Datas `YYYY-MM-DD` e horários `HH:MM` como texto (D35).
 * Dia da semana e soma de dias passam por Date.UTC: `new Date("2026-10-05")` desloca o dia no fuso.
 */

function partes(data: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) throw new Error(`Data inválida: "${data}". Use AAAA-MM-DD.`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const r = new Date(Date.UTC(a, mes - 1, d));
  if (r.getUTCMonth() + 1 !== mes || r.getUTCDate() !== d) throw new Error(`Data inválida: "${data}". Esse dia não existe.`);
  return [a, mes, d];
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = partes(data);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function ehFimDeSemana(data: string): boolean {
  const dia = diaDaSemana(data);
  return dia === 0 || dia === 6;
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = partes(data);
  const r = new Date(Date.UTC(a, m - 1, d + dias));
  return `${r.getUTCFullYear()}-${doisDigitos(r.getUTCMonth() + 1)}-${doisDigitos(r.getUTCDate())}`;
}

/** `2026-10-05T07:45:12-03:00` → `2026-10-05`. */
export function dataDoInstante(instanteISO: string): string {
  return instanteISO.slice(0, 10);
}

/** `2026-10-05T07:45:12-03:00` → `07:45`. */
export function horaDoInstante(instanteISO: string): string {
  return instanteISO.slice(11, 16);
}

const NOMES_DIA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function nomeDoDia(data: string): string {
  return NOMES_DIA[diaDaSemana(data)];
}

/** `2026-10-05` → `05/10/2026`. */
export function dataBR(data: string): string {
  const [a, m, d] = partes(data);
  return `${doisDigitos(d)}/${doisDigitos(m)}/${a}`;
}

/** Minutos entre dois instantes ISO com fuso (positivo se `b` é depois de `a`). */
export function minutosEntre(aISO: string, bISO: string): number {
  return Math.round((Date.parse(bISO) - Date.parse(aISO)) / 60_000);
}

/** Instante marcado do agendamento: `2026-10-05T08:00:00-03:00`. */
export function instanteMarcado(data: string, horario: string): string {
  return `${data}T${horario}:00-03:00`;
}
