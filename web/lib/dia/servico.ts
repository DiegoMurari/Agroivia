/**
 * Tela dinâmica do dia (RF1-24b). Só LEITURA das tabelas de agendamento (da janela C).
 * Recebe `db` e o instante por parâmetro; o "há X min" sai daqui, nunca do relógio do navegador.
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { AgendamentoStatus } from "@/lib/db/enums";
import { paraTexto, somar } from "@/lib/money";
import { paraISO } from "@/lib/relogio";
import { chapasDaCarga, type Acondicionamento, type LinhaNorma, type Perfil } from "@/lib/painel/norma";
import { duracaoMediaMin } from "./resumo";

/** Peso desconhecido assume a norma cheia (mesma regra do agendamento): melhor reservar de mais do que faltar gente. */
const PESO_DESCONHECIDO = "1000000";

export interface AgendamentoDia {
  id: number;
  horario: string;
  status: AgendamentoStatus;
  fornecedor: string;
  placa: string | null;
  acondicionamento: string;
  armazens: string[];
  armazemIds: number[];
  /** Chapas pedidos para a carga: os do agendamento ou o maior da norma das NF. */
  chapasPedidas: number;
  /** Instante da chegada na portaria (ISO), se já chegou. */
  chegadaEm: string | null;
  /** Primeira entrada em galpão e última saída (ISO); nulos até acontecerem. */
  entradaEm: string | null;
  saidaEm: string | null;
  /** Duração real da descarga, em minutos, quando já concluiu. */
  duracaoMin: number | null;
  /** Minutos de atraso; só quando passou da tolerância (31 é atraso, 30 não). */
  atrasoMin: number | null;
}

export interface EquipamentoDoGalpao {
  id: number;
  nome: string;
  /** Falso em manutenção ou sem unidade disponível. */
  disponivel: boolean;
  /** Já usado na descarga ou sugerido pela carga (empilhadeira para paletes e big bag). */
  sugerido: boolean;
}

export interface NoPatio {
  agendamentoId: number;
  fornecedor: string;
  placa: string | null;
  chegadaEm: string | null;
  horario: string;
  carga: string;
  /** Galpões já definidos; vazio se ainda falta escolher. */
  galpoes: { id: number; nome: string }[];
}

export interface EmDescarga {
  agendamentoId: number;
  armazemId: number;
  horario: string;
  armazem: string;
  /** Chapas previstos: do agendamento ou da norma da carga. */
  chapasPrevistas: number;
  equipamentos: EquipamentoDoGalpao[];
  fornecedor: string;
  placa: string | null;
  entradaEm: string;
  haMin: number;
  /** Tipo de carga das NF: Batido, Paletizado... */
  carga: string;
  /** Nulo quando não há previsão (sem linha na norma). */
  previsaoFimEm: string | null;
  previsaoFonte: "agendamento" | "norma" | "media" | null;
}

export interface PendenciaAberta {
  id: number;
  agendamentoId: number;
  data: string;
  fornecedor: string;
  tipo: string;
  descricao: string | null;
  abertaEm: string;
}

export interface SituacaoDia {
  agora: string;
  hoje: string;
  toleranciaMin: number;
  agendamentos: AgendamentoDia[];
  galpoes: { id: number; nome: string }[];
  noPatio: NoPatio[];
  emDescarga: EmDescarga[];
  atrasados: AgendamentoDia[];
  pendencias: PendenciaAberta[];
}

/** Instante gravado como texto ISO com fuso: aceito `new Date(iso)` para somar minutos. */
function minutosEntre(deISO: string, ateISO: string): number {
  return Math.floor((new Date(ateISO).getTime() - new Date(deISO).getTime()) / 60000);
}

const ROTULO_CARGA: Record<string, string> = { batido: "Batido", paletizado: "Paletizado", big_bag: "Big bag" };

