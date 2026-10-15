/**
 * Movimentação (pedido, recebimento, NF): leitura do xlsx e tratamento das linhas (D42).
 * O tratamento recebe linhas em memória e o contexto dos cadastros, sem arquivo nem banco.
 * Nenhuma linha some: ela volta com `qualidade` (marcas separadas por vírgula) e `considerada`.
 */
import ExcelJS from "exceljs";
import path from "node:path";

import { dec, dividir, maiorQue, multiplicar, paraTexto } from "@/lib/money";
import { contar, ehFimDeSemanaISO, numeroComoTexto, paraDataISO, texto } from "./util";

export interface LinhaMovBruta {
  /** Número da linha na planilha (cabeçalho = 1). */
  linha: number;
  pedido: unknown;
  dataLancamento: unknown;
  dataDocumento: unknown;
  codPn: unknown;
  nome: unknown;
  codItem: unknown;
  descItem: unknown;
  qtd: unknown;
  peso: unknown;
  deposito: unknown;
  nRecebimento: unknown;
  dataRecebimento: unknown;
  nf: unknown;
  chave: unknown;
}

export interface ContextoMov {
  /** Itens do cadastro de produtos (primeira linha de cada item). */
  produtos: Map<string, { unidade: string | null; grupo: string | null }>;
  /** `cod_pn` → CNPJ só dígitos (cadastro de fornecedores). */
  fornecedorCnpj: Map<string, string>;
  /** grupo → armazém, preço do tipo do boletim e conversão da produção. */
  grupos: Map<string, { armazemId: number | null; preco: string | null; conversao: "saca_50kg" | "unidade" }>;
  /** depósito → armazém (nulo para MATProv e MATReser). */
  depositos: Map<string, number | null>;
  /** Peso acima do qual o valor é suspeito, em kg. */
  pesoMaxSuspeitoKg: string;
}

/**
 * Peso de uma linha acima do qual o valor é suspeito: 100 t (cerca de 3 a 4 caminhões em uma única linha).
 * Linhas de 200 a 1.000 t aparecem repetidas em vários recebimentos, o que sugere a quantidade do pedido, não a do recebimento.
 */
export const PESO_MAX_SUSPEITO_KG = "100000";

/** Corretivos de solo (calcário, gesso, dolomita): na calibração de 17/11/2025 só fecham com o boletim se ficarem de fora. */
export const REGEX_CORRETIVO = /CALC|GESSO|DOLOM/i;

export interface MovTratada {
  linhaPlanilha: number;
  pedidoCompra: string | null;
  dataLancamento: string | null;
  dataDocumento: string | null;
  codPn: string | null;
  nomePn: string | null;
  codItem: string | null;
  descItem: string | null;
  qtd: string | null;
  peso: string | null;
  deposito: string | null;
  nRecebimento: string | null;
  dataRecebimento: string | null;
  nfNumero: string | null;
  chaveAcesso: string | null;
  fornecedorCnpj: string | null;
  unidade: string | null;
  grupo: string | null;
  armazemId: number | null;
  pesoKg: string | null;
  /** Produção estimada da linha (D29) e a quantidade em unidades do boletim; nulas se faltar preço ou peso. */
  quantidadeBoletim: string | null;
  producaoEstimada: string | null;
  qualidade: string;
  considerada: boolean;
}

const CABECALHO = [
  "Pedido Compra", "Data Lançamento", "Data do Documento", "Cod PN", "Nome", "Cod Item", "Desc Item",
  "Qtd", "Peso", "Deposito", "Nº Recebimento", "Data Recebimento", "Nota Fiscal de Entrada", "Chave de Acesso",
];

const valorCelula = (v: unknown): unknown =>
  v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v;

/** Lê a planilha inteira (assíncrono) antes de qualquer transação. Confere o cabeçalho. */
export async function lerMovimentacao(pacoteDir: string): Promise<LinhaMovBruta[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(pacoteDir, "03_movimentacao", "pedido_recebimento_notafiscal.xlsx"));
  const ws = wb.worksheets[0];
  const cab = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(valorCelula(v) ?? "").trim());
  CABECALHO.forEach((nome, i) => {
    if (cab[i] !== nome) throw new Error(`Movimentação: coluna ${i + 1} deveria ser "${nome}" e é "${cab[i]}".`);
  });
  const linhas: LinhaMovBruta[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const v = (row.values as unknown[]).slice(1).map(valorCelula);
    linhas.push({
      linha: n, pedido: v[0], dataLancamento: v[1], dataDocumento: v[2], codPn: v[3], nome: v[4], codItem: v[5],
      descItem: v[6], qtd: v[7], peso: v[8], deposito: v[9], nRecebimento: v[10], dataRecebimento: v[11], nf: v[12], chave: v[13],
    });
  });
  return linhas;
}

