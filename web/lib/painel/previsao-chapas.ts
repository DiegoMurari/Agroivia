/**
 * Previsão de chapas por dia (D50): dois números e uma recomendação.
 *  - Mínimo para dar conta (norma de descarga, dia-seguinte.ts).
 *  - Máximo que se paga: produção prevista ÷ piso da diária, para baixo.
 * Produção prevista = descargas agendadas (itens das NF na unidade do boletim x preço do tipo, D29 e D46)
 * + média de remoção e transferência dos boletins recentes (medidos). Decimal exato; chapas é inteiro só no fim.
 * Só leitura; a data é informada por quem chama.
 */
import { inArray } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { dec, decOuNulo, deInteiro, dividir, formatBRL, multiplicar, paraTexto, somar, subtrair, ZERO, type Valor } from "@/lib/money";
import { lerParametros } from "./consultas";
import { necessidadeDoDia, type NecessidadeDoDia } from "./dia-seguinte";
import { REGEX_CORRETIVO } from "./importar/movimentacao";
import { producaoEstimada } from "./sobra-falta";

export interface EntradaPrevisao {
  agendamentos: number;
  normaMinimo: number;
  normaMaximo: number;
  producaoDescarga: Valor | string;
  producaoNaoDescarga: Valor | string;
  temMediaBoletim: boolean;
  piso: string;
  incertaProducao?: boolean;
}

export type TipoPrevisao = "cobre" | "nao_cobre" | "sem_descarga_com_media" | "sem_descarga";

export interface Previsao {
  recomendado: number;
  de: number;
  ate: number | null;
  maximoPago: number | null;
  producaoPrevista: Valor;
  complementoPrevisto: Valor | null;
  tipo: TipoPrevisao;
  motivo: string;
  incerta: boolean;
}

const brl = (v: Valor) => formatBRL(v);
const chapas = (n: number) => `${n} ${n === 1 ? "funcionário" : "funcionários"}`;

export function preverChapas(e: EntradaPrevisao): Previsao {
  const producaoDescarga = dec(e.producaoDescarga);
  const producaoNaoDescarga = dec(e.producaoNaoDescarga);
  const producaoPrevista = somar(producaoDescarga, producaoNaoDescarga);
  const maximoPago = dividir(producaoPrevista, e.piso).floor().toNumber();

  if (e.agendamentos === 0) {
    if (e.temMediaBoletim && producaoNaoDescarga.greaterThan(0)) {
      return {
        recomendado: 0,
        de: 0,
        ate: maximoPago,
        maximoPago,
        producaoPrevista,
        complementoPrevisto: null,
        tipo: "sem_descarga_com_media",
        motivo: `Nenhuma descarga agendada. A média de remoção e transferência paga até ${maximoPago} diárias.`,
        incerta: false,
      };
    }
    return { recomendado: 0, de: 0, ate: null, maximoPago: null, producaoPrevista, complementoPrevisto: null, tipo: "sem_descarga", motivo: "Nenhuma descarga agendada.", incerta: false };
  }

  const faixaNorma = e.normaMinimo < e.normaMaximo;
  const incerta = faixaNorma || e.incertaProducao === true;
  const cobre = maximoPago >= e.normaMinimo;
  let motivo: string;
  let complementoPrevisto: Valor | null = null;
  if (cobre) {
    motivo =
      maximoPago === e.normaMinimo
        ? `Peça ${chapas(e.normaMinimo)}. A produção prevista cobre as diárias.`
        : `Peça de ${e.normaMinimo} a ${chapas(maximoPago)}. Até ${maximoPago}, a produção prevista cobre as diárias.`;
  } else {
    complementoPrevisto = subtrair(multiplicar(e.piso, deInteiro(e.normaMinimo)), producaoPrevista);
    motivo = `Peça ${chapas(e.normaMinimo)} (mínimo para descarregar). A produção prevista paga só ${maximoPago} diárias: complemento previsto de ${brl(complementoPrevisto)}.`;
  }
  if (faixaNorma) motivo += ` A norma pode pedir até ${chapas(e.normaMaximo)} se o peso ou o acondicionamento forem confirmados.`;
  else if (e.incertaProducao) motivo += " Parte da produção não pôde ser estimada.";

  return {
    recomendado: e.normaMinimo,
    de: e.normaMinimo,
    ate: cobre ? maximoPago : e.normaMinimo,
    maximoPago,
    producaoPrevista,
    complementoPrevisto,
    tipo: cobre ? "cobre" : "nao_cobre",
    motivo,
    incerta,
  };
}

