/**
 * Consultas do painel (A5). Recebem `db` por parâmetro e leem as tabelas; nunca gravam.
 * Valor, peso e quantidade são somados no código com `lib/money` (nunca SUM no SQL). Toda saída traz a origem.
 *
 * Histórico: efetivo = presentes - café (folha, cooperativa inteira); produção = estimada só do recebimento de
 * compras (D29). Excesso é TETO e falta é PISO. Boletins `teste` e `operacao`: produção e efetivo exatos por armazém.
 */
import { eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { Origem, PeriodoSemDadoTipo } from "@/lib/db/enums";
import { dec, deInteiro, dividir, multiplicar, paraTexto, somar, type Valor, ZERO } from "@/lib/money";
import {
  efetivoDoDia,
  ehFimDeSemana,
  resumirMeses,
  resumirPorOrigem,
  type DiaEntrada,
  type MesResumo,
  type Resumo,
} from "./sobra-falta";

export const AVISO_TETO_PISO =
  "No histórico a produção é estimada só pelo recebimento de compras: carregamento de cooperado, remoção e transferência não estão nos dados. Por isso o excesso é um TETO e a falta é um PISO.";

export type Filtro =
  | { tipo: "tudo" }
  | { tipo: "safra" }
  | { tipo: "entressafra" }
  | { tipo: "mes"; anoMes: string }
  | { tipo: "semana"; inicio: string }
  | { tipo: "intervalo"; de: string; ate: string };

export interface Parametros {
  piso: string;
  safraMeses: number[];
  diasMinimos: number;
}

export function lerParametros(db: Db): Parametros {
  const p = new Map(db.select().from(schema.parametro).all().map((x) => [x.chave, x.valor]));
  const piso = p.get("piso_diaria");
  if (!piso) throw new Error("Parâmetro piso_diaria ausente.");
  const safraMeses = (p.get("safra_meses") ?? "10,11,12,1,2,3").split(",").map((m) => Number.parseInt(m, 10)).filter((m) => m >= 1 && m <= 12);
  return { piso, safraMeses, diasMinimos: Number.parseInt(p.get("dias_minimos_mes") ?? "10", 10) };
}

/** Segunda-feira da semana de uma data YYYY-MM-DD. */
export function segundaDe(data: string): string {
  const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
  return somarDias(data, dow === 0 ? -6 : 1 - dow);
}

/** Data YYYY-MM-DD que existe no calendário (2025-02-30 e 2025-13-45 não passam). */
export function dataValida(texto?: string | null): texto is string {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

/**
 * Filtro vindo da URL (`?periodo=safra|entressafra|tudo|2025-11` e `?semana=YYYY-MM-DD`).
 * Padrão: safra (resposta 7 da Agrovia). Valor inválido cai no padrão, nunca em erro.
 */
export function filtroDaUrl(periodo?: string | null, semana?: string | null, de?: string | null, ate?: string | null): Filtro {
  // Intervalo livre (o filtro da tela): com só uma das pontas, a outra fica aberta
  if (dataValida(de) || dataValida(ate)) {
    const inicio = dataValida(de) ? de : "0000-01-01";
    const fim = dataValida(ate) ? ate : "9999-12-31";
    return inicio <= fim ? { tipo: "intervalo", de: inicio, ate: fim } : { tipo: "intervalo", de: fim, ate: inicio };
  }
  if (dataValida(semana)) {
    return { tipo: "semana", inicio: segundaDe(semana) };
  }
  if (periodo === "entressafra") return { tipo: "entressafra" };
  if (periodo === "tudo") return { tipo: "tudo" };
  if (periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return { tipo: "mes", anoMes: periodo };
  return { tipo: "safra" };
}

function somarDias(data: string, n: number): string {
  const t = new Date(`${data}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** A data cai no filtro? Safra e entressafra valem para qualquer ano. */
export function dataNoFiltro(data: string, filtro: Filtro, safraMeses: number[]): boolean {
  const mes = Number.parseInt(data.slice(5, 7), 10);
  switch (filtro.tipo) {
    case "tudo":
      return true;
    case "safra":
      return safraMeses.includes(mes);
    case "entressafra":
      return !safraMeses.includes(mes);
    case "mes":
      return data.slice(0, 7) === filtro.anoMes;
    case "semana":
      return data >= filtro.inicio && data <= somarDias(filtro.inicio, 6);
    case "intervalo":
      return data >= filtro.de && data <= filtro.ate;
  }
}

function mesNoFiltro(anoMes: string, filtro: Filtro, safraMeses: number[]): boolean {
  if (filtro.tipo === "semana") {
    // Só segunda a sexta contam (sábado e domingo ficam fora da comparação): o mês em que a semana termina no fim de semana não entra.
    return anoMes === filtro.inicio.slice(0, 7) || anoMes === somarDias(filtro.inicio, 4).slice(0, 7);
  }
  if (filtro.tipo === "intervalo") return anoMes >= filtro.de.slice(0, 7) && anoMes <= filtro.ate.slice(0, 7);
  return dataNoFiltro(`${anoMes}-15`, filtro, safraMeses);
}

function proximoMes(anoMes: string): string {
  const [a, m] = anoMes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export function rotuloDoFiltro(f: Filtro): string {
  switch (f.tipo) {
    case "tudo":
      return "todo o período com dado";
    case "safra":
      return "safra (outubro a março)";
    case "entressafra":
      return "entressafra (abril a setembro)";
    case "mes":
      return `mês ${f.anoMes}`;
    case "semana":
      return `semana de ${f.inicio}`;
    case "intervalo": {
      const br = (d: string) => d.split("-").reverse().join("/");
      if (f.de === "0000-01-01") return `até ${br(f.ate)}`;
      if (f.ate === "9999-12-31") return `a partir de ${br(f.de)}`;
      return `${br(f.de)} a ${br(f.ate)}`;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------------------------

export interface SerieHistorica {
  dias: DiaEntrada[];
  /** Dias de folha em sábado ou domingo: fora da comparação com o recebimento (D29). */
  fimDeSemanaFora: number;
  /** As datas desses dias, para contar dentro de um período. */
  fimDeSemanaDatas: string[];
  /** Produção estimada por dia e armazém, só quando há estimativa. */
  producaoPorDiaArmazem: Map<string, Map<number, Valor>>;
}

/** Série diária do histórico: folha (efetivo) cruzada com o recebimento estimado (cargas, D21). Origem `historico`. */
export function serieHistorica(db: Db, opcoes: { somenteComBoletim?: boolean } = {}): SerieHistorica {
  // Os chapas são pagos pela produção dos locais com boletim (D17): a Loja não entra na comparação com a folha.
  const somenteComBoletim = opcoes.somenteComBoletim ?? true;
  const comBoletim = new Set(db.select().from(schema.armazem).all().filter((a) => a.fazBoletim).map((a) => a.id));
  const cargas = db
    .select({ data: schema.histCarga.data, armazemId: schema.histCargaArmazem.armazemId, producao: schema.histCargaArmazem.producaoEstimada })
    .from(schema.histCarga)
    .innerJoin(schema.histCargaArmazem, eq(schema.histCargaArmazem.histCargaId, schema.histCarga.id))
    .all();
  const producaoPorDiaArmazem = new Map<string, Map<number, Valor>>();
  for (const c of cargas) {
    if (!c.data || c.producao === null) continue;
    const dia = producaoPorDiaArmazem.get(c.data) ?? new Map<number, Valor>();
    dia.set(c.armazemId, somar(dia.get(c.armazemId) ?? ZERO, c.producao));
    producaoPorDiaArmazem.set(c.data, dia);
  }

  const dias: DiaEntrada[] = [];
  const fimDeSemanaDatas: string[] = [];
  for (const f of db.select().from(schema.histChapasDia).all()) {
    if (!f.data) continue;
    const inconsistente = !f.considerada && (f.qualidade ?? "").includes("cafe_maior_que_presentes");
    if (!f.considerada && !inconsistente) continue;
    if (inconsistente) {
      dias.push({ data: f.data, origem: "historico", efetivo: null, producao: null, inconsistente: true });
      continue;
    }
    if (ehFimDeSemana(f.data)) {
      fimDeSemanaDatas.push(f.data);
      continue;
    }
    const ef = efetivoDoDia(f.presentes ?? -1, f.cafe ?? -1);
    const prod = producaoPorDiaArmazem.get(f.data);
    const contam = prod ? [...prod.entries()].filter(([id]) => !somenteComBoletim || comBoletim.has(id)).map(([, v]) => v) : [];
    dias.push({
      data: f.data,
      origem: "historico",
      efetivo: ef.efetivo,
      producao: contam.length ? paraTexto(somar(...contam)) : null,
      inconsistente: ef.inconsistente,
    });
  }
  dias.sort((a, b) => a.data.localeCompare(b.data));
  return { dias, fimDeSemanaFora: fimDeSemanaDatas.length, fimDeSemanaDatas, producaoPorDiaArmazem };
}

export function statusDosMeses(db: Db): Record<string, PeriodoSemDadoTipo> {
  const saida: Record<string, PeriodoSemDadoTipo> = {};
  for (const p of db.select().from(schema.histPeriodoSemDado).all()) saida[p.anoMes] = p.tipo;
  return saida;
}

/** Meses do intervalo da folha (do primeiro ao último com linha considerada), sem buracos. */
export function mesesDaFolha(db: Db): string[] {
  const datas = db
    .select({ data: schema.histChapasDia.data })
    .from(schema.histChapasDia)
    .where(eq(schema.histChapasDia.considerada, true))
    .all()
    .map((d) => d.data)
    .filter((d): d is string => d !== null)
    .sort();
  if (datas.length === 0) return [];
  const saida: string[] = [];
  const ultimo = datas[datas.length - 1].slice(0, 7);
  for (let m = datas[0].slice(0, 7); m <= ultimo; m = proximoMes(m)) saida.push(m);
  return saida;
}

export interface ResumoHistorico {
  origem: "historico";
  filtro: Filtro;
  rotulo: string;
  aviso: string;
  piso: string;
  meses: MesResumo[];
  /** Null quando nenhum mês do período tem dado: "sem dado", nunca zero. */
  resumo: Resumo | null;
  mesesComDado: number;
  mesesForaDasMedias: number;
  /** Dias de folha em fim de semana dentro do período, fora da comparação. */
  fimDeSemanaFora: number;
}

export function resumoHistorico(db: Db, filtro: Filtro): ResumoHistorico {
  const p = lerParametros(db);
  const serie = serieHistorica(db);
  const meses = mesesDaFolha(db).filter((m) => mesNoFiltro(m, filtro, p.safraMeses));
  const dias = serie.dias.filter((d) => dataNoFiltro(d.data, filtro, p.safraMeses));
  const r = resumirMeses(dias, { meses, statusMes: statusDosMeses(db), piso: p.piso });
  return {
    origem: "historico",
    filtro,
    rotulo: rotuloDoFiltro(filtro),
    aviso: AVISO_TETO_PISO,
    piso: p.piso,
    meses: r.meses,
    resumo: r.periodo,
    mesesComDado: r.mesesComDado,
    mesesForaDasMedias: r.mesesForaDasMedias,
    fimDeSemanaFora: serie.fimDeSemanaDatas.filter((d) => dataNoFiltro(d, filtro, p.safraMeses)).length,
  };
}

export interface DemandaArmazem {
  armazemId: number;
  nome: string;
  /** Diárias justificadas por dia comparado: a demanda do armazém (D30). */
  diariasPorDia: Valor;
  /** O armazém faz boletim (D17)? Sem boletim, não entra na comparação com a folha dos chapas. */
  fazBoletim: boolean;
  /** Participação na demanda dos armazéns com boletim (0 a 1); nulo se o armazém não faz boletim. */
  participacao: Valor | null;
  /** Rateio do efetivo médio proporcional à demanda: PREMISSA, não medição (D30); nulo se não faz boletim. */
  efetivoRateado: Valor | null;
}

/** Demanda por armazém no histórico (D30): a folha não tem armazém, então o efetivo só aparece rateado e rotulado. */
export function demandaPorArmazem(db: Db, filtro: Filtro): { origem: "historico"; premissa: string; armazens: DemandaArmazem[] } | null {
  const p = lerParametros(db);
  const serie = serieHistorica(db);
  const status = statusDosMeses(db);
  const dias = serie.dias.filter(
    (d) => dataNoFiltro(d.data, filtro, p.safraMeses) && !status[d.data.slice(0, 7)] && !d.inconsistente && d.producao !== null && d.efetivo !== null,
  );
  if (dias.length === 0) return null;
  const cadastro = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a]));
  const total = new Map<number, Valor>();
  for (const d of dias) {
    for (const [armazemId, v] of serie.producaoPorDiaArmazem.get(d.data) ?? []) total.set(armazemId, somar(total.get(armazemId) ?? ZERO, v));
  }
  const somaBoletim = somar(...[...total.entries()].filter(([id]) => cadastro.get(id)?.fazBoletim).map(([, v]) => v));
  const efetivoMedio = dividir(somar(...dias.map((d) => d.efetivo!)), deInteiro(dias.length));
  const armazens: DemandaArmazem[] = [...total.entries()]
    .sort(([a], [b]) => a - b)
    .map(([armazemId, producao]) => {
      const fazBoletim = cadastro.get(armazemId)?.fazBoletim ?? false;
      const participacao = fazBoletim ? (somaBoletim.isZero() ? ZERO : dividir(producao, somaBoletim)) : null;
      return {
        armazemId,
        nome: cadastro.get(armazemId)?.nome ?? `armazém ${armazemId}`,
        diariasPorDia: dividir(dividir(producao, p.piso), deInteiro(dias.length)),
        fazBoletim,
        participacao,
        efetivoRateado: participacao ? multiplicar(efetivoMedio, participacao) : null,
      };
    });
  return {
    origem: "historico",
    premissa: "A folha não registra o armazém de cada funcionário: o efetivo por armazém é um rateio proporcional à demanda, uma premissa, não uma medição.",
    armazens,
  };
}

// ---------------------------------------------------------------------------------------------
// Boletins novos (teste ou operação): exatos, por armazém
// ---------------------------------------------------------------------------------------------

export interface ResumoBoletimArmazem {
  armazemId: number;
  nome: string;
  origem: Origem;
  resumo: Resumo;
}

/**
 * D47: "Todas as áreas" (armazém que não recebe descarga, só serve ao boletim único) é o boletim único da cooperativa inteira.
 * Ele conta nos números da cooperativa e nunca vira linha de armazém.
 */
function idsDaCooperativaInteira(db: Db): Set<number> {
  return new Set(
    db
      .select()
      .from(schema.armazem)
      .all()
      .filter((a) => !a.recebeDescarga)
      .map((a) => a.id),
  );
}

/** Excesso ou falta MEDIDOS por armazém, a partir dos boletins fechados. Uma linha por armazém e origem. */
export function resumoBoletins(db: Db, filtro: Filtro, opcoes: { origens?: Origem[] } = {}): ResumoBoletimArmazem[] {
  const p = lerParametros(db);
  const cadastro = db.select().from(schema.armazem).all();
  const nomes = new Map(cadastro.map((a) => [a.id, a.nome]));
  const cooperativa = idsDaCooperativaInteira(db);
  const porArmazem = new Map<number, DiaEntrada[]>();
  for (const b of db.select().from(schema.boletim).where(eq(schema.boletim.status, "fechado")).all()) {
    if (cooperativa.has(b.armazemId)) continue; // D47: boletim único não é linha de armazém
    if (!dataNoFiltro(b.data, filtro, p.safraMeses)) continue;
    if (opcoes.origens && !opcoes.origens.includes(b.origem)) continue;
    const lista = porArmazem.get(b.armazemId) ?? [];
    lista.push({ data: b.data, origem: b.origem, efetivo: b.diariasEquivalentes, producao: b.producaoTotal });
    porArmazem.set(b.armazemId, lista);
  }
  const saida: ResumoBoletimArmazem[] = [];
  for (const [armazemId, dias] of [...porArmazem.entries()].sort(([a], [b]) => a - b)) {
    for (const { origem, resumo } of resumirPorOrigem(dias, p.piso)) {
      saida.push({ armazemId, nome: nomes.get(armazemId) ?? `armazém ${armazemId}`, origem, resumo });
    }
  }
  return saida;
}

export interface ResumoBoletimCooperativa {
  origem: Origem;
  resumo: Resumo;
}

/**
 * Excesso ou falta MEDIDOS na cooperativa inteira, a partir dos boletins fechados (D47): o boletim único de "Todas as áreas"
 * e os boletins por armazém do mesmo dia somam efetivo e produção. Uma linha por origem; sem boletim, lista vazia.
 */
export function resumoCooperativaBoletins(db: Db, filtro: Filtro, opcoes: { origens?: Origem[] } = {}): ResumoBoletimCooperativa[] {
  const p = lerParametros(db);
  const porDiaOrigem = new Map<string, { data: string; origem: Origem; efetivo: Valor[]; producao: Valor[] }>();
  for (const b of db.select().from(schema.boletim).where(eq(schema.boletim.status, "fechado")).all()) {
    if (!dataNoFiltro(b.data, filtro, p.safraMeses)) continue;
    if (opcoes.origens && !opcoes.origens.includes(b.origem)) continue;
    const chave = `${b.origem}|${b.data}`;
    const dia = porDiaOrigem.get(chave) ?? { data: b.data, origem: b.origem, efetivo: [], producao: [] };
    dia.efetivo.push(dec(b.diariasEquivalentes));
    dia.producao.push(dec(b.producaoTotal));
    porDiaOrigem.set(chave, dia);
  }
  const dias: DiaEntrada[] = [...porDiaOrigem.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((d) => ({ data: d.data, origem: d.origem, efetivo: somar(...d.efetivo), producao: somar(...d.producao) }));
  return resumirPorOrigem(dias, p.piso);
}
