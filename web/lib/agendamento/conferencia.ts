import { and, eq, inArray } from "drizzle-orm";

import { schema } from "@/lib/db";

import { ErroDeRegra } from "@/lib/http";

import { lerParametro, type DbOuTx } from "./comum";
import { dataBR, dataDoInstante, instanteMarcado, minutosEntre } from "./datas";
import { normalizarPlaca } from "./historico";
import { numeroDoAgendamento } from "./numero";
import type { NfeLida } from "./nf-xml";
import { validarNfPedido } from "./validacao";

/**
 * Conferência da nota fiscal na portaria (D53): a nota lida bate com um agendamento aprovado?
 * Só lê. Quem registra a chegada é `registrarChegadaDaConferencia` (portaria.ts).
 */

export type Veredito = "confere" | "confere_com_aviso" | "divergente" | "sem_agendamento" | "escolher";
export type ChaveConferencia = "nota" | "fornecedor" | "dia" | "horario" | "pedido" | "placa";
export type ResultadoItem = "bate" | "nao_bate" | "aviso" | "nao_se_aplica";

export interface ItemConferido {
  chave: ChaveConferencia;
  rotulo: string;
  resultado: ResultadoItem;
  mensagem: string;
  /** O que está na nota e o que está no agendamento, para as duas colunas da tela. */
  naNota: string | null;
  noAgendamento: string | null;
}

export interface Candidato {
  agendamentoId: number;
  numero: string;
  fornecedor: string;
  data: string;
  horario: string;
  placa: string | null;
}

export interface ProdutoDaNota {
  nota: string | null;
  descricao: string | null;
  quantidade: string | null;
  unidade: string | null;
}

export interface EntradaConferencia {
  nf?: NfeLida | null;
  /** Chave de 44 dígitos digitada, quando não há XML. */
  chave?: string | null;
  placa?: string | null;
  /** Escolha da pessoa quando a busca devolveu mais de um candidato. */
  agendamentoId?: number | null;
}

export interface ResultadoConferencia {
  veredito: Veredito;
  /** Frase do veredito, para o cartão. */
  resumo: string;
  agendamentoId: number | null;
  numero: string | null;
  candidatos: Candidato[];
  itens: ItemConferido[];
  /** Produtos das notas do agendamento, para a portaria ver o que o caminhão deve trazer. */
  produtos: ProdutoDaNota[];
  chave: string;
  cnpjEmitente: string | null;
}

const digitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
const BLOQUEIAM: ChaveConferencia[] = ["nota", "fornecedor", "dia", "pedido"];

/** O CNPJ do emitente está dentro da chave de acesso: posições 7 a 20. */
export function cnpjDaChave(chave: string): string {
  return chave.slice(6, 20);
}

function chaveDe(entrada: EntradaConferencia): string {
  const chave = digitos(entrada.nf?.chaveAcesso ?? entrada.chave);
  if (chave.length !== 44) {
    throw new ErroDeRegra("A chave da nota tem 44 números. Confira o que foi digitado ou anexe o XML.", { status: 400, campos: { chave: "44 números." } });
  }
  return chave;
}

interface AgendamentoCarregado {
  ag: typeof schema.agendamento.$inferSelect;
  fornecedor: { razaoSocial: string; cnpj: string | null };
  nfs: { id: number; chave: string; numero: string | null; itens: { descricao: string | null; quantidade: string | null; unidade: string | null }[]; pesoLiquidoKg: string | null; pesoBrutoKg: string | null; emitenteCnpj: string | null }[];
}

function carregar(db: DbOuTx, id: number): AgendamentoCarregado | null {
  const linha = db
    .select({ ag: schema.agendamento, razaoSocial: schema.fornecedor.razaoSocial, cnpj: schema.fornecedor.cnpj })
    .from(schema.agendamento)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.agendamento.fornecedorId))
    .where(eq(schema.agendamento.id, id))
    .get();
  if (!linha) return null;
  const nfs = db
    .select({ nf: schema.notaFiscal })
    .from(schema.agendamentoNf)
    .innerJoin(schema.notaFiscal, eq(schema.notaFiscal.id, schema.agendamentoNf.notaFiscalId))
    .where(eq(schema.agendamentoNf.agendamentoId, id))
    .all()
    .map(({ nf }) => ({
      id: nf.id,
      chave: nf.chaveAcesso,
      numero: nf.numero,
      pesoLiquidoKg: nf.pesoLiquidoKg,
      pesoBrutoKg: nf.pesoBrutoKg,
      emitenteCnpj: nf.emitenteCnpj,
      itens: db
        .select({ descricao: schema.notaFiscalItem.descricao, quantidade: schema.notaFiscalItem.quantidade, unidade: schema.notaFiscalItem.unidade })
        .from(schema.notaFiscalItem)
        .where(eq(schema.notaFiscalItem.notaFiscalId, nf.id))
        .all(),
    }));
  return { ag: linha.ag, fornecedor: { razaoSocial: linha.razaoSocial, cnpj: linha.cnpj }, nfs };
}

