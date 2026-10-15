/**
 * Régua do boletim (D29, D30, D31): a conta que a Agrovia já paga, aplicada ao dia.
 *
 *   diárias justificadas = produção do dia ÷ piso
 *   saldo                = efetivo - diárias justificadas      (mais = excesso, menos = falta)
 *   excesso em reais     = piso × efetivo - produção           (é o complemento de diária do boletim)
 *   falta em reais       = produção - piso × efetivo
 *
 * Funções puras, sem banco. Dinheiro, peso e quantidade só por `lib/money.ts`, sem arredondar no cálculo.
 * A palavra de saída é "excesso" ou "falta" (como a Agrovia fala); "equilibrio" quando fecha exato.
 */
import type { ConversaoProducao, Origem, PeriodoSemDadoTipo } from "@/lib/db/enums";
import { ZERO, comparar, deInteiro, dec, dividir, maior, multiplicar, somar, subtrair, type Entrada, type Valor } from "@/lib/money";

export type Rotulo = "excesso" | "falta" | "equilibrio";

/** Peso da saca de fertilizante do boletim (D29). */
export const PESO_SACA_KG = "50";

function exigirPiso(piso: Entrada): Valor {
  const p = dec(piso);
  if (!p.gt(0)) throw new Error("Piso da diária precisa ser maior que zero.");
  return p;
}

/** Diárias que a produção do dia paga ao piso (pode ter casas). */
export function diariasJustificadas(producao: Entrada, piso: Entrada): Valor {
  return dividir(producao, exigirPiso(piso));
}

/**
 * Efetivo do dia na folha: presentes menos a operação de café (D18, o café está contido em presentes).
 * Café maior que presentes (ou valor negativo) é linha inconsistente: marca e não devolve efetivo.
 */
export function efetivoDoDia(presentes: number, cafe: number): { efetivo: Valor | null; inconsistente: boolean } {
  const valido = Number.isInteger(presentes) && Number.isInteger(cafe) && presentes >= 0 && cafe >= 0 && cafe <= presentes;
  if (!valido) return { efetivo: null, inconsistente: true };
  return { efetivo: deInteiro(presentes - cafe), inconsistente: false };
}

function rotuloDe(sinal: -1 | 0 | 1): Rotulo {
  return sinal > 0 ? "excesso" : sinal < 0 ? "falta" : "equilibrio";
}

/** Saldo em chapas: efetivo menos diárias justificadas, com a palavra. */
export function saldoDeDiarias(efetivo: Entrada, justificadas: Entrada): { saldo: Valor; rotulo: Rotulo } {
  const saldo = subtrair(efetivo, justificadas);
  return { saldo, rotulo: rotuloDe(comparar(saldo, ZERO)) };
}

/** Reais de um saldo em chapas: sempre |saldo| × piso (P2). */
export function reaisDoSaldo(saldo: Entrada, piso: Entrada): Valor {
  return multiplicar(dec(saldo).abs(), exigirPiso(piso));
}

export interface AvaliacaoDia {
  efetivo: Valor;
  producao: Valor;
  justificadas: Valor;
  /** Positivo = excesso, negativo = falta. */
  saldo: Valor;
  rotulo: Rotulo;
  /** |saldo| em reais, exato (não passa pela divisão). */
  reais: Valor;
  excessoReais: Valor;
  faltaReais: Valor;
  /** D31: o maior entre piso × efetivo e a produção. */
  custo: Valor;
}

/** Avalia um dia: o sinal e os reais saem de piso × efetivo - produção, exatos; o saldo em chapas divide por último. */
export function avaliarDia(d: { efetivo: Entrada; producao: Entrada; piso: Entrada }): AvaliacaoDia {
  const piso = exigirPiso(d.piso);
  const efetivo = dec(d.efetivo);
  const producao = dec(d.producao);
  if (efetivo.isNegative() || producao.isNegative()) throw new Error("Efetivo e produção não podem ser negativos.");
  const pago = multiplicar(piso, efetivo);
  const diferenca = subtrair(pago, producao);
  const rotulo = rotuloDe(comparar(diferenca, ZERO));
  return {
    efetivo,
    producao,
    justificadas: dividir(producao, piso),
    saldo: dividir(diferenca, piso),
    rotulo,
    reais: diferenca.abs(),
    excessoReais: rotulo === "excesso" ? diferenca : ZERO,
    faltaReais: rotulo === "falta" ? diferenca.abs() : ZERO,
    custo: maior(pago, producao),
  };
}