function parametroInt(db: Db, chave: string, padrao: number): number {
  const p = db.select().from(schema.parametro).where(eq(schema.parametro.chave, chave)).get();
  const n = p ? Number.parseInt(p.valor, 10) : Number.NaN;
  return Number.isFinite(n) ? n : padrao;
}

export function situacaoDoDia(db: Db, agoraISO: string): SituacaoDia {
  const hoje = agoraISO.slice(0, 10);
  const tolerancia = parametroInt(db, "tolerancia_min", 30);
  const perfilRow = db.select().from(schema.parametro).where(eq(schema.parametro.chave, "perfil_norma")).get();
  const perfil = perfilRow?.valor === "dossie" ? "dossie" : "agrovia";

  const fornecedores = new Map(db.select().from(schema.fornecedor).all().map((f) => [f.id, f.razaoSocial]));
  const armazens = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a.nome]));

  const doDia = db.select().from(schema.agendamento).where(eq(schema.agendamento.data, hoje)).all().filter((a) => a.aprovacao === "aprovado");
  const idsDoDia = doDia.map((a) => a.id);
  const armazensPorAgendamento = new Map<number, string[]>();
  const idsPorAgendamento = new Map<number, number[]>();
  const entradasPorAgendamento = new Map<number, string[]>();
  const saidasPorAgendamento = new Map<number, string[]>();
  if (idsDoDia.length) {
    for (const aa of db.select().from(schema.agendamentoArmazem).where(inArray(schema.agendamentoArmazem.agendamentoId, idsDoDia)).all().sort((x, y) => x.ordem - y.ordem)) {
      if (aa.entradaEm) entradasPorAgendamento.set(aa.agendamentoId, [...(entradasPorAgendamento.get(aa.agendamentoId) ?? []), aa.entradaEm]);
      if (aa.saidaEm) saidasPorAgendamento.set(aa.agendamentoId, [...(saidasPorAgendamento.get(aa.agendamentoId) ?? []), aa.saidaEm]);
      const lista = armazensPorAgendamento.get(aa.agendamentoId) ?? [];
      lista.push(armazens.get(aa.armazemId) ?? "");
      armazensPorAgendamento.set(aa.agendamentoId, lista);
      idsPorAgendamento.set(aa.agendamentoId, [...(idsPorAgendamento.get(aa.agendamentoId) ?? []), aa.armazemId]);
    }
  }

  const linhasNorma: LinhaNorma[] = db
    .select()
    .from(schema.normaChapas)
    .all()
    .map((n) => ({ perfil: n.perfil as Perfil, acondicionamento: n.acondicionamento as Acondicionamento, pesoMinKgExclusivo: n.pesoMinKgExclusivo, chapas: n.chapas, empilhadeira: n.empilhadeira }));
  const nfsDoDia = idsDoDia.length ? db.select().from(schema.agendamentoNf).where(inArray(schema.agendamentoNf.agendamentoId, idsDoDia)).all() : [];
  const notas = new Map(
    (nfsDoDia.length ? db.select().from(schema.notaFiscal).where(inArray(schema.notaFiscal.id, nfsDoDia.map((n) => n.notaFiscalId))).all() : []).map((n) => [n.id, n]),
  );
  /** Chapas da carga pela norma (por peso), o mesmo cálculo do agendamento; o valor gravado no agendamento vale primeiro. */
  const chapasDaNorma = (agendamentoId: number): { chapas: number; empilhadeira: boolean } => {
    const somas = new Map<Acondicionamento, string>();
    for (const n of nfsDoDia.filter((x) => x.agendamentoId === agendamentoId)) {
      const nota = notas.get(n.notaFiscalId);
      const a = n.acondicionamento as Acondicionamento;
      somas.set(a, paraTexto(somar(somas.get(a) ?? "0", nota?.pesoLiquidoKg ?? nota?.pesoBrutoKg ?? PESO_DESCONHECIDO)));
    }
    try {
      return chapasDaCarga([...somas].map(([acondicionamento, pesoKg]) => ({ acondicionamento, pesoKg })), linhasNorma, { perfil });
    } catch {
      return { chapas: 0, empilhadeira: false }; // norma sem linha: sem previsão
    }
  };
  const chapasPedidasDe = (a: (typeof doDia)[number]) => a.chapasPrevistas ?? chapasDaNorma(a.id).chapas;

  const agendamentos: AgendamentoDia[] = doDia
    .map((a) => {
      const atraso = a.status === "agendado" ? minutosEntre(`${a.data}T${a.horario}:00-03:00`, agoraISO) : 0;
      const entradaEm = [...(entradasPorAgendamento.get(a.id) ?? [])].sort()[0] ?? null;
      const saidaEm = [...(saidasPorAgendamento.get(a.id) ?? [])].sort().at(-1) ?? null;
      return {
        entradaEm,
        saidaEm,
        duracaoMin: entradaEm && saidaEm && a.status === "concluido" ? Math.max(0, minutosEntre(entradaEm, saidaEm)) : null,
        id: a.id,
        horario: a.horario,
        status: a.status,
        fornecedor: fornecedores.get(a.fornecedorId) ?? "Fornecedor não identificado",
        placa: a.placa,
        chegadaEm: a.chegadaEm,
        acondicionamento: a.acondicionamentoOcupacao,
        armazens: armazensPorAgendamento.get(a.id) ?? [],
        armazemIds: idsPorAgendamento.get(a.id) ?? [],
        chapasPedidas: chapasPedidasDe(a),
        atrasoMin: atraso > tolerancia ? atraso : null,
      };
    })
    .sort((x, y) => x.horario.localeCompare(y.horario) || x.id - y.id);

  // Em descarga: entrada registrada e sem saída, em carga ainda ativa.
  const norma = db.select().from(schema.normaChapas).where(eq(schema.normaChapas.perfil, perfil)).all();
  const emDescarga: EmDescarga[] = [];
  const equipamentosTodos = db.select().from(schema.equipamento).all();
  const ehEmpilhadeira = (n: string | null) => (n ?? "").toLowerCase().includes("empilhadeira");
  const mediaDescarga = duracaoMediaMin(db);
  const abertas = db
    .select()
    .from(schema.agendamentoArmazem)
    .where(and(isNotNull(schema.agendamentoArmazem.entradaEm), isNull(schema.agendamentoArmazem.saidaEm)))
    .all();
  for (const aa of abertas) {
    const a = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, aa.agendamentoId)).get();
    if (!a || a.data !== hoje || a.aprovacao !== "aprovado" || a.status === "cancelado" || a.status === "nao_recebido" || a.status === "concluido") continue;
    const nfs = db.select().from(schema.agendamentoNf).where(eq(schema.agendamentoNf.agendamentoId, a.id)).all();
    const duracoes = nfs.map((n) => norma.find((x) => x.acondicionamento === n.acondicionamento)?.duracaoMin).filter((d): d is number => typeof d === "number");
    let duracao: number | null = null;
    let fonte: EmDescarga["previsaoFonte"] = null;
    if (a.duracaoPrevistaMin !== null) {
      duracao = a.duracaoPrevistaMin;
      fonte = "agendamento";
    } else if (duracoes.length) {
      duracao = Math.max(...duracoes); // carga mista: a maior duração
      fonte = "norma";
    }
    if (duracao === null && mediaDescarga !== null) {
      duracao = mediaDescarga;
      fonte = "media";
    }
    const entrada = aa.entradaEm!;
    const usados = new Set(db.select().from(schema.descargaEquipamento).where(eq(schema.descargaEquipamento.agendamentoArmazemId, aa.id)).all().map((u) => u.equipamentoId));
    const pedeEmpilhadeira = Boolean(a.empilhadeiraPrevista) || chapasDaNorma(a.id).empilhadeira;
    const doGalpao = equipamentosTodos.filter((e) => e.armazemId === aa.armazemId).sort((x, y) => (x.nome ?? "").localeCompare(y.nome ?? "", "pt-BR"));
    const livre = (e: (typeof doGalpao)[number]) => e.status !== "manutencao" && e.disponivel > 0;
    const primeiraEmpilhadeira = doGalpao.find((e) => ehEmpilhadeira(e.nome) && livre(e));
    emDescarga.push({
      agendamentoId: a.id,
      armazemId: aa.armazemId,
      horario: a.horario,
      chapasPrevistas: chapasPedidasDe(a),
      equipamentos: doGalpao.map((e) => ({
        id: e.id,
        nome: e.nome ?? "Equipamento",
        disponivel: livre(e),
        sugerido: usados.has(e.id) || (pedeEmpilhadeira && primeiraEmpilhadeira?.id === e.id && usados.size === 0),
      })),
      armazem: armazens.get(aa.armazemId) ?? "",
      fornecedor: fornecedores.get(a.fornecedorId) ?? "Fornecedor não identificado",
      placa: a.placa,
      entradaEm: entrada,
      haMin: Math.max(0, minutosEntre(entrada, agoraISO)),
      carga: [...new Set(nfs.map((n) => ROTULO_CARGA[n.acondicionamento] ?? n.acondicionamento))].join(" e ") || "Carga sem NF",
      previsaoFimEm: duracao === null ? null : paraISO(new Date(new Date(entrada).getTime() + duracao * 60000)),
      previsaoFonte: fonte,
    });
  }
  emDescarga.sort((x, y) => x.entradaEm.localeCompare(y.entradaEm));

  const pendencias: PendenciaAberta[] = db
    .select()
    .from(schema.pendencia)
    .where(eq(schema.pendencia.status, "aberta"))
    .all()
    .filter((p) => db.select().from(schema.agendamento).where(eq(schema.agendamento.id, p.agendamentoId)).get()?.aprovacao === "aprovado")
    .map((p) => {
      const a = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, p.agendamentoId)).get();
      return {
        id: p.id,
        agendamentoId: p.agendamentoId,
        data: a?.data ?? "",
        fornecedor: a ? (fornecedores.get(a.fornecedorId) ?? "Fornecedor não identificado") : "",
        tipo: p.tipo,
        descricao: p.descricao,
        abertaEm: p.abertaEm,
      };
    })
    .sort((x, y) => x.abertaEm.localeCompare(y.abertaEm));

  const noPatio: NoPatio[] = doDia
    .filter((a) => a.status === "chegou")
    .map((a) => ({
      agendamentoId: a.id,
      fornecedor: fornecedores.get(a.fornecedorId) ?? "Fornecedor não identificado",
      placa: a.placa,
      chegadaEm: a.chegadaEm,
      horario: a.horario,
      carga: [...new Set(db.select().from(schema.agendamentoNf).where(eq(schema.agendamentoNf.agendamentoId, a.id)).all().map((n) => ROTULO_CARGA[n.acondicionamento] ?? n.acondicionamento))].join(" e ") || "Carga sem NF",
      galpoes: (idsPorAgendamento.get(a.id) ?? []).map((id) => ({ id, nome: armazens.get(id) ?? "" })),
    }))
    .sort((x, y) => (x.chegadaEm ?? "").localeCompare(y.chegadaEm ?? "") || x.agendamentoId - y.agendamentoId);
  const galpoes = db.select().from(schema.armazem).all().filter((g) => g.ativo && g.recebeDescarga).sort((x, y) => x.ordem - y.ordem).map((g) => ({ id: g.id, nome: g.nome }));

  return { agora: agoraISO, hoje, toleranciaMin: tolerancia, agendamentos, galpoes, noPatio, emDescarga, atrasados: agendamentos.filter((a) => a.atrasoMin !== null), pendencias };
}
