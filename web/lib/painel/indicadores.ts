/**
 * Indicadores do painel (A7): cargas por dia e armazém (RF3-01) e custo (RF3-09).
 * Leitura apenas. Contagens são inteiras; dinheiro vem de sobra-falta.ts e é somado com lib/money.
 * Origem `historico` em tudo: não existe aqui nenhum número sem origem.
 */
import { schema, type Db } from "@/lib/db";
import { comparar, dec, deInteiro, dividir, somar, type Valor, ZERO } from "@/lib/money";
import { dataNoFiltro, lerParametros, resumoHistorico, rotuloDoFiltro, type Filtro, type ResumoHistorico } from "./consultas";

export const AVISO_CARGAS =
  "Caminhão histórico = linhas do mesmo fornecedor na mesma data de recebimento. É uma aproximação e tende a contar mais caminhões do que a realidade: um caminhão pode trazer mais de uma NF, e fornecedores distintos no mesmo dia podem ser fretes fracionados.";

export interface CargasArmazemDia {
  armazemId: number;
  nome: string;
  cargas: number;
}

export interface CargasDoDia {
  data: string;
  /** Cargas distintas do dia; uma carga em dois armazéns conta uma vez aqui. */
  total: number;
  porArmazem: CargasArmazemDia[];
}

export interface CargasArmazemPeriodo {
  armazemId: number;
  nome: string;
  cargas: number;
  mediaPorDia: Valor;
}

export interface CargasPorDia {
  origem: "historico";
  rotulo: string;
  aviso: string;
  dias: CargasDoDia[];
  diasComRecebimento: number;
  totalCargas: number;
  /** Cargas por dia com recebimento (não por dia do calendário). */
  mediaPorDia: Valor;
  maximoPorDia: number;
  porArmazem: CargasArmazemPeriodo[];
}

/** RF3-01: cargas por dia e por armazém. Null quando o período não tem recebimento (sem dado, nunca zero). */
export function cargasPorDia(db: Db, filtro: Filtro): CargasPorDia | null {
  const { safraMeses } = lerParametros(db);
  const nomes = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a.nome]));
  const datas = new Map<number, string>();
  for (const c of db.select({ id: schema.histCarga.id, data: schema.histCarga.data }).from(schema.histCarga).all()) {
    if (c.data && dataNoFiltro(c.data, filtro, safraMeses)) datas.set(c.id, c.data);
  }
  if (datas.size === 0) return null;

  const porDia = new Map<string, { total: number; armazens: Map<number, number> }>();
  for (const [, data] of datas) {
    const d = porDia.get(data) ?? { total: 0, armazens: new Map<number, number>() };
    d.total++;
    porDia.set(data, d);
  }
  for (const l of db
    .select({ cargaId: schema.histCargaArmazem.histCargaId, armazemId: schema.histCargaArmazem.armazemId })
    .from(schema.histCargaArmazem)
    .all()) {
    const data = datas.get(l.cargaId);
    if (!data) continue;
    const d = porDia.get(data)!;
    d.armazens.set(l.armazemId, (d.armazens.get(l.armazemId) ?? 0) + 1);
  }

  const dias: CargasDoDia[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, d]) => ({
      data,
      total: d.total,
      porArmazem: [...d.armazens.entries()]
        .sort(([a], [b]) => a - b)
        .map(([armazemId, cargas]) => ({ armazemId, nome: nomes.get(armazemId) ?? `armazém ${armazemId}`, cargas })),
    }));

  const totalPorArmazem = new Map<number, number>();
  for (const d of dias) for (const a of d.porArmazem) totalPorArmazem.set(a.armazemId, (totalPorArmazem.get(a.armazemId) ?? 0) + a.cargas);
  const n = deInteiro(dias.length);

  return {
    origem: "historico",
    rotulo: rotuloDoFiltro(filtro),
    aviso: AVISO_CARGAS,
    dias,
    diasComRecebimento: dias.length,
    totalCargas: datas.size,
    mediaPorDia: dividir(deInteiro(datas.size), n),
    maximoPorDia: Math.max(...dias.map((d) => d.total)),
    porArmazem: [...totalPorArmazem.entries()]
      .sort(([a], [b]) => a - b)
      .map(([armazemId, cargas]) => ({
        armazemId,
        nome: nomes.get(armazemId) ?? `armazém ${armazemId}`,
        cargas,
        mediaPorDia: dividir(deInteiro(cargas), n),
      })),
  };
}

export interface CustoMes {
  anoMes: string;
  diasConsiderados: number;
  custoTotal: Valor;
  custoMedioPorDia: Valor;
}

export interface CustoPeriodo {
  origem: "historico";
  rotulo: string;
  aviso: string;
  diasConsiderados: number;
  /** Soma do custo do dia (D31): maior entre piso x efetivo e a produção estimada. */
  custoTotal: Valor;
  custoMedioPorDia: Valor;
  /** Dinheiro pago sem produção correspondente (excesso em reais, total do período). */
  complementoTotal: Valor;
  /** Produção acima do que o efetivo cobre ao piso (falta em reais, total do período). */
  faltaReaisTotal: Valor;
  producaoTotal: Valor;
  meses: CustoMes[];
}