function candidatoDe(c: AgendamentoCarregado): Candidato {
  return {
    agendamentoId: c.ag.id,
    numero: numeroDoAgendamento(c.ag.id, c.ag.criadoEm),
    fornecedor: c.fornecedor.razaoSocial,
    data: c.ag.data,
    horario: c.ag.horario,
    placa: c.ag.placa,
  };
}

function vazio(chave: string, cnpj: string | null, veredito: Veredito, resumo: string, extra: Partial<ResultadoConferencia> = {}): ResultadoConferencia {
  return { veredito, resumo, agendamentoId: null, numero: null, candidatos: [], itens: [], produtos: [], chave, cnpjEmitente: cnpj, ...extra };
}

/** Busca 1: a nota já anexada a um agendamento não cancelado. */
function porChave(db: DbOuTx, chave: string): number | null {
  const nf = db.select({ id: schema.notaFiscal.id }).from(schema.notaFiscal).where(eq(schema.notaFiscal.chaveAcesso, chave)).get();
  if (!nf) return null;
  const linha = db
    .select({ id: schema.agendamento.id, status: schema.agendamento.status, aprovacao: schema.agendamento.aprovacao })
    .from(schema.agendamentoNf)
    .innerJoin(schema.agendamento, eq(schema.agendamento.id, schema.agendamentoNf.agendamentoId))
    .where(and(eq(schema.agendamentoNf.notaFiscalId, nf.id), inArray(schema.agendamento.aprovacao, ["aguardando", "aprovado"])))
    .all()
    // a mais recente que não foi cancelada; se só houver cancelada, a nota não está em agendamento
    .filter((a) => a.status !== "cancelado")
    .sort((a, b) => b.id - a.id)[0];
  return linha?.id ?? null;
}

/** Busca 2: agendamentos aprovados e ainda não chegados do fornecedor com este CNPJ. Hoje primeiro, depois os próximos, depois os atrasados. */
function porCnpj(db: DbOuTx, cnpj: string, hoje: string): AgendamentoCarregado[] {
  const fornecedores = db.select({ id: schema.fornecedor.id, cnpj: schema.fornecedor.cnpj }).from(schema.fornecedor).all().filter((f) => digitos(f.cnpj) === cnpj);
  if (fornecedores.length === 0) return [];
  const ags = db
    .select({ id: schema.agendamento.id, data: schema.agendamento.data, horario: schema.agendamento.horario })
    .from(schema.agendamento)
    .where(
      and(
        inArray(schema.agendamento.fornecedorId, fornecedores.map((f) => f.id)),
        eq(schema.agendamento.aprovacao, "aprovado"),
        eq(schema.agendamento.status, "agendado"),
      ),
    )
    .all();
  const grupo = (data: string) => (data === hoje ? 0 : data > hoje ? 1 : 2);
  return ags
    .sort((a, b) => grupo(a.data) - grupo(b.data) || (grupo(a.data) === 2 ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data)) || a.horario.localeCompare(b.horario) || a.id - b.id)
    .map((a) => carregar(db, a.id))
    .filter((c): c is AgendamentoCarregado => c !== null);
}