export type MotivoSemProducao = "sem_preco" | "sem_quantidade";

export interface ProducaoEstimada {
  /** Unidades do boletim (sacas ou unidades). */
  quantidadeBoletim: Valor | null;
  /** Quantidade × preço do tipo; null quando falta preço ou quantidade. */
  producao: Valor | null;
  motivoSem?: MotivoSemProducao;
}

/**
 * Produção estimada de um grupo (D29): `saca_50kg` = peso ÷ 50 kg; `unidade` = a quantidade recebida.
 * Preço do tipo do grupo (`tipo_item.preco_unitario`); grupo sem tipo fica sem preço e o motivo é devolvido.
 */
export function producaoEstimada(e: {
  conversao: ConversaoProducao;
  pesoKg: Entrada | null;
  quantidade: Entrada | null;
  preco: Entrada | null;
}): ProducaoEstimada {
  const base = e.conversao === "saca_50kg" ? e.pesoKg : e.quantidade;
  if (base === null || base === undefined) return { quantidadeBoletim: null, producao: null, motivoSem: "sem_quantidade" };
  const quantidadeBoletim = e.conversao === "saca_50kg" ? dividir(base, PESO_SACA_KG) : dec(base);
  if (e.preco === null || e.preco === undefined) return { quantidadeBoletim, producao: null, motivoSem: "sem_preco" };
  return { quantidadeBoletim, producao: multiplicar(quantidadeBoletim, e.preco) };
}

// ---------------------------------------------------------------------------------------------
// Série diária e agregação por período
// ---------------------------------------------------------------------------------------------

export interface DiaEntrada {
  /** YYYY-MM-DD (D35). */
  data: string;
  origem: Origem;
  /** Diárias equivalentes (meia = 0,5) ou presentes menos café. Null quando a folha não vale. */
  efetivo: Entrada | null;
  /** Produção do dia (estimada no histórico, do boletim nos dados novos). Null quando não há recebimento comparável. */
  producao: Entrada | null;
  inconsistente?: boolean;
}

export interface DiaAvaliado extends AvaliacaoDia {
  data: string;
  origem: Origem;
}

export function avaliarDias(
  dias: DiaEntrada[],
  piso: Entrada,
): { avaliados: DiaAvaliado[]; inconsistentes: number; semProducao: number } {
  const avaliados: DiaAvaliado[] = [];
  let inconsistentes = 0;
  let semProducao = 0;
  for (const d of dias) {
    if (d.inconsistente || d.efetivo === null) {
      inconsistentes++;
      continue;
    }
    if (d.producao === null) {
      semProducao++;
      continue;
    }
    avaliados.push({ data: d.data, origem: d.origem, ...avaliarDia({ efetivo: d.efetivo, producao: d.producao, piso }) });
  }
  return { avaliados, inconsistentes, semProducao };
}

export interface ResumoPico {
  /** Como o pico é definido: os 10% dos dias de maior produção do período. */
  criterio: string;
  dias: number;
  faltaMediaChapas: Valor;
  /** Mediana da falta nos dias de pico: resiste a linhas atípicas (por exemplo, sachês contados como unidade). */
  faltaMedianaChapas: Valor;
  excessoMedioChapas: Valor;
  faltaReaisMedia: Valor;
  excessoReaisMedio: Valor;
}

