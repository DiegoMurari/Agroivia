/**
 * Projeção das próximas semanas: quantas chapas por dia e quanto custa o pessoal.
 *  - Dia com a agenda completa: a previsão real do dia (previsao-chapas.ts).
 *  - Dia sem agenda, ou com agenda parcial (poucos caminhões marcados para quem ainda vai chegar): o perfil do mesmo
 *    dia da semana na mesma estação (safra ou entressafra) do histórico. O perfil usa a régua principal do painel:
 *    diárias justificadas = produção ÷ piso, por dia, com faixa do 25º ao 75º percentil. É estimativa e aparece como tal.
 * Custo = chapas × piso da diária (o mínimo que se paga por chapa, com ou sem produção).
 * Comparação: a escala de hoje (efetivo médio da estação no histórico) × piso. A diferença é a economia possível
 * se a escala acompanhar a previsão. Dinheiro em decimal exato (lib/money); só leitura, "hoje" vem de quem chama.
 */
import type { Db } from "@/lib/db";
import { comparar, dec, deInteiro, dividir, formatBRL, formatNumero, multiplicar, somar, subtrair, ZERO, type Valor } from "@/lib/money";
import { lerParametros, resumoHistorico, serieHistorica, type Filtro } from "./consultas";
import { dataSeguinte } from "./dia-seguinte";
import { faixaPorDia } from "./faixa-norma";
import { previsaoDoDia } from "./previsao-chapas";

/** agendado: pela agenda; parcial: agenda ainda incompleta, com o histórico como piso; estimado: só histórico. */
export type OrigemDia = "agendado" | "parcial" | "estimado";

/** O boletim recusa mais de 20 chapas (T2): nenhuma previsão passa disso. A ponta alta da norma, com peso mal lido, chegava a 142. */
export const LIMITE_CHAPAS_DIA = 20;
/** Agenda com menos que esta parte dos caminhões típicos do dia da semana é tratada como parcial. */
const AGENDA_COMPLETA = 0.6;

export interface DiaProjetado {
  data: string;
  /** "seg", "ter"... */
  diaSemana: string;
  origem: OrigemDia;
  /** Caminhões agendados, ou a média de cargas do mesmo dia da semana no histórico (inteiro). */
  cargas: number;
  recomendado: number;
  de: number;
  ate: number;
  /** Custo mínimo do dia (recomendado × piso), já formatado em reais. */
  custo?: string;
}

export interface SemanaProjetada {
  inicio: string;
  fim: string;
  dias: number;
  agendados: number;
  chapasPorDia: string;
  custo: string;
  /** Nulo quando não há escala de referência no histórico. */
  economia: string | null;
}

