/**
 * Clima do dia no calendário do Boletim: "choveu", "chove hoje" ou "vai chover".
 * Usa a previsão real (lib/tempo) quando há; dia sem dado recebe um clima simulado e estável (mesma data, mesmo resultado),
 * marcado como `estimado`, para a tela nunca ficar vazia na demonstração.
 */
import type { TempoDoDia, TipoDeTempo } from "@/lib/tempo";

export type MomentoDoDia = "passado" | "hoje" | "futuro";

export interface ClimaDoDia {
  data: string;
  momento: MomentoDoDia;
  tipo: TipoDeTempo;
  descricao: string;
  minC: number | null;
  maxC: number | null;
  chuvaPct: number | null;
  /** Chuva no dia: provável (60% ou mais) no futuro e hoje, ou tempo de chuva no passado. */
  chove: boolean;
  /** Frase curta para o dia: "Choveu", "Chove hoje", "Vai chover (70%)", "Sem chuva". */
  frase: string;
  /** Verdadeiro quando não havia dado e o clima foi simulado. */
  estimado: boolean;
}

export function momentoDe(data: string, hoje: string): MomentoDoDia {
  return data < hoje ? "passado" : data === hoje ? "hoje" : "futuro";
}

/** Hash simples e estável de uma data, de 0 a 99. */
function semente(data: string): number {
  let h = 7;
  for (const c of data) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % 100;
}

function simular(data: string): Pick<TempoDoDia, "tipo" | "descricao" | "minC" | "maxC" | "chuvaPct"> {
  const s = semente(data);
  const maxC = 24 + (s % 9);
  const base = { minC: maxC - 9, maxC };
  if (s < 30) return { ...base, tipo: "chuva", descricao: "Chuva", chuvaPct: 65 + (s % 30) };
  if (s < 45) return { ...base, tipo: "nublado", descricao: "Nublado", chuvaPct: 20 + (s % 25) };
  if (s < 70) return { ...base, tipo: "parcial", descricao: "Parcialmente nublado", chuvaPct: 5 + (s % 15) };
  return { ...base, tipo: "sol", descricao: "Céu limpo", chuvaPct: s % 8 };
}

export function frase(momento: MomentoDoDia, chove: boolean, chuvaPct: number | null): string {
  if (momento === "passado") return chove ? "Choveu" : "Não choveu";
  if (momento === "hoje") return chove ? "Chove hoje" : "Sem chuva hoje";
  return chove ? `Vai chover${chuvaPct !== null ? ` (${chuvaPct}%)` : ""}` : "Sem chuva prevista";
}

export function climaDoDia(data: string, hoje: string, real?: TempoDoDia): ClimaDoDia {
  const momento = momentoDe(data, hoje);
  const base = real ?? simular(data);
  const tempoDeChuva = base.tipo === "chuva" || base.tipo === "tempestade";
  // Passado: o tempo do dia diz se choveu. Hoje e futuro: só com chuva provável (60% ou mais).
  const chove = momento === "passado" ? tempoDeChuva : (base.chuvaPct ?? 0) >= 60;
  return {
    data,
    momento,
    tipo: base.tipo,
    descricao: base.descricao,
    minC: base.minC,
    maxC: base.maxC,
    chuvaPct: base.chuvaPct,
    chove,
    frase: frase(momento, chove, base.chuvaPct),
    estimado: !real,
  };
}