// ---------------------------------------------------------------------------------------------
// Produção prevista a partir do banco
// ---------------------------------------------------------------------------------------------

function pesoDoItem(
  item: { quantidade: string | null; unidade: string | null },
  produto: { pesoUnitarioKg: string | null } | undefined,
  nf: { pesoLiquidoKg: string | null; pesoBrutoKg: string | null },
  itensDaNf: number,
): Valor | null {
  const q = decOuNulo(item.quantidade);
  const unidade = (item.unidade ?? "").trim().toUpperCase();
  if (q !== null) {
    if (unidade === "TON" || unidade === "T") return multiplicar(q, "1000");
    if (unidade === "KG") return q;
    const unitario = decOuNulo(produto?.pesoUnitarioKg);
    if (unitario !== null) return multiplicar(q, unitario);
  }
  if (itensDaNf === 1) return decOuNulo(nf.pesoLiquidoKg) ?? decOuNulo(nf.pesoBrutoKg);
  return null;
}

function producaoDasDescargas(db: Db, necessidade: NecessidadeDoDia): { total: Valor; incerta: boolean } {
  const ids = necessidade.porAgendamento.map((a) => a.id);
  if (ids.length === 0) return { total: ZERO, incerta: false };
  const ligacoes = db.select().from(schema.agendamentoNf).where(inArray(schema.agendamentoNf.agendamentoId, ids)).all();
  const nfs = new Map(db.select().from(schema.notaFiscal).all().map((n) => [n.id, n]));
  const itens = db.select().from(schema.notaFiscalItem).all();
  const produtos = new Map(db.select().from(schema.produto).all().map((p) => [p.id, p]));
  const grupos = new Map(db.select().from(schema.grupoProduto).all().map((g) => [g.grupo, g]));
  const precos = new Map(db.select().from(schema.tipoItem).all().map((t) => [t.id, t.precoUnitario]));

  const parcelas: Valor[] = [];
  const nfsContadas = new Set<number>();
  let incerta = false;
  for (const agId of ids) {
    const nfIds = ligacoes.filter((l) => l.agendamentoId === agId).map((l) => l.notaFiscalId);
    if (nfIds.length === 0) incerta = true;
    for (const nfId of nfIds) {
      if (nfsContadas.has(nfId)) continue; // mesma NF em dois agendamentos conta uma vez
      nfsContadas.add(nfId);
      const nf = nfs.get(nfId);
      const doNf = itens.filter((i) => i.notaFiscalId === nfId);
      if (!nf || doNf.length === 0) {
        incerta = true;
        continue;
      }
      for (const item of doNf) {
        const produto = item.produtoId === null ? undefined : produtos.get(item.produtoId);
        const grupo = produto?.grupo ? grupos.get(produto.grupo) : undefined;
        if (!produto || !grupo || !grupo.conversaoProducao) {
          incerta = true;
          continue;
        }
        const descricao = item.descricao ?? produto.descricao ?? "";
        if (grupo.grupo === "FER" && REGEX_CORRETIVO.test(descricao)) continue; // corretivo fora (D46)
        const preco = grupo.tipoItemId === null ? null : (precos.get(grupo.tipoItemId) ?? null);
        const conversao = grupo.conversaoProducao as "saca_50kg" | "unidade";
        const pesoKg = conversao === "saca_50kg" ? pesoDoItem(item, produto, nf, doNf.length) : null;
        const e = producaoEstimada({ conversao, pesoKg, quantidade: item.quantidade, preco });
        if (e.producao === null) incerta = true;
        else parcelas.push(e.producao);
      }
    }
  }
  return { total: somar(...parcelas), incerta };
}