export interface ResumoProjecao {
  semanas: number;
  uteis: number;
  agendados: number;
  parciais: number;
  estimados: number;
  chapasPorDia: string;
  /** Faixa do histórico, média por dia: do 25º ao 75º percentil. */
  de: string;
  ate: string;
  pico: { data: string; chapas: number } | null;
  /** Escala de referência (efetivo médio da estação), em chapas por dia. */
  escalaAtual: string | null;
  custoRecomendado: string;
  custoMaximo: string;
  custoEscalaAtual: string | null;
  economia: string | null;
  /** Dias em que a previsão pede mais gente do que a escala de hoje (reforço) e dias em que sobra gente. */
  diasDeReforco: number;
  diasDeSobra: number;
  /** Média de chapas a mais, só nos dias de reforço. Nulo sem dia de reforço ou sem escala de referência. */
  reforcoMedio: string | null;
  semanasDetalhe: SemanaProjetada[];
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

/** Segunda-feira da semana da data (a semana de trabalho começa na segunda). */
function segundaDe(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

const media = (valores: Valor[]): Valor => (valores.length === 0 ? ZERO : dividir(somar(...valores), deInteiro(valores.length)));
const maisQueZero = (v: Valor) => (comparar(v, ZERO) > 0 ? v : ZERO);

/** Função pura: custo, economia e semanas de uma lista de dias. `escalaAtual` é o efetivo médio de referência (ou nulo). */
export function resumirProjecao(dias: DiaProjetado[], opcoes: { piso: string; escalaAtual: Valor | string | null; semanas: number }): ResumoProjecao {
  const { piso } = opcoes;
  const escala = opcoes.escalaAtual === null ? null : dec(opcoes.escalaAtual);
  const custoDe = (chapas: Valor) => multiplicar(chapas, piso);
  const rec = (d: DiaProjetado) => deInteiro(d.recomendado);
  const economiaDo = (lista: DiaProjetado[]) => (escala === null ? null : custoDe(somar(ZERO, ...lista.map((d) => maisQueZero(subtrair(escala, rec(d)))))));

  const porSemana = new Map<string, DiaProjetado[]>();
  for (const d of dias) porSemana.set(segundaDe(d.data), [...(porSemana.get(segundaDe(d.data)) ?? []), d]);

  const picoDia = dias.reduce<DiaProjetado | null>((m, d) => (m === null || d.recomendado > m.recomendado ? d : m), null);
  const n = dias.length;
  const nValor = deInteiro(Math.max(n, 1));

  return {
    semanas: opcoes.semanas,
    uteis: n,
    agendados: dias.filter((d) => d.origem === "agendado").length,
    parciais: dias.filter((d) => d.origem === "parcial").length,
    estimados: dias.filter((d) => d.origem === "estimado").length,
    chapasPorDia: formatNumero(media(dias.map(rec)), 1),
    de: formatNumero(media(dias.map((d) => deInteiro(d.de))), 1),
    ate: formatNumero(media(dias.map((d) => deInteiro(d.ate))), 1),
    pico: picoDia ? { data: picoDia.data, chapas: picoDia.recomendado } : null,
    escalaAtual: escala === null ? null : formatNumero(escala, 1),
    custoRecomendado: formatBRL(custoDe(somar(ZERO, ...dias.map(rec)))),
    custoMaximo: formatBRL(custoDe(somar(ZERO, ...dias.map((d) => deInteiro(d.ate))))),
    custoEscalaAtual: escala === null ? null : formatBRL(custoDe(multiplicar(escala, nValor))),
    economia: (() => {
      const e = economiaDo(dias);
      return e === null ? null : formatBRL(e);
    })(),
    diasDeReforco: escala === null ? 0 : dias.filter((d) => comparar(rec(d), escala) > 0).length,
    diasDeSobra: escala === null ? 0 : dias.filter((d) => comparar(rec(d), escala) < 0).length,
    reforcoMedio: (() => {
      if (escala === null) return null;
      const falta = dias.filter((d) => comparar(rec(d), escala) > 0).map((d) => subtrair(rec(d), escala));
      return falta.length === 0 ? null : formatNumero(media(falta), 1);
    })(),
    semanasDetalhe: [...porSemana.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([inicio, lista]) => {
        const e = economiaDo(lista);
        return {
          inicio,
          fim: lista[lista.length - 1].data,
          dias: lista.length,
          agendados: lista.filter((d) => d.origem === "agendado").length,
          chapasPorDia: formatNumero(media(lista.map(rec)), 1),
          custo: formatBRL(custoDe(somar(ZERO, ...lista.map(rec)))),
          economia: e === null ? null : formatBRL(e),
        };
      }),
  };
}

export interface PerfilDoDia {
  /** Caminhões típicos nesse dia da semana. */
  cargas: number;
  recomendado: number;
  de: number;
  ate: number;
}

/** Percentil (0 a 1) por interpolação linear de uma lista já ordenada. */
function percentil(ordenada: number[], p: number): number {
  const pos = (ordenada.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  return base + 1 < ordenada.length ? ordenada[base] + (ordenada[base + 1] - ordenada[base]) * resto : ordenada[base];
}

/**
 * Perfil do histórico por dia da semana (segunda a sexta): chapas recomendadas = média das diárias justificadas
 * (produção ÷ piso) naquele dia da semana; faixa = 25º a 75º percentil. Os caminhões típicos vêm das cargas do dia.
 */
export function perfilPorDiaDaSemana(justificadas: { data: string; diarias: number }[], cargasDoDia: { data: string; cargas: number }[]): Map<number, PerfilDoDia> {
  const porDia = new Map<number, number[]>();
  for (const j of justificadas) {
    const dow = diaDaSemana(j.data);
    porDia.set(dow, [...(porDia.get(dow) ?? []), j.diarias]);
  }
  const cargasPorDia = new Map<number, number[]>();
  for (const c of cargasDoDia) {
    const dow = diaDaSemana(c.data);
    cargasPorDia.set(dow, [...(cargasPorDia.get(dow) ?? []), c.cargas]);
  }
  const perfil = new Map<number, PerfilDoDia>();
  for (const [dow, lista] of porDia) {
    const ordem = [...lista].sort((x, y) => x - y);
    const recomendado = Math.min(LIMITE_CHAPAS_DIA, Math.max(1, Math.round(lista.reduce((t, v) => t + v, 0) / lista.length)));
    const cargas = cargasPorDia.get(dow) ?? [];
    perfil.set(dow, {
      cargas: cargas.length ? Math.round(cargas.reduce((t, v) => t + v, 0) / cargas.length) : 0,
      recomendado,
      de: Math.min(recomendado, Math.max(1, Math.round(percentil(ordem, 0.25)))),
      ate: Math.min(LIMITE_CHAPAS_DIA, Math.max(recomendado, Math.round(percentil(ordem, 0.75)))),
    });
  }
  return perfil;
}

export interface Projecao {
  hoje: string;
  /** "safra" ou "entressafra": a estação do histórico usada nos dias sem agenda. */
  estacao: "safra" | "entressafra";
  piso: string;
  dias: DiaProjetado[];
  /** Um resumo por horizonte (2, 4 e 8 semanas). */
  resumos: ResumoProjecao[];
  diasDoHistorico: number;
}

export const SEMANAS_DA_PROJECAO = [2, 4, 8] as const;

/** Dias úteis a partir de hoje: previsão real onde a agenda está completa, perfil do histórico onde não está. */
export function projetar(db: Db, hoje: string): Projecao | null {
  const { piso, safraMeses } = lerParametros(db);
  const estacao = safraMeses.includes(Number(hoje.slice(5, 7))) ? "safra" : "entressafra";
  const filtro: Filtro = { tipo: estacao };
  const historico = resumoHistorico(db, filtro);
  const mesesOk = new Set(historico.meses.filter((m) => m.status === "ok").map((m) => m.anoMes));
  const justificadas = serieHistorica(db)
    .dias.filter((d) => !d.inconsistente && d.producao !== null && d.efetivo !== null && mesesOk.has(d.data.slice(0, 7)))
    .map((d) => ({ data: d.data, diarias: dividir(d.producao === null ? ZERO : dec(d.producao), piso).toNumber() }));
  const cargas = faixaPorDia(db, filtro)?.dias.map((d) => ({ data: d.data, cargas: d.cargas })) ?? [];
  const perfil = perfilPorDiaDaSemana(justificadas, cargas);
  const escalaAtual = historico.resumo?.efetivoMedio ?? null;

  const maxSemanas = Math.max(...SEMANAS_DA_PROJECAO);
  const uteis = maxSemanas * 5;
  const dias: DiaProjetado[] = [];
  let data = hoje;
  for (let i = 0; i < maxSemanas * 7 + 14 && dias.length < uteis; i++, data = dataSeguinte(data)) {
    const dow = diaDaSemana(data);
    const fimDeSemana = dow === 0 || dow === 6;
    const p = previsaoDoDia(db, data);
    const marcados = p.necessidade.agendamentos;
    const tipico = perfil.get(dow);
    const base = { data, diaSemana: DIAS[dow] };
    const deAgenda = { recomendado: p.previsao.recomendado, de: p.previsao.de, ate: Math.min(LIMITE_CHAPAS_DIA, Math.max(p.previsao.de, p.previsao.ate ?? p.previsao.de)) };

    if (marcados > 0 && (!tipico || marcados >= tipico.cargas * AGENDA_COMPLETA)) {
      // a ponta alta da norma é incerta (peso e acondicionamento a confirmar): a faixa não passa do que o dia da semana costuma pedir
      const ate = tipico ? Math.max(deAgenda.recomendado, Math.min(deAgenda.ate, tipico.ate)) : deAgenda.ate;
      dias.push({ ...base, origem: "agendado", cargas: marcados, ...deAgenda, ate });
    } else if (marcados > 0 && tipico) {
      // agenda ainda incompleta: o que já está marcado não pode valer menos que o dia típico
      const recomendado = Math.max(deAgenda.recomendado, tipico.recomendado);
      dias.push({ ...base, origem: "parcial", cargas: marcados, recomendado, de: Math.min(recomendado, Math.max(deAgenda.de, tipico.de)), ate: Math.max(recomendado, tipico.ate) });
    } else if (!fimDeSemana && tipico) {
      dias.push({ ...base, origem: "estimado", cargas: tipico.cargas, recomendado: tipico.recomendado, de: tipico.de, ate: tipico.ate });
    }
  }
  if (dias.length === 0) return null;

  const comCusto = dias.map((d) => ({ ...d, custo: formatBRL(multiplicar(deInteiro(d.recomendado), piso)) }));
  return {
    hoje,
    estacao,
    piso,
    dias: comCusto,
    diasDoHistorico: justificadas.length,
    resumos: SEMANAS_DA_PROJECAO.map((semanas) => resumirProjecao(dias.slice(0, semanas * 5), { piso, escalaAtual, semanas })),
  };
}
