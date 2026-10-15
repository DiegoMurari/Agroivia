/**
 * Trajeto rastreável de cada entrega (auditoria): do pedido ao fim da descarga, com quem fez cada passo e quando.
 * Só leitura. A fonte é a tabela `evento` (uma linha por mudança de estado), mais o pedido, a aprovação e as notas fiscais.
 */
import { asc, desc, eq, inArray } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";

export type TomDoPasso = "ok" | "alerta" | "erro" | "neutro";

export interface PassoDoTrajeto {
  /** Instante ISO com fuso (-03:00). */
  em: string;
  titulo: string;
  /** Quem fez: nome da pessoa ou do papel. Nulo quando o sistema fez sozinho. */
  quem: string | null;
  detalhe: string | null;
  tom: TomDoPasso;
}

export interface NotaDoTrajeto {
  id: number;
  numero: string | null;
  emitente: string | null;
  chave: string;
  forma: string;
  /** Entrou no sistema. */
  inicio: string;
  /** Fim da descarga que recebeu a nota; nulo enquanto não terminou. */
  fim: string | null;
}

export interface Trajeto {
  agendamentoId: number;
  fornecedor: string;
  placa: string | null;
  status: string;
  data: string;
  horario: string;
  notas: NotaDoTrajeto[];
  passos: PassoDoTrajeto[];
  inicio: string;
  fim: string | null;
  duracaoMin: number | null;
  /** Há passo posterior ao último evento esperado: falta concluir. */
  emAndamento: boolean;
}

export interface LinhaDeAuditoria {
  agendamentoId: number;
  fornecedor: string;
  placa: string | null;
  status: string;
  data: string;
  horario: string;
  notas: string[];
  inicio: string;
  fim: string | null;
  passos: number;
}

const TITULO: Record<string, { titulo: string; tom: TomDoPasso }> = {
  agendado: { titulo: "Horário reservado", tom: "neutro" },
  validado: { titulo: "Nota conferida", tom: "neutro" },
  autorizado: { titulo: "Carga autorizada", tom: "ok" },
  destino_definido: { titulo: "Galpão definido", tom: "neutro" },
  chegou: { titulo: "Caminhão chegou à portaria", tom: "ok" },
  entrada: { titulo: "Descarga iniciada", tom: "ok" },
  saida: { titulo: "Descarga encerrada", tom: "ok" },
  concluido: { titulo: "Entrega concluída", tom: "ok" },
  desfeito: { titulo: "Etapa desfeita", tom: "alerta" },
  cancelado: { titulo: "Agendamento cancelado", tom: "erro" },
  remarcado: { titulo: "Horário remarcado", tom: "alerta" },
  atraso: { titulo: "Atraso registrado", tom: "alerta" },
  nao_recebido: { titulo: "Caminhão não recebido", tom: "erro" },
  pendencia_aberta: { titulo: "Pendência aberta", tom: "alerta" },
  pendencia_resolvida: { titulo: "Pendência resolvida", tom: "ok" },
  vaga_ocupada: { titulo: "Vaga liberada ocupada", tom: "neutro" },
};

const ROTULO_STATUS: Record<string, string> = { agendado: "a chegar", chegou: "no pátio", em_descarga: "em descarga", concluido: "concluído", cancelado: "cancelado", nao_recebido: "não recebido" };
const dataBR = (d: string) => d.split("-").reverse().join("/");

