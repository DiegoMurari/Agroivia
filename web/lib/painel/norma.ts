/**
 * Régua complementar: norma de chapas por carga e por dia (D25, D26, D22).
 * Regra pura. A função recebe as linhas de `norma_chapas` por parâmetro.
 *
 *  - até o peso mínimo (500 kg, estritamente maior para valer) nenhum chapa;
 *  - batido = 5; paletizado ou big bag = N (1 no perfil agrovia, 2 no dossie) + empilhadeira; máquina = 1;
 *  - carga mista = o maior dos componentes, com empilhadeira se algum componente a pedir;
 *  - dia = o maior necessário entre as cargas (uma equipe em sequência), premissa declarada.
 */
import { dec, maiorQue } from "@/lib/money";

export type Acondicionamento = "batido" | "paletizado" | "big_bag" | "maquina";
export type Perfil = "agrovia" | "dossie";

export interface LinhaNorma {
  perfil: Perfil;
  acondicionamento: Acondicionamento;
  pesoMinKgExclusivo: string | null;
  chapas: number;
  empilhadeira: boolean;
}

export interface Necessidade {
  chapas: number;
  empilhadeira: boolean;
}

export interface Componente {
  acondicionamento: Acondicionamento;
  pesoKg: string;
}

export interface ComponenteIncerto {
  /** Null quando o acondicionamento é desconhecido (histórico sem XML, D22). */
  acondicionamento: Acondicionamento | null;
  /** Null quando o peso é desconhecido. */
  pesoKg: string | null;
  /** Cenários possíveis quando o acondicionamento é desconhecido (padrão: todos). */
  possiveis?: Acondicionamento[];
}

export interface Faixa {
  minimo: Necessidade;
  maximo: Necessidade;
}

const TODOS: Acondicionamento[] = ["batido", "paletizado", "big_bag", "maquina"];
const NENHUMA: Necessidade = { chapas: 0, empilhadeira: false };

function linhaDe(norma: LinhaNorma[], perfil: Perfil, a: Acondicionamento): LinhaNorma {
  const l = norma.find((n) => n.perfil === perfil && n.acondicionamento === a);
  if (!l) throw new Error(`Norma sem linha para o perfil ${perfil} e o acondicionamento ${a}.`);
  return l;
}

function juntar(a: Necessidade, b: Necessidade): Necessidade {
  return { chapas: Math.max(a.chapas, b.chapas), empilhadeira: a.empilhadeira || b.empilhadeira };
}

function cheia(l: LinhaNorma): Necessidade {
  return { chapas: l.chapas, empilhadeira: l.empilhadeira };
}

function umComponente(a: Acondicionamento, pesoKg: string, norma: LinhaNorma[], perfil: Perfil): Necessidade {
  const l = linhaDe(norma, perfil, a);
  if (l.pesoMinKgExclusivo !== null && !maiorQue(dec(pesoKg), l.pesoMinKgExclusivo)) return NENHUMA;
  return cheia(l);
}

export function chapasDaCarga(componentes: Componente[], norma: LinhaNorma[], opcoes: { perfil?: Perfil } = {}): Necessidade {
  const perfil = opcoes.perfil ?? "agrovia";
  return componentes.reduce<Necessidade>((t, c) => juntar(t, umComponente(c.acondicionamento, c.pesoKg, norma, perfil)), NENHUMA);
}

export function chapasDoDia(cargas: Necessidade[]): Necessidade {
  return cargas.reduce<Necessidade>(juntar, NENHUMA);
}

/**
 * Faixa de uma carga com acondicionamento ou peso incertos (D22): do menor ao maior necessário entre os cenários.
 * Peso desconhecido: o mínimo é "nenhum funcionário" e o máximo é o da norma cheia.
 * O máximo é um TETO: pega o maior número de chapas de um cenário e a empilhadeira se algum cenário a pedir,
 * então pode juntar partes de cenários diferentes (por exemplo 5 chapas de batido com empilhadeira de paletizado).
 */
export function faixaDaCarga(componentes: ComponenteIncerto[], norma: LinhaNorma[], opcoes: { perfil?: Perfil } = {}): Faixa {
  const perfil = opcoes.perfil ?? "agrovia";
  let minimo = NENHUMA;
  let maximo = NENHUMA;
  for (const c of componentes) {
    const cenarios = c.acondicionamento ? [c.acondicionamento] : (c.possiveis ?? TODOS);
    if (cenarios.length === 0) throw new Error("Componente sem cenário possível de acondicionamento.");
    const cheias = cenarios.map((a) => cheia(linhaDe(norma, perfil, a)));
    const reais = cenarios.map((a, i) => (c.pesoKg === null ? cheias[i] : umComponente(a, c.pesoKg, norma, perfil)));
    const menor = c.pesoKg === null ? NENHUMA : reais.reduce((m, n) => (n.chapas < m.chapas || (n.chapas === m.chapas && m.empilhadeira && !n.empilhadeira) ? n : m));
    const maiorCenario = reais.reduce((m, n) => (n.chapas > m.chapas ? n : m));
    minimo = juntar(minimo, menor);
    maximo = juntar(maximo, { chapas: maiorCenario.chapas, empilhadeira: reais.some((n) => n.empilhadeira) });
  }
  return { minimo, maximo };
}

export function faixaDoDia(cargas: Faixa[]): Faixa {
  return {
    minimo: cargas.reduce<Necessidade>((t, c) => juntar(t, c.minimo), NENHUMA),
    maximo: cargas.reduce<Necessidade>((t, c) => juntar(t, c.maximo), NENHUMA),
  };
}
