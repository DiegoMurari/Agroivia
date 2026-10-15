/**
 * Cartões-resumo da tela do dia: hoje por estado, último dia com recebimento, duração média e
 * recursos em uso agora. Só LEITURA; só pedidos aprovados (D49).
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

export interface ResumoDoDia {
  hoje: { total: number; agendados: number; emDescarga: number; concluidos: number };
  /** Último dia anterior com caminhão recebido (ontem, ou sexta numa segunda). Nulo se não houver. */
  anterior: { data: string; caminhoes: number; chapas: number } | null;
  /** Média das descargas concluídas, em minutos inteiros. Nula sem histórico. */
  duracaoMediaMin: number | null;
  recursos: { chapasEmUso: number; empilhadeirasEmUso: number; empilhadeirasTotal: number };
}

const ehEmpilhadeira = (nome: string | null) => (nome ?? "").toLowerCase().includes("empilhadeira");
const aprovado = (a: { aprovacao: string }) => a.aprovacao === "aprovado";

/** Média das durações de descarga já concluídas (entrada e saída gravadas), em minutos inteiros. */
export function duracaoMediaMin(db: Db): number | null {
  const linhas = db
    .select()
    .from(schema.agendamentoArmazem)
    .where(and(isNotNull(schema.agendamentoArmazem.entradaEm), isNotNull(schema.agendamentoArmazem.saidaEm)))
    .all();
  if (linhas.length === 0) return null;
  const ags = new Map(db.select().from(schema.agendamento).all().map((a) => [a.id, a]));
  // Uma carga em dois armazéns conta uma vez: da primeira entrada à última saída.
  const porCarga = new Map<number, { entrada: number; saida: number }>();
  for (const l of linhas) {
    const a = ags.get(l.agendamentoId);
    if (!a || !aprovado(a) || a.status !== "concluido") continue;
    const entrada = new Date(l.entradaEm!).getTime();
    const saida = new Date(l.saidaEm!).getTime();
    const atual = porCarga.get(l.agendamentoId);
    porCarga.set(l.agendamentoId, { entrada: Math.min(entrada, atual?.entrada ?? entrada), saida: Math.max(saida, atual?.saida ?? saida) });
  }
  const minutos = [...porCarga.values()].map((c) => (c.saida - c.entrada) / 60000).filter((m) => Number.isFinite(m) && m >= 0);
  if (minutos.length === 0) return null;
  return Math.round(minutos.reduce((s, m) => s + m, 0) / minutos.length);
}

export function resumoDoDia(db: Db, hoje: string): ResumoDoDia {
  const todos = db.select().from(schema.agendamento).all().filter(aprovado);
  const doDia = todos.filter((a) => a.data === hoje && a.status !== "cancelado" && a.status !== "nao_recebido");
  const resumoHoje = {
    total: doDia.length,
    agendados: doDia.filter((a) => a.status === "agendado" || a.status === "chegou").length,
    emDescarga: doDia.filter((a) => a.status === "em_descarga").length,
    concluidos: doDia.filter((a) => a.status === "concluido").length,
  };

  // Último dia anterior a hoje com caminhão concluído.
  const recebidos = todos.filter((a) => a.data < hoje && a.status === "concluido");
  let anterior: ResumoDoDia["anterior"] = null;
  if (recebidos.length > 0) {
    const data = recebidos.reduce((m, a) => (a.data > m ? a.data : m), "0000-00-00");
    const doDiaAnt = recebidos.filter((a) => a.data === data);
    const boletinsIds = db.select().from(schema.boletim).where(eq(schema.boletim.data, data)).all().map((b) => b.id);
    let chapas = boletinsIds.length
      ? new Set(db.select().from(schema.boletimChapa).where(inArray(schema.boletimChapa.boletimId, boletinsIds)).all().map((c) => c.chapaId)).size
      : 0;
    if (chapas === 0) {
      const destinos = db.select().from(schema.agendamentoArmazem).where(inArray(schema.agendamentoArmazem.agendamentoId, doDiaAnt.map((a) => a.id))).all();
      const usos = destinos.length ? db.select().from(schema.descargaChapa).where(inArray(schema.descargaChapa.agendamentoArmazemId, destinos.map((d) => d.id))).all() : [];
      chapas = usos.length > 0 ? new Set(usos.map((u) => u.chapaId)).size : destinos.reduce((m, d) => Math.max(m, d.chapasQtd ?? 0), 0);
    }
    anterior = { data, caminhoes: doDiaAnt.length, chapas };
  }

  // Recursos em uso agora: descargas com entrada e sem saída, em cargas aprovadas e ainda ativas.
  const ativas = new Set(todos.filter((a) => a.status === "chegou" || a.status === "em_descarga" || a.status === "agendado").map((a) => a.id));
  const emAndamento = db
    .select()
    .from(schema.agendamentoArmazem)
    .where(and(isNotNull(schema.agendamentoArmazem.entradaEm), isNull(schema.agendamentoArmazem.saidaEm)))
    .all()
    .filter((d) => ativas.has(d.agendamentoId));
  const equipamentos = new Map(db.select().from(schema.equipamento).all().map((e) => [e.id, e]));
  const usos = emAndamento.length ? db.select().from(schema.descargaEquipamento).where(inArray(schema.descargaEquipamento.agendamentoArmazemId, emAndamento.map((d) => d.id))).all() : [];
  const empilhadeirasEmUso = usos.filter((u) => ehEmpilhadeira(equipamentos.get(u.equipamentoId)?.nome ?? null)).length;
  const empilhadeirasTotal = [...equipamentos.values()].filter((e) => ehEmpilhadeira(e.nome)).reduce((s, e) => s + e.quantidade, 0);

  return {
    hoje: resumoHoje,
    anterior,
    duracaoMediaMin: duracaoMediaMin(db),
    recursos: { chapasEmUso: emAndamento.reduce((s, d) => s + (d.chapasQtd ?? 0), 0), empilhadeirasEmUso, empilhadeirasTotal },
  };
}
