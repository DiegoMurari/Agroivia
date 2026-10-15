import type { AcondicionamentoOcupacao, AgendamentoStatus, ExcecaoOcupacao } from "@/lib/db/enums";

import { dataBR, dataDoInstante, ehFimDeSemana, horaDoInstante, nomeDoDia, somarDias } from "./datas";

/**
 * Regra de ocupação do horário (D23, D26, D43). Função pura, sem banco.
 *  - horário com carga batida fica reservado só a ela;
 *  - sem batida, até `limiteUnitizados` (2) caminhões paletizados ou big bag;
 *  - vale para a cooperativa inteira; só segunda a sexta e fora de feriado;
 *  - cancelado não conta (remarcar muda a mesma linha: a vaga antiga sai da conta sozinha).
 * O caso fortuito ignora só o limite de ocupação; o excedente conta para quem vier depois (O14).
 */

export interface OcupanteHorario {
  id: number;
  data: string;
  horario: string;
  acondicionamento: AcondicionamentoOcupacao;
  status: AgendamentoStatus;
  excecaoOcupacao?: string | null;
  excecaoMotivo?: string | null;
}

export interface ContextoOcupacao {
  /** Agendamentos de qualquer status. O `cancelado` é descartado aqui dentro. */
  agendamentos: readonly OcupanteHorario[];
  /** Horas da grade ativa, `HH:MM`. */
  grade: readonly string[];
  /** Datas `YYYY-MM-DD`. */
  feriados: readonly string[];
  limiteUnitizados: number;
  /** Instante atual em ISO com fuso (`@/lib/relogio`). */
  agora: string;
}

export interface PedidoHorario {
  data: string;
  horario: string;
  acondicionamento: AcondicionamentoOcupacao;
  excecao?: ExcecaoOcupacao | null;
  /** Agendamento que está sendo remarcado: a vaga dele não conta contra ele mesmo. */
  ignorarAgendamentoId?: number;
}

export type MotivoRecusa = "reservado_batido" | "cheio" | "fora_da_grade" | "dia_nao_util" | "passado";

export interface Vaga {
  data: string;
  horario: string;
}

export type ResultadoOcupacao =
  | { aceita: true; /** caso fortuito entrou acima do limite */ excedeu: boolean }
  | { aceita: false; motivo: MotivoRecusa; mensagem: string; proxima: Vaga | null };

export interface HorarioDoDia {
  horario: string;
  livre: boolean;
  ocupados: number;
  /** Horário com agendamento aceito por exceção: `tipo: motivo`. */
  excecao?: string;
  motivo?: MotivoRecusa;
  mensagem?: string;
}

export interface DiaDisponivel {
  data: string;
  diaSemana: string;
  capacidade: number;
  horarios: HorarioDoDia[];
}

type Avaliacao = { aceita: true; excedeu: boolean } | { aceita: false; motivo: MotivoRecusa; mensagem: string };

const LIMITE_BUSCA_DIAS = 90;
const CAPACIDADE_BASE = 8;
const CAPACIDADE_MINIMA = 4;

/** Só `cancelado` libera a vaga (PRD); `nao_recebido` segue contando. */
function ativos(ctx: ContextoOcupacao, ignorarId?: number): OcupanteHorario[] {
  return ctx.agendamentos.filter((a) => a.status !== "cancelado" && a.id !== ignorarId);
}

export function ehDiaUtil(data: string, feriados: readonly string[]): boolean {
  return !ehFimDeSemana(data) && !feriados.includes(data);
}

/** Capacidade do dia: 8 menos os batidos, no mínimo 4 (O9, O12). */
export function capacidadeDoDia(data: string, agendamentos: readonly OcupanteHorario[]): number {
  const batidos = agendamentos.filter(
    (a) => a.data === data && a.status !== "cancelado" && a.acondicionamento === "batido",
  ).length;
  return Math.max(CAPACIDADE_BASE - batidos, CAPACIDADE_MINIMA);
}