function mediana(valores: Valor[]): Valor {
  const ordem = [...valores].sort((a, b) => comparar(a, b));
  const meio = ordem.length >> 1;
  return ordem.length % 2 ? ordem[meio] : dividir(somar(ordem[meio - 1], ordem[meio]), "2");
}

export interface Resumo {
  origem: Origem;
  diasConsiderados: number;
  diasExcesso: number;
  diasFalta: number;
  diasEquilibrio: number;
  /** Linhas fora da conta por folha inconsistente (café maior que presentes etc.). */
  inconsistentes: number;
  /** Dias com folha e sem recebimento comparável. */
  semProducao: number;
  /** Médias por dia comparado; dia sem excesso conta zero no excesso (e vice-versa). */
  excessoMedioChapas: Valor;
  faltaMediaChapas: Valor;
  saldoMedioChapas: Valor;
  /** Média só entre os dias em que houve excesso (ou falta); null se nenhum. */
  excessoMedioNosDiasComExcesso: Valor | null;
  faltaMediaNosDiasComFalta: Valor | null;
  excessoReaisTotal: Valor;
  faltaReaisTotal: Valor;
  excessoReaisMedio: Valor;
  faltaReaisMedia: Valor;
  efetivoMedio: Valor;
  producaoTotal: Valor;
  custoTotal: Valor;
  pico: ResumoPico;
}

export const CRITERIO_PICO =
  "dias de maior produção estimada (10% do período, no mínimo um dia; em empate entra a data mais antiga)";

function media(soma: Valor, n: number): Valor {
  return dividir(soma, deInteiro(n));
}

function somaDe(valores: Valor[]): Valor {
  return somar(...valores);
}

function resumirPico(avaliados: DiaAvaliado[]): ResumoPico {
  const quantos = Math.max(1, Math.floor((avaliados.length + 9) / 10)); // teto de 10% em inteiro puro
  const ordem = [...avaliados].sort((a, b) => comparar(b.producao, a.producao) || a.data.localeCompare(b.data));
  const pico = ordem.slice(0, quantos);
  const faltas = pico.map((d) => (d.rotulo === "falta" ? d.saldo.abs() : ZERO));
  const excessos = pico.map((d) => (d.rotulo === "excesso" ? d.saldo : ZERO));
  return {
    criterio: CRITERIO_PICO,
    dias: pico.length,
    faltaMediaChapas: media(somaDe(faltas), pico.length),
    faltaMedianaChapas: mediana(faltas),
    excessoMedioChapas: media(somaDe(excessos), pico.length),
    faltaReaisMedia: media(somaDe(pico.map((d) => d.faltaReais)), pico.length),
    excessoReaisMedio: media(somaDe(pico.map((d) => d.excessoReais)), pico.length),
  };
}

/**
 * Resume um período de uma única origem (P6: origens diferentes não se somam; use `resumirPorOrigem`).
 * Devolve null quando não há nenhum dia comparável: "sem dado" nunca vira zero (P4).
 */
export function resumirPeriodo(dias: DiaEntrada[], piso: Entrada): Resumo | null {
  const origens = new Set(dias.map((d) => d.origem));
  if (origens.size > 1) {
    throw new Error(`Origens misturadas no mesmo resumo (${[...origens].join(", ")}): resuma cada origem à parte.`);
  }
  const { avaliados, inconsistentes, semProducao } = avaliarDias(dias, piso);
  if (avaliados.length === 0) return null;
  const n = avaliados.length;
  const excessos = avaliados.filter((d) => d.rotulo === "excesso");
  const faltas = avaliados.filter((d) => d.rotulo === "falta");
  const sExcesso = somaDe(excessos.map((d) => d.saldo));
  const sFalta = somaDe(faltas.map((d) => d.saldo.abs()));
  const rExcesso = somaDe(avaliados.map((d) => d.excessoReais));
  const rFalta = somaDe(avaliados.map((d) => d.faltaReais));
  return {
    origem: avaliados[0].origem,
    diasConsiderados: n,
    diasExcesso: excessos.length,
    diasFalta: faltas.length,
    diasEquilibrio: n - excessos.length - faltas.length,
    inconsistentes,
    semProducao,
    excessoMedioChapas: media(sExcesso, n),
    faltaMediaChapas: media(sFalta, n),
    saldoMedioChapas: media(subtrair(sExcesso, sFalta), n),
    excessoMedioNosDiasComExcesso: excessos.length ? media(sExcesso, excessos.length) : null,
    faltaMediaNosDiasComFalta: faltas.length ? media(sFalta, faltas.length) : null,
    excessoReaisTotal: rExcesso,
    faltaReaisTotal: rFalta,
    excessoReaisMedio: media(rExcesso, n),
    faltaReaisMedia: media(rFalta, n),
    efetivoMedio: media(somaDe(avaliados.map((d) => d.efetivo)), n),
    producaoTotal: somaDe(avaliados.map((d) => d.producao)),
    custoTotal: somaDe(avaliados.map((d) => d.custo)),
    pico: resumirPico(avaliados),
  };
}

