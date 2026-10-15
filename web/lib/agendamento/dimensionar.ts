import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { schema } from "@/lib/db";
import type { AcondicionamentoNf } from "@/lib/db/enums";
import { chapasDaCarga, chapasDoDia, type Acondicionamento, type LinhaNorma, type Perfil } from "@/lib/painel/norma";

import { paraTexto, somar, ZERO, type Valor } from "@/lib/money";
import { capacidadeDoDia } from "./ocupacao";
import { dataBR } from "./datas";
import { APROVACAO_OCUPA, lerParametro, type DbOuTx } from "./comum";

/**
 * Dimensionamento por carga (grupo 2): chapas e empilhadeira pela norma de chapas (D25, D26),
 * e alertas do dia de falta de colaborador, equipamento ou espaço. A regra da norma mora em
 * `lib/painel/norma.ts` (única importação cruzada permitida); aqui só se monta a entrada.
 */

export interface LinhaNormaDuracao extends LinhaNorma {
  duracaoMin: number | null;
}

export interface CargaDimensionada {
  chapas: number;
  empilhadeira: boolean;
  duracaoMin: number;
}

/** Peso desconhecido assume a norma cheia (conservador): melhor reservar de mais do que faltar gente. */
const PESO_DESCONHECIDO = "1000000";

export function dimensionarCarga(
  nfs: readonly { acondicionamento: AcondicionamentoNf; pesoKg: string | null }[],
  norma: LinhaNormaDuracao[],
  perfil: Perfil = "agrovia",
): CargaDimensionada {
  if (nfs.length === 0) return { chapas: 0, empilhadeira: false, duracaoMin: 0 };
  // o limite de peso vale para a carga: soma por acondicionamento antes de aplicar a norma
  const somas = new Map<Acondicionamento, Valor>();
  for (const n of nfs) {
    const a = n.acondicionamento as Acondicionamento;
    somas.set(a, somar(somas.get(a) ?? ZERO, n.pesoKg ?? PESO_DESCONHECIDO));
  }
  const componentes = [...somas].map(([acondicionamento, peso]) => ({ acondicionamento, pesoKg: paraTexto(peso) }));
  const necessidade = chapasDaCarga(componentes, norma, { perfil });
  // duração: a SOMA dos componentes que pedem chapa (mesma equipe, em sequência, D26); chapas segue o maior
  let duracaoMin = 0;
  for (const c of componentes) {
    const parcial = chapasDaCarga([c], norma, { perfil });
    if (parcial.chapas === 0) continue;
    const linha = norma.find((l) => l.perfil === perfil && l.acondicionamento === c.acondicionamento);
    duracaoMin += linha?.duracaoMin ?? 0;
  }
  return { chapas: necessidade.chapas, empilhadeira: necessidade.empilhadeira, duracaoMin };
}

// ───────────────────────── alertas do dia ─────────────────────────

export interface CargaDoDia {
  id: number;
  horario: string;
  chapas: number;
  empilhadeira: boolean;
}

export type TipoAlertaDia = "colaborador" | "equipamento" | "espaco";

export interface AlertaDia {
  tipo: TipoAlertaDia;
  mensagem: string;
}

export interface EntradaAlertas {
  data: string;
  cargas: readonly CargaDoDia[];
  /** Chapas na escala do boletim do dia; nulo se ainda não há escala lançada. */
  escalados: number | null;
  empilhadeirasDisponiveis: number;
  /** Capacidade do dia (8 menos os batidos, mínimo 4). */
  capacidade: number;
}

export function alertasDoDia(e: EntradaAlertas): AlertaDia[] {
  const alertas: AlertaDia[] = [];
  const dia = dataBR(e.data);

  const necessarios = chapasDoDia(e.cargas.map((c) => ({ chapas: c.chapas, empilhadeira: c.empilhadeira }))).chapas;
  if (e.escalados !== null && necessarios > e.escalados) {
    alertas.push({
      tipo: "colaborador",
      mensagem: `Em ${dia} a norma pede ${necessarios} funcionários para a maior carga e a escala tem ${e.escalados}. Escale mais ${necessarios - e.escalados}.`,
    });
  }

  const porHorario = new Map<string, number>();
  for (const c of e.cargas) if (c.empilhadeira) porHorario.set(c.horario, (porHorario.get(c.horario) ?? 0) + 1);
  for (const [horario, pedem] of [...porHorario].sort()) {
    if (pedem > e.empilhadeirasDisponiveis) {
      alertas.push({
        tipo: "equipamento",
        mensagem: `Em ${dia} às ${horario}, ${pedem} carga(s) pedem empilhadeira e há ${e.empilhadeirasDisponiveis} disponível(is). Reorganize os horários ou libere um equipamento.`,
      });
    }
  }

  if (e.cargas.length > e.capacidade) {
    alertas.push({
      tipo: "espaco",
      mensagem: `Em ${dia} há ${e.cargas.length} cargas para a capacidade de ${e.capacidade}. Falta espaço: remarque alguma para outro dia.`,
    });
  }
  return alertas;
}