function lerJson(texto: string | null): Record<string, unknown> {
  if (!texto) return {};
  try {
    const v = JSON.parse(texto) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Resume o JSON do evento em uma frase curta, sem expor campo técnico. */
export function descreverDetalhe(tipo: string, texto: string | null, armazens: Map<number, string> = new Map()): string | null {
  const d = lerJson(texto);
  const partes: string[] = [];
  const armazem = typeof d.armazemId === "number" ? armazens.get(d.armazemId) : undefined;
  if (tipo === "desfeito" && typeof d.de === "string" && typeof d.para === "string") {
    return `Voltou de ${ROTULO_STATUS[d.de] ?? d.de} para ${ROTULO_STATUS[d.para] ?? d.para}.`;
  }
  if (tipo === "validado" && typeof d.status === "string") partes.push(d.status === "conforme" ? "Conforme com o pedido" : d.status === "divergente" ? "Divergente do pedido" : "Aguardando conferência");
  if (typeof d.placa === "string" && d.placa) partes.push(`Placa ${d.placa}`);
  if (typeof d.pesoBalancaKg === "string" && d.pesoBalancaKg) partes.push(`Balança ${d.pesoBalancaKg} kg`);
  if (armazem) partes.push(armazem);
  if (typeof d.chapasQtd === "number") partes.push(`${d.chapasQtd} ${d.chapasQtd === 1 ? "funcionário" : "funcionários"}`);
  if (typeof d.duracaoMin === "number") partes.push(`${d.duracaoMin} min de descarga`);
  if (typeof d.minutos === "number") partes.push(`${d.minutos} min de atraso`);
  if (typeof d.motivo === "string" && d.motivo) partes.push(`Motivo: ${d.motivo}`);
  if (typeof d.obs === "string" && d.obs) partes.push(d.obs);
  return partes.length > 0 ? `${partes.join(" · ")}.` : null;
}

export function minutosEntre(deISO: string, ateISO: string): number {
  return Math.max(0, Math.round((Date.parse(ateISO) - Date.parse(deISO)) / 60000));
}

/** Ordena os passos no tempo; passos no mesmo instante mantêm a ordem em que chegaram. */
export function ordenarPassos(passos: PassoDoTrajeto[]): PassoDoTrajeto[] {
  return passos.map((p, i) => ({ p, i })).sort((a, b) => a.p.em.localeCompare(b.p.em) || a.i - b.i).map((x) => x.p);
}

export function obterTrajeto(db: Db, agendamentoId: number): Trajeto | null {
  const a = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, agendamentoId)).get();
  if (!a) return null;
  const fornecedor = db.select().from(schema.fornecedor).where(eq(schema.fornecedor.id, a.fornecedorId)).get();
  const usuarios = new Map(db.select().from(schema.usuario).all().map((u) => [u.id, u.nome ?? u.email ?? "Usuário"]));
  const armazens = new Map(db.select().from(schema.armazem).all().map((x) => [x.id, x.nome]));

  const nfs = db
    .select({ nf: schema.notaFiscal })
    .from(schema.agendamentoNf)
    .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
    .where(eq(schema.agendamentoNf.agendamentoId, agendamentoId))
    .all()
    .map((x) => x.nf);

  const passos: PassoDoTrajeto[] = [];
  passos.push({
    em: a.criadoEm,
    titulo: "Pedido de descarga criado",
    quem: a.criadoPorUsuarioId !== null ? (usuarios.get(a.criadoPorUsuarioId) ?? null) : "Compras, pelo link do fornecedor",
    detalhe: `Para ${dataBR(a.data)} às ${a.horario}.`,
    tom: "neutro",
  });
  for (const n of nfs) {
    passos.push({
      em: n.criadaEm,
      titulo: `Nota fiscal ${n.numero ? `nº ${n.numero} ` : ""}entrou no sistema`,
      quem: null,
      detalhe: `${n.emitenteNome ?? "Emitente não informado"} · ${n.formaEntrada === "xml" ? "lida do XML" : "digitada"} · chave final ${n.chaveAcesso.slice(-8)}.`,
      tom: "neutro",
    });
  }
  if (a.aprovacaoPor !== null && a.aprovacaoEm) {
    passos.push({
      em: a.aprovacaoEm,
      titulo: a.aprovacao === "recusado" ? "Pedido recusado" : "Pedido aprovado",
      quem: usuarios.get(a.aprovacaoPor) ?? null,
      detalhe: a.recusaComentario ? `Motivo: ${a.recusaComentario}` : null,
      tom: a.aprovacao === "recusado" ? "erro" : "ok",
    });
  }

  const eventos = db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, agendamentoId)).orderBy(asc(schema.evento.criadoEm), asc(schema.evento.id)).all();
  for (const e of eventos) {
    // "agendado" repete o passo de criação do pedido: fica só o primeiro
    if (e.tipo === "agendado") continue;
    const base = TITULO[e.tipo] ?? { titulo: e.tipo, tom: "neutro" as const };
    passos.push({ em: e.criadoEm, titulo: base.titulo, quem: e.autor, detalhe: descreverDetalhe(e.tipo, e.detalhe, armazens), tom: base.tom });
  }

  const ordenados = ordenarPassos(passos);
  const fimDaDescarga = a.status === "concluido" ? (a.liberacaoEm ?? ordenados.at(-1)?.em ?? null) : null;
  const terminou = a.status === "concluido" || a.status === "cancelado" || a.status === "nao_recebido";
  const fim = terminou ? (fimDaDescarga ?? ordenados.at(-1)?.em ?? null) : null;
  const inicio = ordenados[0]?.em ?? a.criadoEm;

  return {
    agendamentoId,
    fornecedor: fornecedor?.razaoSocial ?? "Fornecedor não identificado",
    placa: a.placa,
    status: a.status,
    data: a.data,
    horario: a.horario,
    notas: nfs.map((n) => ({ id: n.id, numero: n.numero, emitente: n.emitenteNome, chave: n.chaveAcesso, forma: n.formaEntrada, inicio: n.criadaEm, fim: fimDaDescarga })),
    passos: ordenados,
    inicio,
    fim,
    duracaoMin: fim ? minutosEntre(inicio, fim) : null,
    emAndamento: !terminou,
  };
}

