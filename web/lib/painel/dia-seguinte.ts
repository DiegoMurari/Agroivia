/**
 * Efetivo do dia seguinte e texto do aviso ao prestador (grupo 2).
 * A necessidade vem dos agendamentos `teste` ou `operacao` da data e da norma de chapas (norma.ts):
 * por agendamento vale o maior entre as NF; agendamentos do MESMO horário somam (duas equipes);
 * no dia, e em cada armazém, vale o maior entre os horários.
 * Peso ou acondicionamento incertos viram faixa. Só leitura; sem relógio: quem chama informa a data.
 */
import { inArray } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { decOuNulo, paraTexto } from "@/lib/money";
import { faixaDaCarga, type ComponenteIncerto, type Faixa, type LinhaNorma, type Necessidade, type Perfil } from "./norma";

export interface NecessidadeAgendamento {
  id: number;
  horario: string;
  origem: string;
  minimo: Necessidade;
  maximo: Necessidade;
}

export interface NecessidadeArmazem {
  /** Null = agendamento sem destino definido. */
  armazemId: number | null;
  nome: string;
  minimo: Necessidade;
  maximo: Necessidade;
}

export interface NecessidadeHorario {
  horario: string;
  agendamentos: number;
  minimo: Necessidade;
  maximo: Necessidade;
  porArmazem: NecessidadeArmazem[];
}

export interface NecessidadeDoDia {
  data: string;
  agendamentos: number;
  origens: ("teste" | "operacao")[];
  minimo: Necessidade;
  maximo: Necessidade;
  /** NF sem peso conhecido (líquido e bruto ausentes ou ilegíveis), contadas uma vez cada. */
  semPeso: number;
  /** Agendamentos sem nenhuma NF ligada: a necessidade deles é desconhecida e entra na faixa cheia. */
  semNf: number;
  porAgendamento: NecessidadeAgendamento[];
  /** Soma dos agendamentos de cada horário. */
  porHorario: NecessidadeHorario[];
  /** Maior necessidade de cada armazém entre os horários do dia. */
  porArmazem: NecessidadeArmazem[];
  /** Horário de maior necessidade (empate: o mais cedo); null sem agendamento. */
  picoHorario: string | null;
}

const ZERO_NEC: Necessidade = { chapas: 0, empilhadeira: false };
const somarNec = (a: Necessidade, b: Necessidade): Necessidade => ({ chapas: a.chapas + b.chapas, empilhadeira: a.empilhadeira || b.empilhadeira });
const maiorNec = (a: Necessidade, b: Necessidade): Necessidade => ({ chapas: Math.max(a.chapas, b.chapas), empilhadeira: a.empilhadeira || b.empilhadeira });
const SEM_DESTINO = "Sem destino definido";

const IGNORADOS = ["cancelado", "nao_recebido"];
/** Pedido do portal em rascunho ou recusado não ocupa a agenda: fica fora da previsão. */
const APROVACAO_NA_PREVISAO = ["aguardando", "aprovado"];

