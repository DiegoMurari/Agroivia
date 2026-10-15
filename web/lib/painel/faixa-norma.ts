/**
 * Régua complementar (D29): a norma de chapas aplicada às cargas do histórico, dia a dia, como FAIXA (mínimo a máximo).
 * O histórico quase nunca conhece o acondicionamento (só 67 cargas têm a espécie do XML, D22), então cada carga
 * sem acondicionamento vira cenários. A resposta principal continua sendo a do boletim (sobra-falta.ts).
 * O máximo é um teto. Só leitura; contagem de chapas é inteira.
 */
import { schema, type Db } from "@/lib/db";
import { deInteiro, dividir, type Valor } from "@/lib/money";
import { dataNoFiltro, lerParametros, rotuloDoFiltro, type Filtro } from "./consultas";
import { faixaDaCarga, faixaDoDia, type Acondicionamento, type Faixa, type LinhaNorma, type Perfil } from "./norma";

export const AVISO_FAIXA =
  "Régua complementar, não substitui a conta do boletim. O histórico não traz o acondicionamento da carga (só as cargas com XML, D22), então a norma aparece como faixa: o mínimo supõe o cenário que pede menos funcionários e o máximo, o que pede mais. O máximo é um teto.";

const ACONDICIONAMENTOS: readonly string[] = ["batido", "paletizado", "big_bag", "maquina"];

export interface DiaFaixa {
  data: string;
  cargas: number;
  minimoChapas: number;
  maximoChapas: number;
}

export interface FaixaDaNorma {
  origem: "historico";
  rotulo: string;
  perfil: Perfil;
  aviso: string;
  diasComCarga: number;
  /** Médias por dia com recebimento. */
  minimoMedioChapas: Valor;
  maximoMedioChapas: Valor;
  /** Dia de maior necessidade máxima (empate: data mais antiga). */
  diaDePico: DiaFaixa;
  /** Cargas do período cujo acondicionamento é conhecido pelo XML. */
  cargasComAcondicionamento: number;
  totalCargas: number;
}

/** A norma aplicada a cada dia com carga do histórico, em faixa. Nulo se o período não tem carga. */
export function faixaPorDia(db: Db, filtro: Filtro, perfil: Perfil = "agrovia"): { dias: DiaFaixa[]; comAcond: number; total: number } | null {
  const { safraMeses } = lerParametros(db);
  const norma: LinhaNorma[] = db
    .select()
    .from(schema.normaChapas)
    .all()
    .map((n) => ({ perfil: n.perfil, acondicionamento: n.acondicionamento, pesoMinKgExclusivo: n.pesoMinKgExclusivo, chapas: n.chapas, empilhadeira: n.empilhadeira }));

  const porDia = new Map<string, Faixa[]>();
  let comAcond = 0;
  let total = 0;
  for (const c of db.select().from(schema.histCarga).all()) {
    if (!c.data || !dataNoFiltro(c.data, filtro, safraMeses)) continue;
    const acond = c.acondicionamentoXml && ACONDICIONAMENTOS.includes(c.acondicionamentoXml) ? (c.acondicionamentoXml as Acondicionamento) : null;
    total++;
    if (acond) comAcond++;
    const lista = porDia.get(c.data) ?? [];
    lista.push(faixaDaCarga([{ acondicionamento: acond, pesoKg: c.pesoTotalKg }], norma, { perfil }));
    porDia.set(c.data, lista);
  }
  if (porDia.size === 0) return null;

  const dias: DiaFaixa[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, cargas]) => {
      const f = faixaDoDia(cargas);
      return { data, cargas: cargas.length, minimoChapas: f.minimo.chapas, maximoChapas: f.maximo.chapas };
    });
  return { dias, comAcond, total };
}

export function faixaDaNormaNoPeriodo(db: Db, filtro: Filtro, perfil: Perfil = "agrovia"): FaixaDaNorma | null {
  const lido = faixaPorDia(db, filtro, perfil);
  if (!lido) return null;
  const { dias, comAcond, total } = lido;
  const n = deInteiro(dias.length);
  const soma = (campo: "minimoChapas" | "maximoChapas") => dias.reduce((t, d) => t + d[campo], 0);
  const pico = dias.reduce((m, d) => (d.maximoChapas > m.maximoChapas ? d : m));

  return {
    origem: "historico",
    rotulo: rotuloDoFiltro(filtro),
    perfil,
    aviso: AVISO_FAIXA,
    diasComCarga: dias.length,
    minimoMedioChapas: dividir(deInteiro(soma("minimoChapas")), n),
    maximoMedioChapas: dividir(deInteiro(soma("maximoChapas")), n),
    diaDePico: pico,
    cargasComAcondicionamento: comAcond,
    totalCargas: total,
  };
}
