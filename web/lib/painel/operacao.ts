/**
 * Indicadores operacionais (RF3-02 a RF3-05 e RF3-08): espera, descarga, colaboradores por recebimento,
 * utilização dos horários e não recebimentos por motivo. Não existem no histórico: só agendamentos
 * `teste` ou `operacao`, sempre em blocos separados por origem (nunca misturados). Só leitura.
 * Tempos vêm de timestamps ISO gravados pelo sistema; nada aqui usa o relógio atual.
 */
import { eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import type { NaoRecebimentoMotivo, Origem } from "@/lib/db/enums";
import { deInteiro, dividir, somar, type Valor } from "@/lib/money";
import { dataNoFiltro, lerParametros, rotuloDoFiltro, type Filtro } from "./consultas";

export interface MotivoNaoRecebimento {
  motivo: NaoRecebimentoMotivo | null;
  quantidade: number;
}

export interface IndicadoresOperacao {
  origem: Exclude<Origem, "historico">;
  rotulo: string;
  /** Agendamentos do período que não foram cancelados. */
  agendamentos: number;
  /** RF3-02: da chegada à entrada no primeiro armazém, em minutos. Null sem nenhum par chegada e entrada. */
  esperaMediaMin: Valor | null;
  esperaAmostras: number;
  /** RF3-03: da entrada à saída em cada armazém, em minutos. Null sem nenhuma descarga concluída. */
  descargaMediaMin: Valor | null;
  descargaAmostras: number;
  /** RF3-04: chapas por recebimento (por armazém da carga). Null se nenhum registro tem chapas. */
  colaboradoresPorRecebimento: Valor | null;
  colaboradoresAmostras: number;
  /** RF3-05: horários ocupados sobre os oferecidos pela grade, nos dias que tiveram agendamento. */
  utilizacao: { dias: number; horariosOcupados: number; horariosOferecidos: number; percentual: Valor | null };
  /** RF3-08 */
  naoRecebimentos: { total: number; porMotivo: MotivoNaoRecebimento[] };
}

function minutos(de: string | null, ate: string | null): Valor | null {
  if (!de || !ate) return null;
  const a = Date.parse(de);
  const b = Date.parse(ate);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return dividir(deInteiro(b - a), deInteiro(60000));
}

function media(valores: Valor[]): Valor | null {
  return valores.length === 0 ? null : dividir(somar(...valores), deInteiro(valores.length));
}

/** Um bloco por origem que tenha dado no período. Lista vazia = sem dado (a tela diz isso, nunca mostra zero). */
export function indicadoresOperacao(db: Db, filtro: Filtro): IndicadoresOperacao[] {
  const { safraMeses } = lerParametros(db);
  const gradeAtiva = new Set(db.select().from(schema.horarioGrade).where(eq(schema.horarioGrade.ativo, true)).all().map((h) => h.hora));
  const grade = gradeAtiva.size;
  const saida: IndicadoresOperacao[] = [];
  const agendaPorId = new Map(db.select({ id: schema.agendamento.id, data: schema.agendamento.data }).from(schema.agendamento).all().map((a) => [a.id, a.data]));

  for (const origem of ["teste", "operacao"] as const) {
    const ags = db
      .select()
      .from(schema.agendamento)
      .where(eq(schema.agendamento.origem, origem))
      .all()
      .filter((a) => a.aprovacao === "aprovado" && dataNoFiltro(a.data, filtro, safraMeses)); // só o aprovado vira indicador de operação
    const nr = db
      .select()
      .from(schema.naoRecebimento)
      .where(eq(schema.naoRecebimento.origem, origem))
      .all()
      .filter((n) => {
        // A data do agendamento (local) manda; sem agendamento, vale a data como foi gravada.
        const data = (n.agendamentoId !== null ? agendaPorId.get(n.agendamentoId) : undefined) ?? n.registradoEm?.slice(0, 10);
        return data ? dataNoFiltro(data, filtro, safraMeses) : false;
      });
    if (ags.length === 0 && nr.length === 0) continue;

    const validos = ags.filter((a) => a.status !== "cancelado");
    const porId = new Map(validos.map((a) => [a.id, a]));
    const itens = db
      .select()
      .from(schema.agendamentoArmazem)
      .all()
      .filter((i) => porId.has(i.agendamentoId));

    const primeiraEntrada = new Map<number, string>();
    for (const i of itens) {
      if (!i.entradaEm) continue;
      const atual = primeiraEntrada.get(i.agendamentoId);
      if (!atual || i.entradaEm < atual) primeiraEntrada.set(i.agendamentoId, i.entradaEm);
    }
    const esperas = [...primeiraEntrada.entries()]
      .map(([id, entrada]) => minutos(porId.get(id)!.chegadaEm, entrada))
      .filter((m): m is Valor => m !== null);
    const descargas = itens.map((i) => minutos(i.entradaEm, i.saidaEm)).filter((m): m is Valor => m !== null);
    const chapas = itens.filter((i) => i.chapasQtd !== null).map((i) => deInteiro(i.chapasQtd!));

    const dias = new Set(validos.map((a) => a.data));
    // Só horários da grade ativa contam como ocupados: o percentual nunca passa de 100%.
    const ocupados = new Set(validos.filter((a) => gradeAtiva.has(a.horario)).map((a) => `${a.data} ${a.horario}`));
    const oferecidos = dias.size * grade;

    const motivos = new Map<NaoRecebimentoMotivo | null, number>();
    for (const n of nr) motivos.set(n.motivo, (motivos.get(n.motivo) ?? 0) + 1);

    saida.push({
      origem,
      rotulo: rotuloDoFiltro(filtro),
      agendamentos: validos.length,
      esperaMediaMin: media(esperas),
      esperaAmostras: esperas.length,
      descargaMediaMin: media(descargas),
      descargaAmostras: descargas.length,
      colaboradoresPorRecebimento: media(chapas),
      colaboradoresAmostras: chapas.length,
      utilizacao: {
        dias: dias.size,
        horariosOcupados: ocupados.size,
        horariosOferecidos: oferecidos,
        percentual: oferecidos === 0 ? null : dividir(deInteiro(ocupados.size * 100), deInteiro(oferecidos)),
      },
      naoRecebimentos: {
        total: nr.length,
        porMotivo: [...motivos.entries()].sort(([, a], [, b]) => b - a).map(([motivo, quantidade]) => ({ motivo, quantidade })),
      },
    });
  }
  return saida;
}

export const ROTULO_MOTIVO: Record<NaoRecebimentoMotivo, string> = {
  divergencia_nota_pedido: "Divergência entre nota e pedido",
  sem_agendamento_sem_vaga: "Sem agendamento e sem vaga",
  caso_fortuito: "Caso fortuito",
  outro: "Outro",
};