/** Soma um dia a uma data YYYY-MM-DD (calendário puro, sem relógio). */
export function dataSeguinte(hoje: string): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function necessidadeDoDia(db: Db, data: string, perfil: Perfil = "agrovia"): NecessidadeDoDia {
  const norma: LinhaNorma[] = db
    .select()
    .from(schema.normaChapas)
    .all()
    .map((n) => ({ perfil: n.perfil, acondicionamento: n.acondicionamento, pesoMinKgExclusivo: n.pesoMinKgExclusivo, chapas: n.chapas, empilhadeira: n.empilhadeira }));

  const ags = db
    .select()
    .from(schema.agendamento)
    .all()
    .filter((a) => a.data === data && (a.origem === "teste" || a.origem === "operacao") && !IGNORADOS.includes(a.status) && APROVACAO_NA_PREVISAO.includes(a.aprovacao))
    .sort((a, b) => a.horario.localeCompare(b.horario) || a.id - b.id);

  const ids = ags.map((a) => a.id);
  const ligacoes = ids.length ? db.select().from(schema.agendamentoNf).where(inArray(schema.agendamentoNf.agendamentoId, ids)).all() : [];
  const destinosPorAg = new Map<number, number[]>();
  for (const d of ids.length ? db.select().from(schema.agendamentoArmazem).where(inArray(schema.agendamentoArmazem.agendamentoId, ids)).all() : []) {
    destinosPorAg.set(d.agendamentoId, [...(destinosPorAg.get(d.agendamentoId) ?? []), d.armazemId]);
  }
  // Sem destino gravado, o armazém é sugerido pelos itens da NF (armazém do produto, D16 e D39).
  const armazemDoProduto = new Map(db.select({ id: schema.produto.id, armazemId: schema.produto.armazemId }).from(schema.produto).all().map((p) => [p.id, p.armazemId]));
  const itensPorNf = new Map<number, number[]>();
  for (const i of db.select().from(schema.notaFiscalItem).all()) {
    const arm = i.produtoId === null ? null : (armazemDoProduto.get(i.produtoId) ?? null);
    if (arm !== null) itensPorNf.set(i.notaFiscalId, [...(itensPorNf.get(i.notaFiscalId) ?? []), arm]);
  }
  const nomes = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a.nome]));
  const nfs = new Map(db.select().from(schema.notaFiscal).all().map((n) => [n.id, n]));

  const semPesoIds = new Set<number>();
  let semNf = 0;
  const faixaDoAg = new Map<number, Faixa>();
  const porAgendamento: NecessidadeAgendamento[] = ags.map((a) => {
    const componentes: ComponenteIncerto[] = ligacoes
      .filter((l) => l.agendamentoId === a.id)
      .map((l) => {
        const nf = nfs.get(l.notaFiscalId);
        const peso = decOuNulo(nf?.pesoLiquidoKg) ?? decOuNulo(nf?.pesoBrutoKg);
        if (peso === null) semPesoIds.add(l.notaFiscalId);
        return { acondicionamento: l.acondicionamento, pesoKg: peso === null ? null : paraTexto(peso) };
      });
    // Sem NF ligada o acondicionamento é desconhecido: faixa cheia (mínimo 0, máximo da norma), nunca "0 funcionários".
    if (componentes.length === 0) {
      semNf++;
      componentes.push({ acondicionamento: null, pesoKg: null });
    }
    const f = faixaDaCarga(componentes, norma, { perfil });
    faixaDoAg.set(a.id, f);
    return { id: a.id, horario: a.horario, origem: a.origem, minimo: f.minimo, maximo: f.maximo };
  });

  // Mesmo horário soma; entre horários vale o maior (no dia e em cada armazém).
  const horarios = new Map<string, NecessidadeHorario>();
  for (const a of ags) {
    const f = faixaDoAg.get(a.id)!;
    const h = horarios.get(a.horario) ?? { horario: a.horario, agendamentos: 0, minimo: ZERO_NEC, maximo: ZERO_NEC, porArmazem: [] };
    h.agendamentos++;
    h.minimo = somarNec(h.minimo, f.minimo);
    h.maximo = somarNec(h.maximo, f.maximo);
    const gravados = destinosPorAg.get(a.id);
    const sugeridos = [...new Set(ligacoes.filter((l) => l.agendamentoId === a.id).flatMap((l) => itensPorNf.get(l.notaFiscalId) ?? []))].sort((x, y) => x - y);
    const destinos: (number | null)[] = gravados?.length ? gravados : sugeridos.length ? sugeridos : [null];
    for (const d of destinos) {
      const nome = d === null ? SEM_DESTINO : (nomes.get(d) ?? `armazém ${d}`);
      const atual = h.porArmazem.find((x) => x.armazemId === d);
      if (atual) {
        atual.minimo = somarNec(atual.minimo, f.minimo);
        atual.maximo = somarNec(atual.maximo, f.maximo);
      } else h.porArmazem.push({ armazemId: d, nome, minimo: f.minimo, maximo: f.maximo });
    }
    horarios.set(a.horario, h);
  }
  const porHorario = [...horarios.values()].sort((x, y) => x.horario.localeCompare(y.horario));
  const porArmazem: NecessidadeArmazem[] = [];
  for (const h of porHorario) {
    for (const a of h.porArmazem) {
      const atual = porArmazem.find((x) => x.armazemId === a.armazemId);
      if (atual) {
        atual.minimo = maiorNec(atual.minimo, a.minimo);
        atual.maximo = maiorNec(atual.maximo, a.maximo);
      } else porArmazem.push({ ...a });
    }
  }
  porArmazem.sort((x, y) => (x.armazemId ?? Number.MAX_SAFE_INTEGER) - (y.armazemId ?? Number.MAX_SAFE_INTEGER));
  const pico = porHorario.reduce<NecessidadeHorario | null>((m, h) => (m === null || h.maximo.chapas > m.maximo.chapas ? h : m), null);
  return {
    data,
    agendamentos: ags.length,
    origens: [...new Set(ags.map((a) => a.origem as "teste" | "operacao"))].sort(),
    minimo: porHorario.reduce(( t, h) => maiorNec(t, h.minimo), ZERO_NEC),
    maximo: porHorario.reduce((t, h) => maiorNec(t, h.maximo), ZERO_NEC),
    semPeso: semPesoIds.size,
    semNf,
    porAgendamento,
    porHorario,
    porArmazem,
    picoHorario: pico?.horario ?? null,
  };
}

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const chapas = (n: number) => `${n} ${n === 1 ? "funcionário" : "funcionários"}`;
const empilhadeira = (n: Necessidade) => (n.empilhadeira ? "com empilhadeira" : "sem empilhadeira");