/** RF3-09: custo estimado do histórico, pela fórmula do boletim aplicada a cada dia comparável. Null se não há dia comparável. */
export function custoDoPeriodo(db: Db, filtro: Filtro, historico?: ResumoHistorico): CustoPeriodo | null {
  const h = historico ?? resumoHistorico(db, filtro);
  const r = h.resumo;
  if (!r) return null;
  return {
    origem: "historico",
    rotulo: h.rotulo,
    aviso: h.aviso,
    diasConsiderados: r.diasConsiderados,
    custoTotal: r.custoTotal,
    custoMedioPorDia: dividir(r.custoTotal, deInteiro(r.diasConsiderados)),
    complementoTotal: r.excessoReaisTotal,
    faltaReaisTotal: r.faltaReaisTotal,
    producaoTotal: r.producaoTotal,
    meses: h.meses
      .filter((m) => m.resumo !== null)
      .map((m) => ({
        anoMes: m.anoMes,
        diasConsiderados: m.resumo!.diasConsiderados,
        custoTotal: m.resumo!.custoTotal,
        custoMedioPorDia: dividir(m.resumo!.custoTotal, deInteiro(m.resumo!.diasConsiderados)),
      })),
  };
}

export interface FornecedorPeso {
  codPn: string;
  nome: string;
  pesoKg: Valor;
  /** Parte do peso conhecido de todos os fornecedores do período (0 a 1). */
  participacao: Valor;
  linhas: number;
}

export interface FornecedoresPorPeso {
  origem: "historico";
  rotulo: string;
  aviso: string;
  fornecedores: FornecedorPeso[];
  /** Peso conhecido de todos os fornecedores do período (base da participação). */
  pesoTotalKg: Valor;
  /** Linhas consideradas sem peso utilizável (peso suspeito, zero ou ausente): ficam fora do ranking. */
  linhasSemPeso: number;
  /** Linhas consideradas com peso mas sem código de fornecedor: ficam fora do ranking e da base da participação. */
  linhasSemFornecedor: number;
}

export const AVISO_PESO =
  "Peso da linha vindo do recebimento (TON = quantidade x 1.000 kg, KG = quantidade; peso da NF só em nota de uma linha). Linhas com peso suspeito, zero ou ausente, e linhas sem código de fornecedor, ficam fora do ranking e são contadas ao lado.";

/** RF3-06: fornecedores com maior volume por peso. Soma no código; só linhas consideradas. Null sem nenhuma linha com peso. */
export function fornecedoresPorPeso(db: Db, filtro: Filtro, limite = 10): FornecedoresPorPeso | null {
  const { safraMeses } = lerParametros(db);
  const porForn = new Map<string, { nome: string; pesos: Valor[]; linhas: number }>();
  let linhasSemPeso = 0;
  let linhasSemFornecedor = 0;
  const linhas = db
    .select({
      considerada: schema.histMovimentacao.considerada,
      data: schema.histMovimentacao.dataRecebimento,
      codPn: schema.histMovimentacao.codPn,
      nome: schema.histMovimentacao.nomePn,
      pesoKg: schema.histMovimentacao.pesoKg,
    })
    .from(schema.histMovimentacao)
    .all();
  for (const l of linhas) {
    if (!l.considerada || !l.data || !dataNoFiltro(l.data, filtro, safraMeses)) continue;
    if (l.pesoKg === null || dec(l.pesoKg).isZero()) {
      linhasSemPeso++;
      continue;
    }
    if (!l.codPn) {
      linhasSemFornecedor++;
      continue;
    }
    const f = porForn.get(l.codPn) ?? { nome: l.nome ?? `fornecedor ${l.codPn}`, pesos: [], linhas: 0 };
    f.pesos.push(dec(l.pesoKg));
    f.linhas++;
    porForn.set(l.codPn, f);
  }
  if (porForn.size === 0) return null;
  const todos = [...porForn.entries()].map(([codPn, f]) => ({ codPn, nome: f.nome, pesoKg: somar(...f.pesos), linhas: f.linhas }));
  const pesoTotalKg = somar(...todos.map((f) => f.pesoKg));
  const ranking = todos
    .sort((a, b) => comparar(b.pesoKg, a.pesoKg) || a.codPn.localeCompare(b.codPn))
    .slice(0, limite)
    .map((f) => ({ ...f, participacao: pesoTotalKg.isZero() ? ZERO : dividir(f.pesoKg, pesoTotalKg) }));
  return { origem: "historico", rotulo: rotuloDoFiltro(filtro), aviso: AVISO_PESO, fornecedores: ranking, pesoTotalKg, linhasSemPeso, linhasSemFornecedor };
}

export interface DiaDeMovimento {
  data: string;
  cargas: number;
  /** 0 = domingo ... 6 = sábado. */
  diaDaSemana: number;
}

export interface DiasDeMaiorMovimento {
  origem: "historico";
  rotulo: string;
  aviso: string;
  dias: DiaDeMovimento[];
  /** Horários não existem no histórico (a planilha só tem a data): vêm só dos agendamentos `teste` ou `operacao`. */
  horarios: "sem_dado_no_historico";
}

/** RF3-07: dias de maior movimento, por número de cargas (empate: data mais antiga). Null sem recebimento. */
export function diasDeMaiorMovimento(db: Db, filtro: Filtro, limite = 10, cargas?: CargasPorDia | null): DiasDeMaiorMovimento | null {
  const c = cargas === undefined ? cargasPorDia(db, filtro) : cargas;
  if (!c) return null;
  const dias = [...c.dias]
    .sort((a, b) => b.total - a.total || a.data.localeCompare(b.data))
    .slice(0, limite)
    .map((d) => ({ data: d.data, cargas: d.total, diaDaSemana: new Date(`${d.data}T12:00:00Z`).getUTCDay() }));
  return { origem: "historico", rotulo: c.rotulo, aviso: c.aviso, dias, horarios: "sem_dado_no_historico" };
}