/** Um resumo por origem, cada um rotulado. Origem sem dia comparável não aparece. */
export function resumirPorOrigem(dias: DiaEntrada[], piso: Entrada): { origem: Origem; resumo: Resumo }[] {
  const grupos = new Map<Origem, DiaEntrada[]>();
  for (const d of dias) (grupos.get(d.origem) ?? grupos.set(d.origem, []).get(d.origem)!).push(d);
  const saida: { origem: Origem; resumo: Resumo }[] = [];
  for (const [origem, lista] of grupos) {
    const resumo = resumirPeriodo(lista, piso);
    if (resumo) saida.push({ origem, resumo });
  }
  return saida;
}

export type StatusMes = "ok" | PeriodoSemDadoTipo;

export interface MesResumo {
  anoMes: string;
  status: StatusMes;
  /** Null quando o mês é sem dado ou parcial: fica de fora das médias. */
  resumo: Resumo | null;
}

export interface ResumoMeses {
  meses: MesResumo[];
  /** Resumo dos dias dos meses com dado (média por dia, só dos meses ok). Null se nenhum mês tem dado. */
  periodo: Resumo | null;
  mesesComDado: number;
  mesesForaDasMedias: number;
}

/**
 * Resume um período mês a mês (P4). `statusMes` vem de `hist_periodo_sem_dado` (sem_dado ou parcial).
 * Mês pedido sem marca e sem nenhum dia comparável também é "sem_dado". Uma única origem por chamada.
 */
export function resumirMeses(
  dias: DiaEntrada[],
  opcoes: { meses: string[]; statusMes: Record<string, PeriodoSemDadoTipo | undefined>; piso: Entrada },
): ResumoMeses {
  const meses: MesResumo[] = [];
  const diasUsados: DiaEntrada[] = [];
  for (const anoMes of opcoes.meses) {
    const doMes = dias.filter((d) => d.data.slice(0, 7) === anoMes);
    const marca = opcoes.statusMes[anoMes];
    if (marca) {
      meses.push({ anoMes, status: marca, resumo: null });
      continue;
    }
    const resumo = resumirPeriodo(doMes, opcoes.piso);
    if (!resumo) {
      meses.push({ anoMes, status: "sem_dado", resumo: null });
      continue;
    }
    meses.push({ anoMes, status: "ok", resumo });
    diasUsados.push(...doMes);
  }
  const mesesComDado = meses.filter((m) => m.status === "ok").length;
  return {
    meses,
    periodo: resumirPeriodo(diasUsados, opcoes.piso),
    mesesComDado,
    mesesForaDasMedias: meses.length - mesesComDado,
  };
}

/** Sábado ou domingo (data YYYY-MM-DD, sem fuso). Fora da comparação com o recebimento (D29). */
export function ehFimDeSemana(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`Data inválida: "${data}". Use YYYY-MM-DD.`);
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
  if (Number.isNaN(dia)) throw new Error(`Data inválida: "${data}".`);
  return dia === 0 || dia === 6;
}