/** Frase pronta para copiar e enviar ao prestador. `rotulo` (por exemplo "Amanhã") abre a frase; sem ele vale "Em". */
export function textoAvisoPrestador(n: NecessidadeDoDia, opcoes: { rotulo?: string } = {}): string {
  const data = dataBR(n.data);
  const abertura = opcoes.rotulo ? `${opcoes.rotulo}, ${data}` : `Em ${data}`;
  if (n.agendamentos === 0) return `${abertura}: não há recebimentos agendados. Nenhum funcionário é necessária.`;
  const faixa = !(n.minimo.chapas === n.maximo.chapas && n.minimo.empilhadeira === n.maximo.empilhadeira);
  const quanto = faixa ? `${n.minimo.chapas} a ${chapas(n.maximo.chapas)}` : chapas(n.maximo.chapas);
  const pico = n.porHorario.find((h) => h.horario === n.picoHorario);
  const aPartir = pico ? ` a partir das ${pico.horario}` : "";
  const armazens = pico
    ? ` (${pico.porArmazem.map((a) => `${a.nome} ${a.minimo.chapas === a.maximo.chapas ? a.maximo.chapas : `${a.minimo.chapas} a ${a.maximo.chapas}`}`).join(", ")})`
    : "";
  const horaEmp = n.porHorario.find((h) => h.maximo.empilhadeira)?.horario;
  const empDoPico = pico ? pico.maximo.empilhadeira : n.maximo.empilhadeira;
  let emp = faixa ? (empDoPico ? "possivelmente com empilhadeira" : "sem empilhadeira") : empilhadeira({ chapas: 0, empilhadeira: empDoPico });
  if (pico && !empDoPico && horaEmp) emp += `; empilhadeira necessária às ${horaEmp}`;
  const base = `${abertura}: precisamos de ${quanto}${aPartir}${armazens}, ${emp}. Recebimentos agendados: ${n.agendamentos}.`;
  return faixa ? `${base} O peso ou o acondicionamento de alguma NF ainda não está confirmado, por isso a necessidade é uma faixa.` : base;
}