function conferirContra(db: DbOuTx, c: AgendamentoCarregado, entrada: EntradaConferencia, chave: string, cnpj: string, agoraISO: string): ResultadoConferencia {
  const { ag } = c;
  const numero = numeroDoAgendamento(ag.id, ag.criadoEm);
  const produtos: ProdutoDaNota[] = c.nfs.flatMap((n) => n.itens.map((i) => ({ nota: n.numero, ...i })));
  const base = { agendamentoId: ag.id, numero, candidatos: [] as Candidato[], produtos, chave, cnpjEmitente: cnpj };

  // o agendamento precisa estar aprovado e em aberto para a nota conferir
  if (ag.aprovacao !== "aprovado") {
    return { ...base, veredito: "divergente", resumo: "Agendamento ainda não aprovado por Compras", itens: [{ chave: "nota", rotulo: "Agendamento", resultado: "nao_bate", mensagem: "Agendamento ainda não aprovado por Compras.", naNota: null, noAgendamento: numero }] };
  }
  if (ag.status !== "agendado") {
    const dito = ag.status === "concluido" ? "já foi descarregado" : ag.status === "cancelado" ? "foi cancelado" : "já registrou a chegada";
    return { ...base, veredito: "divergente", resumo: `Este agendamento ${dito}`, itens: [{ chave: "nota", rotulo: "Agendamento", resultado: "nao_bate", mensagem: `O agendamento ${numero} ${dito}.`, naNota: null, noAgendamento: numero }] };
  }

  const itens: ItemConferido[] = [];
  const hoje = dataDoInstante(agoraISO);
  const numeroDaNota = entrada.nf?.numero ?? null;
  const numerosAnexados = c.nfs.map((n) => n.numero ?? n.chave.slice(25, 34)).join(", ") || null;

  // nota
  const anexada = c.nfs.some((n) => n.chave === chave);
  itens.push({
    chave: "nota",
    rotulo: "Nota",
    resultado: anexada ? "bate" : "nao_bate",
    mensagem: anexada ? "É a nota anexada no agendamento." : `Esta nota não é a que foi anexada no agendamento (nota ${numeroDaNota ?? chave.slice(25, 34)}; no agendamento, ${numerosAnexados ?? "nenhuma"}).`,
    naNota: numeroDaNota ?? chave.slice(25, 34),
    noAgendamento: numerosAnexados,
  });

  // fornecedor
  const cnpjForn = digitos(c.fornecedor.cnpj);
  if (!cnpjForn) {
    itens.push({ chave: "fornecedor", rotulo: "Fornecedor", resultado: "nao_se_aplica", mensagem: "O fornecedor do agendamento não tem CNPJ cadastrado.", naNota: entrada.nf?.emitenteNome ?? cnpj, noAgendamento: c.fornecedor.razaoSocial });
  } else {
    const bate = cnpjForn === cnpj;
    itens.push({
      chave: "fornecedor",
      rotulo: "Fornecedor",
      resultado: bate ? "bate" : "nao_bate",
      mensagem: bate ? "O emitente é o fornecedor do agendamento." : `CNPJ da nota (${cnpj}) é diferente do CNPJ do fornecedor (${cnpjForn}).`,
      naNota: `${entrada.nf?.emitenteNome ?? "Emitente"} · ${cnpj}`,
      noAgendamento: `${c.fornecedor.razaoSocial} · ${cnpjForn}`,
    });
  }

  // dia
  const diaBate = ag.data === hoje;
  itens.push({
    chave: "dia",
    rotulo: "Dia",
    resultado: diaBate ? "bate" : "nao_bate",
    mensagem: diaBate ? "Agendado para hoje." : `Agendado para ${dataBR(ag.data).slice(0, 5)}, hoje é ${dataBR(hoje).slice(0, 5)}.`,
    naNota: dataBR(hoje).slice(0, 5),
    noAgendamento: `${dataBR(ag.data).slice(0, 5)} às ${ag.horario}`,
  });

  // horário (só faz sentido no dia certo)
  if (diaBate) {
    const tolerancia = Number(lerParametro(db, "tolerancia_min", "30"));
    const limite = Number.isFinite(tolerancia) ? tolerancia : 30;
    const atraso = minutosEntre(instanteMarcado(ag.data, ag.horario), agoraISO);
    itens.push({
      chave: "horario",
      rotulo: "Horário",
      resultado: atraso > limite ? "aviso" : "bate",
      mensagem: atraso > limite ? `Chegou ${atraso} min depois do horário.` : "Dentro do horário.",
      naNota: null,
      noAgendamento: ag.horario,
    });
  }

  // pedido de compra
  const itensCompra = ag.compraId
    ? db.select({ quantidade: schema.compraItem.quantidade, pesoKg: schema.compraItem.pesoKg }).from(schema.compraItem).where(eq(schema.compraItem.compraId, ag.compraId)).all()
    : [];
  if (itensCompra.length === 0) {
    itens.push({ chave: "pedido", rotulo: "Pedido de compra", resultado: "nao_se_aplica", mensagem: "O agendamento não tem itens de pedido de compra para conferir.", naNota: null, noAgendamento: null });
  } else {
    const nfs = entrada.nf
      ? [{ emitenteCnpj: cnpj, pesoLiquidoKg: entrada.nf.pesoLiquidoKg, pesoBrutoKg: entrada.nf.pesoBrutoKg, itens: entrada.nf.itens.map((i) => ({ quantidade: i.quantidade })) }]
      : c.nfs.map((n) => ({ emitenteCnpj: n.emitenteCnpj, pesoLiquidoKg: n.pesoLiquidoKg, pesoBrutoKg: n.pesoBrutoKg, itens: n.itens.map((i) => ({ quantidade: i.quantidade })) }));
    const dif = validarNfPedido(nfs, { fornecedorCnpj: c.fornecedor.cnpj, itens: itensCompra }).alertas.filter((a) => a.tipo !== "cnpj");
    itens.push({
      chave: "pedido",
      rotulo: "Pedido de compra",
      resultado: dif.length ? "nao_bate" : "bate",
      mensagem: dif.length ? dif.map((d) => d.mensagem).join(" ") : "Itens e quantidades conferem com o pedido de compra.",
      naNota: (entrada.nf?.itens ?? []).map((i) => i.descricao).filter(Boolean).join("; ") || null,
      noAgendamento: null,
    });
  }

  // placa
  const placaInformada = normalizarPlaca(entrada.placa) ?? normalizarPlaca(entrada.nf?.placa);
  const placaAgendada = normalizarPlaca(ag.placa);
  if (placaInformada && placaAgendada) {
    const bate = placaInformada === placaAgendada;
    itens.push({
      chave: "placa",
      rotulo: "Placa",
      resultado: bate ? "bate" : "aviso",
      mensagem: bate ? "A placa é a do agendamento." : `Placa ${placaInformada} é diferente da agendada (${placaAgendada}).`,
      naNota: placaInformada,
      noAgendamento: placaAgendada,
    });
  } else {
    itens.push({ chave: "placa", rotulo: "Placa", resultado: "nao_se_aplica", mensagem: "Sem as duas placas para comparar.", naNota: placaInformada, noAgendamento: placaAgendada });
  }

  const bloqueia = itens.some((i) => i.resultado === "nao_bate" && BLOQUEIAM.includes(i.chave));
  const aviso = itens.some((i) => i.resultado === "aviso");
  const veredito: Veredito = bloqueia ? "divergente" : aviso ? "confere_com_aviso" : "confere";
  const resumo =
    veredito === "confere"
      ? `Nota confere com o agendamento ${numero}`
      : veredito === "confere_com_aviso"
        ? "Confere, com aviso"
        : "Não confere";
  return { ...base, veredito, resumo, itens };
}

