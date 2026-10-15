import type { AcondicionamentoNf, AcondicionamentoOcupacao, AgendamentoStatus } from "@/lib/db/enums";

import { dataBR, instanteMarcado } from "./datas";
import { proximaVaga, type ContextoOcupacao, type Vaga } from "./ocupacao";

/**
 * Estados do agendamento, atraso e acondicionamento de ocupação. Regras puras, sem banco.
 *
 * Transições (escolha da janela C; o PRD só fixa as pontas):
 *   agendado -> chegou | cancelado | nao_recebido
 *   chegou -> em_descarga | nao_recebido
 *   em_descarga -> concluido
 *   concluido, cancelado, nao_recebido: finais
 */

const TRANSICOES: Record<AgendamentoStatus, readonly AgendamentoStatus[]> = {
  agendado: ["chegou", "cancelado", "nao_recebido"],
  chegou: ["em_descarga", "nao_recebido"],
  em_descarga: ["concluido"],
  concluido: [],
  cancelado: [],
  nao_recebido: [],
};

const ROTULO: Record<AgendamentoStatus, string> = {
  agendado: "agendado",
  chegou: "chegou",
  em_descarga: "em descarga",
  concluido: "concluído",
  cancelado: "cancelado",
  nao_recebido: "não recebido",
};

export function statusRotulo(status: AgendamentoStatus): string {
  return ROTULO[status];
}

export function transicaoPermitida(de: AgendamentoStatus, para: AgendamentoStatus): boolean {
  return TRANSICOES[de].includes(para);
}

/** Texto da recusa, ou `null` se a transição é permitida. */
export function recusaDeTransicao(de: AgendamentoStatus, para: AgendamentoStatus): string | null {
  if (transicaoPermitida(de, para)) return null;
  if (TRANSICOES[de].length === 0) {
    return `O agendamento já está ${ROTULO[de]} e não muda mais. Para uma nova descarga, gere outro agendamento.`;
  }
  const opcoes = TRANSICOES[de].map((s) => ROTULO[s]).join(" ou ");
  return `Não dá para passar de ${ROTULO[de]} para ${ROTULO[para]}. A partir de ${ROTULO[de]}, o próximo passo é: ${opcoes}.`;
}

/** Acondicionamento de ocupação: batido se qualquer NF for batida, senão unitizado (O8, D26). */
export function acondicionamentoDeOcupacao(nfs: readonly AcondicionamentoNf[]): AcondicionamentoOcupacao {
  return nfs.includes("batido") ? "batido" : "unitizado";
}

export interface AgendamentoParaAtraso {
  id: number;
  status: AgendamentoStatus;
  data: string;
  horario: string;
  chegadaEm: string | null;
  acondicionamento: AcondicionamentoOcupacao;
}

export interface Atraso {
  atrasado: boolean;
  /** Minutos inteiros depois do horário marcado (0 se ainda não chegou a hora). */
  minutos: number;
}

/** Só `agendado` sem `chegada_em` atrasa. 30 min exatos não é atraso; 31 é (O10, O11). */
export function calcularAtraso(a: AgendamentoParaAtraso, agoraISO: string, toleranciaMin: number): Atraso {
  if (a.status !== "agendado" || a.chegadaEm) return { atrasado: false, minutos: 0 };
  const decorrido = Math.floor((Date.parse(agoraISO) - Date.parse(instanteMarcado(a.data, a.horario))) / 60_000);
  const minutos = Math.max(decorrido, 0);
  return { atrasado: minutos > toleranciaMin, minutos };
}

export interface PlanoRemarcacao {
  atraso: Atraso;
  proxima: Vaga | null;
  /** Aviso simulado ao fornecedor (D27): nunca e-mail. */
  aviso: string | null;
}

/** Para o atrasado: próximo horário livre (regra da C1, depois de `agora`) e o texto do aviso. */
export function planejarRemarcacaoPorAtraso(
  a: AgendamentoParaAtraso,
  ctx: ContextoOcupacao,
  toleranciaMin: number,
): PlanoRemarcacao {
  const atraso = calcularAtraso(a, ctx.agora, toleranciaMin);
  if (!atraso.atrasado) return { atraso, proxima: null, aviso: null };

  const proxima = proximaVaga(ctx, {
    data: a.data,
    horario: a.horario,
    acondicionamento: a.acondicionamento,
    ignorarAgendamentoId: a.id,
  });
  const aviso = proxima
    ? `Seu caminhão não chegou até ${toleranciaMin} min depois das ${a.horario} de ${dataBR(a.data)}. ` +
      `Remarcamos a descarga para ${dataBR(proxima.data)} às ${proxima.horario}.`
    : `Seu caminhão não chegou até ${toleranciaMin} min depois das ${a.horario} de ${dataBR(a.data)}. ` +
      `Não há vaga nos próximos dias: fale com a Agrovia para combinar uma nova data.`;
  return { atraso, proxima, aviso };
}