const BOLETINS_NA_MEDIA = 10;

/** Média de remoção e transferência (em reais de produção) dos boletins recentes, por armazém, somada. */
function mediaNaoDescarga(db: Db, data: string, armazemIds: number[], semAgendamento: boolean): { media: Valor; tem: boolean } {
  const cadastro = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a]));
  const fechados = db
    .select()
    .from(schema.boletim)
    .all()
    .filter((b) => b.status === "fechado" && (b.origem === "teste" || b.origem === "operacao") && b.data < data);
  const alvo = !semAgendamento ? armazemIds : [...new Set(fechados.map((b) => b.armazemId))].filter((id) => cadastro.get(id)?.recebeDescarga);
  const linhas = db.select().from(schema.boletimLinha).all();
  const medias: Valor[] = [];
  let tem = false;
  for (const armazemId of alvo) {
    const recentes = fechados
      .filter((b) => b.armazemId === armazemId)
      .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
      .slice(0, BOLETINS_NA_MEDIA);
    if (recentes.length === 0) continue;
    tem = true;
    const totais = recentes.map((b) =>
      somar(
        ...linhas
          .filter((l) => l.boletimId === b.id)
          .map((l) => multiplicar(somar(l.qtdRemocao, l.qtdTransferencia), l.precoUsado)),
      ),
    );
    medias.push(dividir(somar(...totais), deInteiro(recentes.length)));
  }
  return { media: somar(...medias), tem };
}

export interface PrevisaoDoDia {
  data: string;
  necessidade: NecessidadeDoDia;
  previsao: Previsao;
  producaoDescarga: Valor;
  mediaNaoDescarga: Valor;
  temMediaBoletim: boolean;
  /** Texto curto que o botão "Copiar aviso ao prestador" copia. */
  aviso: string;
}

export function previsaoDoDia(db: Db, data: string): PrevisaoDoDia {
  const piso = lerParametros(db).piso;
  const necessidade = necessidadeDoDia(db, data);
  const descargas = producaoDasDescargas(db, necessidade);
  const ids = necessidade.porArmazem.map((a) => a.armazemId).filter((id): id is number => id !== null);
  const naoDescarga = mediaNaoDescarga(db, data, ids, necessidade.agendamentos === 0);
  const previsao = preverChapas({
    agendamentos: necessidade.agendamentos,
    normaMinimo: necessidade.minimo.chapas,
    normaMaximo: necessidade.maximo.chapas,
    producaoDescarga: paraTexto(descargas.total),
    producaoNaoDescarga: paraTexto(naoDescarga.media),
    temMediaBoletim: naoDescarga.tem,
    piso,
    incertaProducao: descargas.incerta,
  });
  return {
    data,
    necessidade,
    previsao,
    producaoDescarga: descargas.total,
    mediaNaoDescarga: naoDescarga.media,
    temMediaBoletim: naoDescarga.tem,
    aviso: textoCurtoPrestador(necessidade, previsao.recomendado),
  };
}

/** "Agrovia, 06/10/2026: precisamos de N chapas a partir das 08:00 (Adubo X, Insumos Y)." */
export function textoCurtoPrestador(n: NecessidadeDoDia, recomendado: number, opcoes: { rotulo?: string } = {}): string {
  void opcoes; // o rótulo ("Amanhã") não entra no texto copiado: a mensagem sai sempre com "Agrovia"
  const [a, m, d] = n.data.split("-");
  const quando = `Agrovia, ${d}/${m}/${a}`;
  if (n.agendamentos === 0) return `${quando}: não há recebimentos agendados.`;
  const pico = n.porHorario.find((h) => h.horario === n.picoHorario);
  const aPartir = pico ? ` a partir das ${pico.horario}` : "";
  const armazens = pico ? ` (${pico.porArmazem.map((x) => `${x.nome} ${x.maximo.chapas}`).join(", ")})` : "";
  return `${quando}: precisamos de ${chapas(recomendado)}${aPartir}${armazens}.`;
}
