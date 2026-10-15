/**
 * Previsão de chapas da semana (D52): hoje e os próximos 6 dias úteis, um registro por dia, só com texto e inteiros
 * (pronto para ir a um componente de cliente). Cada dia vem de previsaoDoDia; dia sem agendamento não inventa número.
 * Só leitura; "hoje" é informado por quem chama (lib/relogio).
 */
import type { Db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { dataSeguinte } from "./dia-seguinte";
import { previsaoDoDia, type TipoPrevisao } from "./previsao-chapas";
import { LIMITE_CHAPAS_DIA } from "./projecao";

export interface HorarioDaSemana {
  horario: string;
  recebimentos: number;
  armazens: string;
  chapas: string;
  empilhadeira: boolean;
}

export interface DiaDaSemana {
  data: string;
  /** "seg", "ter"... */
  diaSemana: string;
  hoje: boolean;
  caminhoes: number;
  recomendado: number;
  de: number;
  ate: number;
  empilhadeira: boolean;
  tipo: TipoPrevisao;
  motivo: string;
  aviso: string;
  /** Complemento previsto formatado em reais, ou nulo. */
  complemento: string | null;
  porHorario: HorarioDaSemana[];
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const faixa = (a: number, b: number) => (a === b ? String(a) : `${a} a ${b}`);

export function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

export function previsaoDaSemana(db: Db, hoje: string, uteis = 6): DiaDaSemana[] {
  const dias: DiaDaSemana[] = [];
  let data = hoje;
  for (let i = 0; i < 21 && dias.length < uteis + 1; i++, data = dataSeguinte(data)) {
    const dow = diaDaSemana(data);
    const fimDeSemana = dow === 0 || dow === 6;
    const eHoje = data === hoje;
    const p = previsaoDoDia(db, data);
    if (!eHoje && fimDeSemana && p.necessidade.agendamentos === 0) continue;
    const n = p.necessidade;
    dias.push({
      data,
      diaSemana: DIAS[dow],
      hoje: eHoje,
      caminhoes: n.agendamentos,
      recomendado: p.previsao.recomendado,
      de: p.previsao.de,
      // o boletim recusa mais de 20 chapas: a ponta alta da norma, com peso incerto, não passa disso
      ate: Math.max(p.previsao.de, Math.min(LIMITE_CHAPAS_DIA, p.previsao.ate ?? p.previsao.de)),
      empilhadeira: n.maximo.empilhadeira,
      tipo: p.previsao.tipo,
      motivo: p.previsao.motivo,
      aviso: p.aviso,
      complemento: p.previsao.complementoPrevisto ? formatBRL(p.previsao.complementoPrevisto) : null,
      porHorario: n.porHorario.map((h) => ({
        horario: h.horario,
        recebimentos: h.agendamentos,
        armazens: h.porArmazem.map((a) => `${a.nome} ${faixa(a.minimo.chapas, a.maximo.chapas)}`).join(", "),
        chapas: faixa(h.minimo.chapas, h.maximo.chapas),
        empilhadeira: h.maximo.empilhadeira,
      })),
    });
  }
  return dias;
}
