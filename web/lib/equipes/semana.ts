/**
 * Folhas impressas da escala (D55). A semana é um dia por página; cada dia tem as equipes nas linhas, os horários
 * da grade nas colunas e, em cada célula, as chapas da equipe. Regra pura, sem banco.
 */
import { diaDaSemana, somarDias } from "@/lib/agendamento/datas";
import type { EquipeEscala } from "./servico";

export interface ChapaNaCelula {
  nome: string;
  tipo: "completa" | "meia";
}

export interface LinhaDaEquipe {
  id: number;
  nome: string;
  armazem: string | null;
  tarefa: string | null;
  /** Horário fixo escolhido, ou null quando a equipe vale o dia todo. */
  horario: string | null;
  /** Uma lista de chapas por horário, na ordem de `horarios`. */
  celulas: ChapaNaCelula[][];
}

/** Segunda a sábado da semana que contém `data` (domingo conta como a semana que termina nele). */
export function diasDaSemana(data: string): string[] {
  const dow = diaDaSemana(data);
  const segunda = somarDias(data, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 6 }, (_, i) => somarDias(segunda, i));
}

/**
 * A equipe aparece só no horário fixo da grade que ela escolheu (sem fim de trabalho). Sem horário, vale o dia todo.
 * Um horário que não é da grade (equipe antiga, de quando o campo era livre) cai no horário fixo anterior, ou no primeiro.
 */
export function equipeNoHorario(e: Pick<EquipeEscala, "horarioInicio">, horario: string, horarios: string[]): boolean {
  if (!e.horarioInicio) return true;
  const inicio = e.horarioInicio;
  const slot = [...horarios].reverse().find((h) => h <= inicio) ?? horarios[0];
  return slot === horario;
}

/** As equipes do dia como linhas da folha: nome, onde e o que fazem, e as chapas em cada horário. */
export function linhasDoDia(equipes: EquipeEscala[], horarios: string[], armazens: { id: number; nome: string }[]): LinhaDaEquipe[] {
  const nomeDoArmazem = new Map(armazens.map((a) => [a.id, a.nome]));
  return equipes.map((e) => ({
    id: e.id,
    nome: e.nome,
    armazem: e.armazemId ? (nomeDoArmazem.get(e.armazemId) ?? null) : null,
    tarefa: e.tarefa || null,
    horario: e.horarioInicio || null,
    celulas: horarios.map((h) => (equipeNoHorario(e, h, horarios) ? e.membros.map((m) => ({ nome: m.nome, tipo: m.tipo })) : [])),
  }));
}

/** Os dias que vão para o papel: segunda a sexta sempre, e o sábado só quando tem escala. */
export function diasParaImprimir<T extends { data: string; equipes: unknown[] }>(dias: T[]): T[] {
  return dias.filter((d) => diaDaSemana(d.data) !== 6 || d.equipes.length > 0);
}

/**
 * Maior tamanho de letra (px) para os nomes da folha do dia sem estourar a página nem a célula:
 * pela altura (linhas da equipe mais cheia, repartidas entre as equipes) e pela largura (o nome mais comprido).
 */
export function tamanhoDoTexto(linhas: LinhaDaEquipe[], colunas: number): number {
  const chapas = linhas.flatMap((l) => l.celulas.flat());
  // Cada equipe ocupa tantas linhas quanto a célula mais cheia dela (e no mínimo duas, por causa do nome e do armazém)
  const totalDeLinhas = Math.max(2, linhas.reduce((soma, l) => soma + Math.max(2, ...l.celulas.map((c) => c.length)), 0));
  const maior = Math.max(8, ...chapas.map((c) => c.nome.length + (c.tipo === "meia" ? 7 : 0)));
  const porAltura = 540 / (totalDeLinhas * 1.3 + Math.max(1, linhas.length) * 0.8);
  const porLargura = (780 / Math.max(1, colunas) - 24) / (maior * 0.56);
  return Math.max(12, Math.min(34, Math.floor(Math.min(porAltura, porLargura))));
}