/**
 * A nota lida bate com um agendamento? Busca pela chave anexada; sem ela, pelo CNPJ do emitente.
 * Mais de um candidato: devolve `escolher` com a lista; a pessoa escolhe e a conferência roda de novo com `agendamentoId`.
 */
export function conferirNota(db: DbOuTx, entrada: EntradaConferencia, agoraISO: string): ResultadoConferencia {
  const chave = chaveDe(entrada);
  const cnpj = digitos(entrada.nf?.emitenteCnpj) || cnpjDaChave(chave);
  const hoje = dataDoInstante(agoraISO);

  if (entrada.agendamentoId) {
    const c = carregar(db, entrada.agendamentoId);
    if (!c) return vazio(chave, cnpj, "sem_agendamento", "Agendamento não encontrado");
    return conferirContra(db, c, entrada, chave, cnpj, agoraISO);
  }

  const id = porChave(db, chave);
  if (id !== null) {
    const c = carregar(db, id);
    if (c) return conferirContra(db, c, entrada, chave, cnpj, agoraISO);
  }

  const candidatos = porCnpj(db, cnpj, hoje);
  if (candidatos.length === 1) return conferirContra(db, candidatos[0], entrada, chave, cnpj, agoraISO);
  if (candidatos.length > 1) {
    return vazio(chave, cnpj, "escolher", "Há mais de um agendamento deste fornecedor. Escolha o da carga", { candidatos: candidatos.map(candidatoDe) });
  }
  return vazio(chave, cnpj, "sem_agendamento", "Sem agendamento para esta nota");
}