function marcasDaChave(chave: string | null): string[] {
  if (chave === null) return ["sem_chave"];
  const marcas: string[] = [];
  if (!/^\d+$/.test(chave)) marcas.push("chave_com_letras");
  if (chave.length !== 44) marcas.push("chave_tamanho");
  return marcas;
}

/** CNPJ do emitente: dígitos 7 a 20 da chave de 44 dígitos (`slice(6, 20)`). */
export function cnpjDaChave(chave: string | null): string | null {
  if (chave === null || !/^\d{44}$/.test(chave)) return null;
  return chave.slice(6, 20);
}

/** Peso da linha em kg: unidade TON = Qtd × 1.000; KG = Qtd; senão o Peso da NF, se a NF tem uma linha só. */
function pesoDaLinha(unidade: string | null, qtd: string | null, pesoNf: string | null, nfTemUmaLinha: boolean): string | null {
  const u = unidade?.trim().toUpperCase() ?? null;
  if (qtd !== null && (u === "TON" || u === "T")) return paraTexto(multiplicar(qtd, "1000"));
  if (qtd !== null && (u === "KG" || u === "KGS")) return paraTexto(qtd);
  if (nfTemUmaLinha && pesoNf !== null && maiorQue(pesoNf, "0")) return paraTexto(pesoNf);
  return null;
}

function juntarMarca(atual: string, marca: string): string {
  if (atual.split(",").includes(marca)) return atual;
  return atual ? `${atual},${marca}` : marca;
}

export interface ResultadoMov {
  linhas: MovTratada[];
  /** Contagem por marca; `_consideradas` e `_fora` somam as linhas lidas. */
  motivos: Record<string, number>;
}

