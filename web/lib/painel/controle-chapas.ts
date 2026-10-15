/**
 * Controle de chapas (tela inicial): saldo do dia entre a necessidade da agenda e a equipe lançada,
 * chapas escaladas hoje e últimos boletins fechados. Só leitura; a data de hoje vem de quem chama.
 * Os valores vêm do boletim gravado (piso do dia), em decimal exato.
 */
import { inArray } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { Valor } from "@/lib/money";
import { avaliarDia, type Rotulo } from "./sobra-falta";

export type TipoSaldo =
  "sem_equipe" | "faltam" | "sobram" | "equilibrio" | "faixa";

export interface SaldoDeChapas {
  tipo: TipoSaldo;
  /** Chapas de diferença, sem sinal. Nulo quando a equipe ainda não foi lançada. */
  diferenca: number | null;
  texto: string;
}

export interface NecessidadeResumida {
  minimo: { chapas: number };
  maximo: { chapas: number };
  agendamentos: number;
}

const quantidade = (n: number, singular: string, plural: string) =>
  n === 1 ? `${singular} ${n}` : `${plural} ${n}`;

/** Compara a equipe lançada (nula se não houver boletim) com o que a agenda pede. */
export function saldoDeChapas(
  necessidade: NecessidadeResumida,
  escalados: number | null,
): SaldoDeChapas {
  if (escalados === null)
    return {
      tipo: "sem_equipe",
      diferenca: null,
      texto: "equipe ainda não lançada",
    };
  const minimo = necessidade.minimo.chapas;
  const maximo = necessidade.maximo.chapas;

  if (minimo === maximo) {
    if (escalados < minimo) {
      const d = minimo - escalados;
      return {
        tipo: "faltam",
        diferenca: d,
        texto: quantidade(d, "falta", "faltam"),
      };
    }
    if (escalados > minimo) {
      const d = escalados - minimo;
      return {
        tipo: "sobram",
        diferenca: d,
        texto: quantidade(d, "sobra", "sobram"),
      };
    }
    return {
      tipo: "equilibrio",
      diferenca: 0,
      texto: "equipe de acordo com a agenda",
    };
  }

  if (escalados < minimo) {
    const d = minimo - escalados;
    return { tipo: "faltam", diferenca: d, texto: `faltam pelo menos ${d}` };
  }
  if (escalados > maximo) {
    const d = escalados - maximo;
    return { tipo: "sobram", diferenca: d, texto: `sobram pelo menos ${d}` };
  }
  return {
    tipo: "faixa",
    diferenca: 0,
    texto: `dentro da faixa de ${minimo} a ${maximo} funcionários`,
  };
}

/** Chapas distintas lançadas nos boletins (rascunho ou fechado, teste ou operação) da data. Nulo se não há boletim. */
export function chapasEscaladasHoje(db: Db, hoje: string): number | null {
  const boletins = db
    .select()
    .from(schema.boletim)
    .all()
    .filter(
      (b) =>
        b.data === hoje && (b.origem === "teste" || b.origem === "operacao"),
    );
  if (boletins.length === 0) return null;
  const linhas = db
    .select()
    .from(schema.boletimChapa)
    .where(
      inArray(
        schema.boletimChapa.boletimId,
        boletins.map((b) => b.id),
      ),
    )
    .all();
  return new Set(linhas.map((l) => l.chapaId)).size;
}

export interface UltimoBoletim {
  id: number;
  data: string;
  armazem: string;
  origem: "teste" | "operacao";
  rotulo: Rotulo;
  /** Saldo em chapas, sem sinal (reais ÷ piso gravado no boletim). */
  chapas: Valor;
  /** Saldo em reais, sem sinal. */
  reais: Valor;
}

/** Últimos boletins fechados de teste ou operação, do mais recente ao mais antigo. */
export function ultimosBoletins(db: Db, limite = 5): UltimoBoletim[] {
  const armazens = new Map(
    db
      .select()
      .from(schema.armazem)
      .all()
      .map((a) => [a.id, a.nome]),
  );
  return db
    .select()
    .from(schema.boletim)
    .all()
    .filter(
      (b) =>
        b.status === "fechado" &&
        (b.origem === "teste" || b.origem === "operacao"),
    )
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .slice(0, limite)
    .flatMap((b) => {
      let a;
      try {
        a = avaliarDia({
          efetivo: b.diariasEquivalentes,
          producao: b.producaoTotal,
          piso: b.pisoUsado,
        });
      } catch {
        return []; // boletim com piso ou valor inválido não derruba a tela inicial
      }
      return [
        {
          id: b.id,
          data: b.data,
          armazem: armazens.get(b.armazemId) ?? "",
          origem: b.origem as "teste" | "operacao",
          rotulo: a.rotulo,
          chapas: a.saldo.abs(),
          reais: a.reais,
        },
      ];
    });
}
