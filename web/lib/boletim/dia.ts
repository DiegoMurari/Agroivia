/**
 * Boletim do dia reunido (todos os armazéns como um só) e o mês em calendário. Regra pura, sem banco.
 * Somas em decimal.js, sem arredondar; cada boletim entra uma vez só (o boletim único de "Todas as áreas" inclusive).
 */
import { dec, paraTexto, somar } from "@/lib/money";

/** Complemento abaixo disso é centavo de arredondamento do piso: mostra "No piso", sem aviso. */
export const COMPLEMENTO_MINIMO_AVISO = "1";
const relevante = (complemento: string) => dec(complemento).gte(COMPLEMENTO_MINIMO_AVISO);

export interface BoletimParaSoma {
  id: number;
  data: string;
  producaoTotal: string;
  totalAPagar: string;
  complemento: string;
  chapas: number;
}

export interface TotaisDoDia {
  boletins: number;
  producao: string;
  totalAPagar: string;
  complemento: string;
  chapas: number;
  /** Algum boletim do dia teve complemento de R$ 1,00 ou mais. */
  abaixoDoPiso: boolean;
}

export function somarBoletins(lista: BoletimParaSoma[]): TotaisDoDia {
  const unicos = [...new Map(lista.map((x) => [x.id, x])).values()];
  const complemento = somar(...unicos.map((x) => x.complemento));
  return {
    boletins: unicos.length,
    producao: paraTexto(somar(...unicos.map((x) => x.producaoTotal))),
    totalAPagar: paraTexto(somar(...unicos.map((x) => x.totalAPagar))),
    complemento: paraTexto(complemento),
    chapas: unicos.reduce((s, x) => s + x.chapas, 0),
    abaixoDoPiso: unicos.some((x) => relevante(x.complemento)),
  };
}

export function agruparPorDia(lista: BoletimParaSoma[]): Record<string, TotaisDoDia> {
  const porData = new Map<string, BoletimParaSoma[]>();
  for (const x of lista) porData.set(x.data, [...(porData.get(x.data) ?? []), x]);
  return Object.fromEntries([...porData.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, itens]) => [data, somarBoletins(itens)]));
}

export interface TotaisDoMes {
  totalAPagar: string;
  complemento: string;
  diasComComplemento: number;
}

export function totaisDoMes(dias: Record<string, TotaisDoDia>): TotaisDoMes {
  const lista = Object.values(dias);
  return {
    totalAPagar: paraTexto(somar(...lista.map((d) => d.totalAPagar))),
    complemento: paraTexto(somar(...lista.map((d) => d.complemento))),
    diasComComplemento: lista.filter((d) => d.abaixoDoPiso).length,
  };
}

/** Semanas de domingo a sábado; dia de fora do mês vem nulo. `mes` é AAAA-MM. */
export function gradeDoMes(mes: string): (string | null)[][] {
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celulas: (string | null)[] = [...Array<null>(primeiro).fill(null)];
  for (let d = 1; d <= ultimo; d++) celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

function somarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const mesAnterior = (mes: string) => somarMes(mes, -1);
export const mesSeguinte = (mes: string) => somarMes(mes, 1);