// ───────────────────────── leitura do banco ─────────────────────────

export function lerNorma(db: DbOuTx): { norma: LinhaNormaDuracao[]; perfil: Perfil } {
  const norma = db
    .select()
    .from(schema.normaChapas)
    .all()
    .map((n) => ({
      perfil: n.perfil as Perfil,
      acondicionamento: n.acondicionamento as Acondicionamento,
      pesoMinKgExclusivo: n.pesoMinKgExclusivo,
      chapas: n.chapas,
      empilhadeira: n.empilhadeira,
      duracaoMin: n.duracaoMin,
    }));
  const p = lerParametro(db, "perfil_norma", "agrovia");
  return { norma, perfil: p === "dossie" ? "dossie" : "agrovia" };
}

/** Alertas de um dia a partir do banco. Só leitura. */
export function alertasDaData(db: DbOuTx, data: string): AlertaDia[] {
  const ags = db
    .select()
    .from(schema.agendamento)
    .where(and(eq(schema.agendamento.data, data), inArray(schema.agendamento.status, ["agendado", "chegou", "em_descarga"]), inArray(schema.agendamento.aprovacao, APROVACAO_OCUPA)))
    .all();
  if (ags.length === 0) return [];

  // sem previsão gravada (seed, antigo, agendado na hora): calcula na leitura pelas NF, sem gravar
  let normaLida: ReturnType<typeof lerNorma> | null | undefined;
  const cargas: CargaDoDia[] = ags.map((a) => {
    if (a.chapasPrevistas !== null) return { id: a.id, horario: a.horario, chapas: a.chapasPrevistas, empilhadeira: a.empilhadeiraPrevista ?? false };
    if (normaLida === undefined) {
      try {
        normaLida = lerNorma(db);
      } catch {
        normaLida = null;
      }
    }
    const nfs = db
      .select({ acondicionamento: schema.agendamentoNf.acondicionamento, liquido: schema.notaFiscal.pesoLiquidoKg, bruto: schema.notaFiscal.pesoBrutoKg })
      .from(schema.agendamentoNf)
      .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
      .where(eq(schema.agendamentoNf.agendamentoId, a.id))
      .all();
    let prev = { chapas: 0, empilhadeira: false };
    if (normaLida) {
      try {
        const componentes = nfs.length
          ? nfs.map((n) => ({ acondicionamento: n.acondicionamento, pesoKg: n.liquido ?? n.bruto ?? a.pesoDeclaradoKg }))
          : [{ acondicionamento: a.acondicionamentoOcupacao === "batido" ? ("batido" as const) : ("paletizado" as const), pesoKg: a.pesoDeclaradoKg }];
        prev = dimensionarCarga(componentes, normaLida.norma, normaLida.perfil);
      } catch {
        // norma incompleta: sem alerta para esta carga
      }
    }
    return { id: a.id, horario: a.horario, chapas: prev.chapas, empilhadeira: prev.empilhadeira };
  });

  const escala = db.select({ chapaId: schema.boletimChapa.chapaId }).from(schema.boletimChapa).where(eq(schema.boletimChapa.data, data)).all();
  const escalados = escala.length === 0 ? null : new Set(escala.map((e) => e.chapaId)).size;

  const empilhadeirasDisponiveis = db
    .select({ nome: schema.equipamento.nome, disponivel: schema.equipamento.disponivel, status: schema.equipamento.status })
    .from(schema.equipamento)
    .all()
    .filter((e) => (e.nome ?? "").toLowerCase().includes("empilhadeira"))
    .reduce((t, e) => t + (e.status === "manutencao" ? 0 : e.disponivel), 0);

  const capacidade = capacidadeDoDia(
    data,
    ags.map((a) => ({ id: a.id, data: a.data, horario: a.horario, acondicionamento: a.acondicionamentoOcupacao, status: a.status })),
  );
  return alertasDoDia({ data, cargas, escalados, empilhadeirasDisponiveis, capacidade });
}

/** Datas com alerta entre duas datas (para a tela de agendamentos). */
export function alertasPorPeriodo(db: DbOuTx, de: string, ate: string): { data: string; alertas: AlertaDia[] }[] {
  const datas = [
    ...new Set(
      db
        .select({ data: schema.agendamento.data })
        .from(schema.agendamento)
        .where(and(gte(schema.agendamento.data, de), lte(schema.agendamento.data, ate), inArray(schema.agendamento.aprovacao, APROVACAO_OCUPA)))
        .all()
        .map((a) => a.data),
    ),
  ].sort();
  return datas.map((data) => ({ data, alertas: alertasDaData(db, data) })).filter((x) => x.alertas.length > 0);
}