export function tratarMovimentacao(brutas: LinhaMovBruta[], ctx: ContextoMov): ResultadoMov {
  const motivos: Record<string, number> = {};
  const vistasInteiras = new Set<string>();
  const vistasChave = new Set<string>();
  const linhas: MovTratada[] = [];

  for (const b of brutas) {
    const marcas: string[] = [];
    let considerada = true;

    const dataRecebimento = paraDataISO(b.dataRecebimento);
    const dataLancamento = paraDataISO(b.dataLancamento);
    const dataDocumento = paraDataISO(b.dataDocumento);
    const codPn = texto(b.codPn);
    const codItem = texto(b.codItem)?.toUpperCase() ?? null;
    const chave = texto(b.chave);
    const deposito = texto(b.deposito);
    const qtd = numeroComoTexto(b.qtd);
    const peso = numeroComoTexto(b.peso);

    // duplicata inteira: todas as colunas iguais às de uma linha anterior
    const inteira = JSON.stringify([b.pedido, dataLancamento, dataDocumento, codPn, b.nome, codItem, b.descItem, qtd, peso, deposito, b.nRecebimento, dataRecebimento, b.nf, chave]);
    if (vistasInteiras.has(inteira)) {
      marcas.push("duplicada");
      considerada = false;
    } else {
      vistasInteiras.add(inteira);
      const k = `${b.pedido}|${codItem}|${b.nRecebimento}|${chave}|${deposito}`;
      if (vistasChave.has(k)) marcas.push("chave_repetida");
      vistasChave.add(k);
    }

    if (codPn === null) {
      marcas.push("sem_cod_pn");
      considerada = false;
    }
    if (dataRecebimento === null) {
      marcas.push("sem_data");
      considerada = false;
    } else {
      if (ehFimDeSemanaISO(dataRecebimento)) marcas.push("fim_de_semana");
      if (dataLancamento !== null && dataRecebimento < dataLancamento) marcas.push("receb_antes_lancamento");
    }
    marcas.push(...marcasDaChave(chave));
    if (texto(b.nome) === null) marcas.push("sem_nome_fornecedor");
    if (qtd === null) {
      marcas.push("qtd_invalida");
      considerada = false;
    } else if (!dec(qtd).isInteger()) marcas.push("qtd_fracionaria");
    if (peso === null) marcas.push("peso_invalido");
    else if (dec(peso).isZero()) marcas.push("peso_zero");
    else if (maiorQue(peso, ctx.pesoMaxSuspeitoKg)) marcas.push("peso_suspeito");

    // cadastro de produtos: unidade e grupo; sem o item, o grupo vem do prefixo do código (derivação declarada)
    const prod = codItem ? ctx.produtos.get(codItem) : undefined;
    let grupo = prod?.grupo ?? null;
    const unidade = prod?.unidade ?? null;
    if (!prod) {
      marcas.push("item_fora_cadastro");
      const prefixo = codItem?.slice(0, 3) ?? null;
      if (prefixo && ctx.grupos.has(prefixo)) {
        grupo = prefixo;
        marcas.push("grupo_pelo_prefixo");
      }
    } else if (unidade === null) marcas.push("sem_unidade");

    // armazém (D16): grupo; se o grupo não tem armazém, o depósito
    let armazemId = grupo ? (ctx.grupos.get(grupo)?.armazemId ?? null) : null;
    if (armazemId === null && deposito) {
      if (!ctx.depositos.has(deposito)) marcas.push("deposito_fora_do_mapa");
      armazemId = ctx.depositos.get(deposito) ?? null;
    }
    if (armazemId === null) marcas.push("sem_armazem");

    linhas.push({
      linhaPlanilha: b.linha,
      pedidoCompra: texto(b.pedido),
      dataLancamento,
      dataDocumento,
      codPn,
      nomePn: texto(b.nome),
      codItem,
      descItem: texto(b.descItem),
      qtd,
      peso,
      deposito,
      nRecebimento: texto(b.nRecebimento),
      dataRecebimento,
      nfNumero: texto(b.nf),
      chaveAcesso: chave,
      fornecedorCnpj: (codPn ? ctx.fornecedorCnpj.get(codPn) : undefined) || cnpjDaChave(chave),
      unidade,
      grupo,
      armazemId,
      pesoKg: null,
      quantidadeBoletim: null,
      producaoEstimada: null,
      qualidade: marcas.join(","),
      considerada,
    });
  }

  // O Peso é o da NF inteira, repetido em cada linha: só vale como peso da linha quando a NF tem uma linha.
  const linhasPorNf = new Map<string, number>();
  for (const l of linhas) {
    if (!l.considerada) continue;
    const k = `${l.pedidoCompra}|${l.nfNumero}`;
    linhasPorNf.set(k, (linhasPorNf.get(k) ?? 0) + 1);
  }
  for (const l of linhas) {
    const pesoNfValido = l.peso !== null && !maiorQue(l.peso, ctx.pesoMaxSuspeitoKg) ? l.peso : null;
    l.pesoKg = pesoDaLinha(l.unidade, l.qtd, pesoNfValido, linhasPorNf.get(`${l.pedidoCompra}|${l.nfNumero}`) === 1);
    if (l.pesoKg !== null && maiorQue(l.pesoKg, ctx.pesoMaxSuspeitoKg)) {
      l.pesoKg = null;
      l.qualidade = juntarMarca(l.qualidade, "peso_suspeito");
    }
    // produção estimada da linha (D29): saca_50kg = peso ÷ 50; unidade = quantidade
    const g = l.grupo ? ctx.grupos.get(l.grupo) : undefined;
    const corretivo = l.grupo === "FER" && REGEX_CORRETIVO.test(l.descItem ?? "");
    if (corretivo) l.qualidade = juntarMarca(l.qualidade, "corretivo_fora_da_producao");
    if (g && l.qtd !== null && !corretivo) {
      const base = g.conversao === "saca_50kg" ? l.pesoKg : l.qtd;
      if (base !== null) {
        const q = g.conversao === "saca_50kg" ? dividir(base, "50") : dec(base);
        l.quantidadeBoletim = paraTexto(q);
        if (g.preco !== null) l.producaoEstimada = paraTexto(multiplicar(q, g.preco));
      }
    }
    if (g && g.preco === null) l.qualidade = juntarMarca(l.qualidade, "grupo_sem_preco");
    if (g && g.conversao === "saca_50kg" && l.pesoKg === null && !corretivo) l.qualidade = juntarMarca(l.qualidade, "sem_peso_linha");
  }

  for (const l of linhas) {
    if (l.qualidade) for (const m of l.qualidade.split(",")) contar(motivos, m);
    contar(motivos, l.considerada ? "_consideradas" : "_fora");
  }
  return { linhas, motivos };
}