function noPassado(ctx: ContextoOcupacao, data: string, horario: string): boolean {
  const hoje = dataDoInstante(ctx.agora);
  if (data < hoje) return true;
  return data === hoje && horario < horaDoInstante(ctx.agora);
}

/** Avalia um horário sem calcular a próxima vaga (usada também na busca). */
function avaliar(ctx: ContextoOcupacao, pedido: PedidoHorario, doDia: readonly OcupanteHorario[]): Avaliacao {
  const { data, horario, acondicionamento } = pedido;
  const recusar = (motivo: MotivoRecusa, mensagem: string): Avaliacao => ({ aceita: false, motivo, mensagem });

  if (noPassado(ctx, data, horario)) {
    return recusar("passado", `${dataBR(data)} às ${horario} já passou. Escolha um horário a partir de agora.`);
  }
  if (!ehDiaUtil(data, ctx.feriados)) {
    const porque = ehFimDeSemana(data) ? nomeDoDia(data) : "feriado";
    return recusar("dia_nao_util", `${dataBR(data)} é ${porque}: não há recebimento. Escolha um dia útil.`);
  }
  if (!ctx.grade.includes(horario)) {
    return recusar("fora_da_grade", `${horario} não está na grade. Horários: ${ctx.grade.join(", ")}.`);
  }

  const noHorario = doDia.filter((a) => a.horario === horario);
  const limite = ctx.limiteUnitizados;
  let cheio: Avaliacao | null = null;

  if (noHorario.some((a) => a.acondicionamento === "batido")) {
    cheio = recusar("reservado_batido", `${horario} de ${dataBR(data)} está reservado a uma carga batida.`);
  } else if (acondicionamento === "batido" && noHorario.length > 0) {
    cheio = recusar("cheio", `${horario} de ${dataBR(data)} já tem carga; carga batida exige o horário vazio.`);
  } else if (acondicionamento === "unitizado" && noHorario.length >= limite) {
    cheio = recusar("cheio", `${horario} de ${dataBR(data)} está cheio (${limite} caminhões).`);
  }

  if (!cheio) return { aceita: true, excedeu: false };
  if (pedido.excecao === "caso_fortuito") return { aceita: true, excedeu: true };
  // prioridade (D23) fura só o limite de quantidade; a reserva de carga batida continua valendo
  const soLimite = acondicionamento === "unitizado" && !noHorario.some((a) => a.acondicionamento === "batido");
  if (pedido.excecao === "prioridade" && soLimite) return { aceita: true, excedeu: true };
  return cheio;
}

/**
 * Primeira vaga cronologicamente depois do horário pedido (e depois de `agora`)
 * que aceita o acondicionamento do pedido, sem exceção.
 */
export function proximaVaga(ctx: ContextoOcupacao, pedido: PedidoHorario): Vaga | null {
  const hoje = dataDoInstante(ctx.agora);
  const inicio = pedido.data > hoje ? pedido.data : hoje;
  const grade = [...ctx.grade].sort();
  const base: PedidoHorario = { ...pedido, excecao: null };
  const outros = ativos(ctx, pedido.ignorarAgendamentoId);

  for (let i = 0; i <= LIMITE_BUSCA_DIAS; i++) {
    const data = somarDias(inicio, i);
    if (!ehDiaUtil(data, ctx.feriados)) continue;
    const doDia = outros.filter((a) => a.data === data);
    for (const horario of grade) {
      if (data === pedido.data && horario <= pedido.horario) continue;
      if (avaliar(ctx, { ...base, data, horario }, doDia).aceita) return { data, horario };
    }
  }
  return null;
}

export function verificarOcupacao(ctx: ContextoOcupacao, pedido: PedidoHorario): ResultadoOcupacao {
  const doDia = ativos(ctx, pedido.ignorarAgendamentoId).filter((a) => a.data === pedido.data);
  const r = avaliar(ctx, pedido, doDia);
  if (r.aceita) return r;
  return { ...r, proxima: proximaVaga(ctx, pedido) };
}