/** Entregas para a tela de auditoria, da mais recente para a mais antiga, com busca por fornecedor, nota, placa ou número. */
export function listarAuditoria(db: Db, busca = "", limite = 80): LinhaDeAuditoria[] {
  const termo = busca.trim().toLowerCase();
  const fornecedores = new Map(db.select().from(schema.fornecedor).all().map((f) => [f.id, f.razaoSocial]));
  const ags = db.select().from(schema.agendamento).orderBy(desc(schema.agendamento.data), desc(schema.agendamento.horario), desc(schema.agendamento.id)).all();
  const ids = ags.map((a) => a.id);
  const ligacoes = ids.length ? db.select({ ag: schema.agendamentoNf.agendamentoId, numero: schema.notaFiscal.numero }).from(schema.agendamentoNf).innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId)).where(inArray(schema.agendamentoNf.agendamentoId, ids)).all() : [];
  const notasPor = new Map<number, string[]>();
  for (const l of ligacoes) if (l.numero) notasPor.set(l.ag, [...(notasPor.get(l.ag) ?? []), l.numero]);
  const eventos = db.select({ ag: schema.evento.agendamentoId }).from(schema.evento).all();
  const passosPor = new Map<number, number>();
  for (const e of eventos) passosPor.set(e.ag, (passosPor.get(e.ag) ?? 0) + 1);

  return ags
    .map((a): LinhaDeAuditoria => {
      const encerrado = a.status === "concluido" || a.status === "cancelado" || a.status === "nao_recebido";
      return {
        agendamentoId: a.id,
        fornecedor: fornecedores.get(a.fornecedorId) ?? "Fornecedor não identificado",
        placa: a.placa,
        status: a.status,
        data: a.data,
        horario: a.horario,
        notas: notasPor.get(a.id) ?? [],
        inicio: a.criadoEm,
        fim: encerrado ? (a.liberacaoEm ?? a.canceladoEm ?? a.atualizadoEm ?? null) : null,
        passos: (passosPor.get(a.id) ?? 0) + 1,
      };
    })
    .filter((l) => !termo || l.fornecedor.toLowerCase().includes(termo) || (l.placa ?? "").toLowerCase().includes(termo) || l.notas.some((n) => n.toLowerCase().includes(termo)) || String(l.agendamentoId) === termo)
    .slice(0, limite);
}