/** Cada horário da grade num dia, livre ou não, com o motivo. `doDia` evita reler a lista quando o chamador já filtrou. */
export function horariosDoDia(
  ctx: ContextoOcupacao,
  data: string,
  acondicionamento: AcondicionamentoOcupacao,
  doDia: readonly OcupanteHorario[] = ativos(ctx).filter((a) => a.data === data),
): HorarioDoDia[] {
  return [...ctx.grade].sort().map((horario): HorarioDoDia => {
    const r = avaliar(ctx, { data, horario, acondicionamento }, doDia);
    const ocupados = doDia.filter((a) => a.horario === horario).length;
    const excecoes = doDia
      .filter((a) => a.horario === horario && a.excecaoOcupacao)
      .map((a) => `${a.excecaoOcupacao}: ${a.excecaoMotivo ?? "sem motivo"}`);
    const excecao = excecoes.length ? excecoes.join("; ") : undefined;
    return r.aceita
      ? { horario, livre: true, ocupados, excecao }
      : { horario, livre: false, ocupados, excecao, motivo: r.motivo, mensagem: r.mensagem };
  });
}

export type EstadoDia = "livre" | "parcial" | "cheio" | "feriado" | "fim_de_semana" | "passado";

export interface DiaDoCalendario {
  data: string;
  estado: EstadoDia;
  /** Horários livres e total da grade; só para dia útil futuro. */
  livres: number;
  total: number;
}

/** Calendário do mês (`YYYY-MM`) com a disponibilidade de cada dia: verde (livre), azul (parcial), cinza (cheio), laranja (feriado). */
export function calendarioDoMes(ctx: ContextoOcupacao, mes: string, acondicionamento: AcondicionamentoOcupacao): DiaDoCalendario[] {
  const hoje = dataDoInstante(ctx.agora);
  const todos = ativos(ctx);
  const dias: DiaDoCalendario[] = [];
  const total = ctx.grade.length;
  for (let data = `${mes}-01`; data.startsWith(mes); data = somarDias(data, 1)) {
    if (data < hoje) dias.push({ data, estado: "passado", livres: 0, total });
    else if (ctx.feriados.includes(data)) dias.push({ data, estado: "feriado", livres: 0, total });
    else if (ehFimDeSemana(data)) dias.push({ data, estado: "fim_de_semana", livres: 0, total });
    else {
      const livres = horariosDoDia(ctx, data, acondicionamento, todos.filter((a) => a.data === data)).filter((h) => h.livre).length;
      dias.push({ data, estado: livres === 0 ? "cheio" : livres === total ? "livre" : "parcial", livres, total });
    }
  }
  return dias;
}

/** Os próximos dias úteis a partir de hoje, com cada horário livre ou cheio e o motivo (tela do fornecedor). */
export function proximosDias(
  ctx: ContextoOcupacao,
  acondicionamento: AcondicionamentoOcupacao,
  quantidadeDias = 10,
  aPartirDe?: string,
): DiaDisponivel[] {
  const dias: DiaDisponivel[] = [];
  const hoje = dataDoInstante(ctx.agora);
  let data = aPartirDe && aPartirDe > hoje ? aPartirDe : hoje;
  const todos = ativos(ctx);

  for (let i = 0; dias.length < quantidadeDias && i <= LIMITE_BUSCA_DIAS; i++, data = somarDias(data, 1)) {
    if (!ehDiaUtil(data, ctx.feriados)) continue;
    const doDia = todos.filter((a) => a.data === data);
    const horarios = horariosDoDia(ctx, data, acondicionamento, doDia);
    dias.push({ data, diaSemana: nomeDoDia(data), capacidade: capacidadeDoDia(data, doDia), horarios });
  }
  return dias;
}
