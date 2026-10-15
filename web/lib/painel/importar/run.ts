/**
 * Importador do histórico (janela A, D42). Roda com `npm run import:hist` (data/s3.db)
 * e é chamado pelo `db:rebuild` na matriz.
 *
 * Contrato com o db:rebuild: `importarHistorico(db, pacoteDir)`. A execução direta (getDb() + PACOTE_DIR)
 * só acontece quando este arquivo é o ponto de entrada.
 *
 * Lê os arquivos ANTES de abrir a transação (o exceljs é assíncrono), apaga e recarrega as `hist_*` numa
 * única transação síncrona, em lotes de até 500 linhas. Nenhuma linha some em silêncio.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import { getDb, schema, type Db } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";
import { derivarCargas } from "./cargas";
import { lerChapasCsv, periodosSemDado, tratarChapas, type LinhaChapasBruta } from "./chapas";
import {
  PESO_MAX_SUSPEITO_KG,
  lerMovimentacao,
  tratarMovimentacao,
  type ContextoMov,
  type LinhaMovBruta,
} from "./movimentacao";
import { lerXmls, tratarXmls, type NfXmlBruta } from "./nf-xml";
import { soDigitos } from "./util";

const LOTE = 500;

export interface DadosHist {
  movimentacao: LinhaMovBruta[];
  chapas: LinhaChapasBruta[];
  xmls: NfXmlBruta[];
}

export interface Contagens {
  movimentacao: { lidas: number; consideradas: number; marcadas: number };
  chapas: { lidas: number; consideradas: number; marcadas: number };
  xml: { lidas: number; consideradas: number; marcadas: number };
  periodosSemDado: { anoMes: string; tipo: string }[];
  cargas: number;
  cargasArmazem: number;
}

function lotes<T>(itens: T[]): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE) saida.push(itens.slice(i, i + LOTE));
  return saida;
}

function contextoDosCadastros(db: Db): { ctx: ContextoMov; diasMinimos: number } {
  const produtos = new Map<string, { unidade: string | null; grupo: string | null }>();
  for (const p of db.select({ item: schema.produto.item, unidade: schema.produto.unidade, grupo: schema.produto.grupo }).from(schema.produto).all()) {
    const chave = p.item.trim().toUpperCase();
    if (!produtos.has(chave)) produtos.set(chave, { unidade: p.unidade?.trim() || null, grupo: p.grupo?.trim() || null });
  }
  const fornecedorCnpj = new Map<string, string>();
  for (const f of db.select({ codigo: schema.fornecedor.codigo, cnpj: schema.fornecedor.cnpj }).from(schema.fornecedor).all()) {
    const cnpj = soDigitos(f.cnpj);
    if (f.codigo && cnpj) fornecedorCnpj.set(f.codigo.trim(), cnpj);
  }
  const precos = new Map(db.select().from(schema.tipoItem).all().map((t) => [t.id, t.precoUnitario]));
  const grupos: ContextoMov["grupos"] = new Map();
  for (const g of db.select().from(schema.grupoProduto).all()) {
    grupos.set(g.grupo, {
      armazemId: g.armazemId,
      preco: g.tipoItemId !== null ? (precos.get(g.tipoItemId) ?? null) : null,
      conversao: g.conversaoProducao === "saca_50kg" ? "saca_50kg" : "unidade",
    });
  }
  const depositos = new Map(db.select().from(schema.depositoArmazem).all().map((d) => [d.deposito, d.armazemId]));
  const dias = db.select().from(schema.parametro).where(eq(schema.parametro.chave, "dias_minimos_mes")).get();
  const diasMinimos = dias ? Number.parseInt(dias.valor, 10) : 10;
  return {
    ctx: { produtos, fornecedorCnpj, grupos, depositos, pesoMaxSuspeitoKg: PESO_MAX_SUSPEITO_KG },
    diasMinimos: Number.isFinite(diasMinimos) ? diasMinimos : 10,
  };
}

/** Parte síncrona: trata os dados em memória e grava tudo numa transação. Rodar duas vezes dá as mesmas contagens. */
export function executarImportacao(db: Db, dados: DadosHist, instante: string): Contagens {
  const { ctx, diasMinimos } = contextoDosCadastros(db);

  const mov = tratarMovimentacao(dados.movimentacao, ctx);
  const chapas = tratarChapas(dados.chapas);
  const chavesMov = new Set(mov.linhas.map((l) => l.chaveAcesso).filter((c): c is string => c !== null));
  const xml = tratarXmls(dados.xmls, chavesMov);
  const periodos = periodosSemDado(chapas.linhas, diasMinimos);
  const cargas = derivarCargas(mov.linhas, xml.linhas);

  const marcadas = (qs: { qualidade: string }[]) => qs.filter((q) => q.qualidade !== "").length;
  const contagens: Contagens = {
    movimentacao: { lidas: mov.linhas.length, consideradas: mov.linhas.filter((l) => l.considerada).length, marcadas: marcadas(mov.linhas) },
    chapas: { lidas: chapas.linhas.length, consideradas: chapas.linhas.filter((l) => l.considerada).length, marcadas: marcadas(chapas.linhas) },
    xml: { lidas: xml.linhas.length, consideradas: xml.linhas.filter((l) => l.considerada).length, marcadas: marcadas(xml.linhas) },
    periodosSemDado: periodos.map((p) => ({ anoMes: p.anoMes, tipo: p.tipo })),
    cargas: cargas.length,
    cargasArmazem: cargas.reduce((s, c) => s + c.armazens.length, 0),
  };

  db.transaction(
    (tx) => {
      tx.delete(schema.histCargaArmazem).run();
      tx.delete(schema.histCarga).run();
      tx.delete(schema.histMovimentacao).run();
      tx.delete(schema.histNfXml).run();
      tx.delete(schema.histChapasDia).run();
      tx.delete(schema.histPeriodoSemDado).run();
      tx.delete(schema.histImportacaoLog).run();

      for (const lote of lotes(mov.linhas)) {
        tx.insert(schema.histMovimentacao)
          .values(
            lote.map((l) => ({
              linhaPlanilha: l.linhaPlanilha,
              pedidoCompra: l.pedidoCompra,
              dataLancamento: l.dataLancamento,
              dataDocumento: l.dataDocumento,
              codPn: l.codPn,
              nomePn: l.nomePn,
              codItem: l.codItem,
              descItem: l.descItem,
              qtd: l.qtd,
              peso: l.peso,
              deposito: l.deposito,
              nRecebimento: l.nRecebimento,
              dataRecebimento: l.dataRecebimento,
              nfNumero: l.nfNumero,
              chaveAcesso: l.chaveAcesso,
              fornecedorCnpj: l.fornecedorCnpj,
              unidade: l.unidade,
              grupo: l.grupo,
              armazemId: l.armazemId,
              pesoKg: l.pesoKg,
              qualidade: l.qualidade,
              considerada: l.considerada,
              extra: JSON.stringify({ quantidadeBoletim: l.quantidadeBoletim, producaoEstimada: l.producaoEstimada }),
            })),
          )
          .run();
      }

      for (const lote of lotes(xml.linhas)) {
        tx.insert(schema.histNfXml)
          .values(
            lote.map((x) => ({
              arquivo: x.arquivo,
              chaveAcesso: x.chaveAcesso,
              numero: x.numero,
              emitenteCnpj: x.emitenteCnpj,
              emitenteNome: x.emitenteNome,
              emitidaEm: x.emitidaEm,
              saidaEm: x.saidaEm,
              valorTotal: x.valorTotal,
              pesoLiquidoKg: x.pesoLiquidoKg,
              pesoBrutoKg: x.pesoBrutoKg,
              volumes: x.volumes,
              especie: x.especie,
              placa: x.placa,
              transportadora: x.transportadora,
              modalidadeFrete: x.modalidadeFrete,
              pedidoFornecedor: x.pedidoFornecedor,
              itensQtd: x.itensQtd,
              qualidade: x.qualidade,
              considerada: x.considerada,
            })),
          )
          .run();
      }

      for (const lote of lotes(chapas.linhas)) {
        tx.insert(schema.histChapasDia)
          .values(
            lote.map((c) => ({
              data: c.data,
              diaSemana: c.diaSemana,
              presentes: c.presentes,
              cafe: c.cafe,
              valorPago: c.valorPago,
              qualidade: c.qualidade,
              considerada: c.considerada,
            })),
          )
          .run();
      }

      if (periodos.length) {
        tx.insert(schema.histPeriodoSemDado)
          .values(periodos.map((p) => ({ anoMes: p.anoMes, tipo: p.tipo, motivo: p.motivo })))
          .run();
      }

      for (const lote of lotes(cargas)) {
        tx.insert(schema.histCarga)
          .values(
            lote.map((c) => ({
              id: c.id,
              codPn: c.codPn,
              data: c.data,
              notasQtd: c.notasQtd,
              itensQtd: c.itensQtd,
              pesoTotalKg: c.pesoTotalKg,
              especieXml: c.especieXml,
              acondicionamentoXml: c.acondicionamentoXml,
            })),
          )
          .run();
      }
      const ligacoes = cargas.flatMap((c) =>
        c.armazens.map((a) => ({
          histCargaId: c.id,
          armazemId: a.armazemId,
          itensQtd: a.itensQtd,
          pesoKg: a.pesoKg,
          quantidadeBoletim: a.quantidadeBoletim,
          producaoEstimada: a.producaoEstimada,
        })),
      );
      for (const lote of lotes(ligacoes)) tx.insert(schema.histCargaArmazem).values(lote).run();

      const log = (arquivo: string, c: { lidas: number; marcadas: number }, motivos: Record<string, number>) => ({
        arquivo,
        linhasLidas: c.lidas,
        linhasOk: c.lidas - c.marcadas,
        linhasMarcadas: c.marcadas,
        motivos: JSON.stringify(motivos),
        executadoEm: instante,
      });
      tx.insert(schema.histImportacaoLog)
        .values([
          log("03_movimentacao/pedido_recebimento_notafiscal.xlsx", contagens.movimentacao, mov.motivos),
          log("04_mao_de_obra/chapas_por_dia.csv", contagens.chapas, chapas.motivos),
          log("01_notas_fiscais/xml", contagens.xml, xml.motivos),
        ])
        .run();
    },
    { behavior: "immediate" },
  );

  return contagens;
}

/** Contrato com o db:rebuild: lê os arquivos do pacote e grava as `hist_*`. */
export async function importarHistorico(db: Db, pacoteDir: string): Promise<void> {
  const movimentacao = await lerMovimentacao(pacoteDir);
  const chapas = lerChapasCsv(pacoteDir);
  const xmls = lerXmls(pacoteDir);
  const c = executarImportacao(db, { movimentacao, chapas, xmls }, agoraISO());
  console.log("Histórico importado (lidas / consideradas / marcadas):");
  console.log(`  movimentação: ${c.movimentacao.lidas} / ${c.movimentacao.consideradas} / ${c.movimentacao.marcadas}`);
  console.log(`  folha de funcionários: ${c.chapas.lidas} / ${c.chapas.consideradas} / ${c.chapas.marcadas}`);
  console.log(`  XML de NF-e: ${c.xml.lidas} / ${c.xml.consideradas} / ${c.xml.marcadas}`);
  console.log(`  cargas: ${c.cargas}; cargas por armazém: ${c.cargasArmazem}`);
  console.log(`  períodos sem dado ou parciais: ${c.periodosSemDado.map((p) => `${p.anoMes} (${p.tipo})`).join(", ") || "nenhum"}`);
}

const arquivoAtual = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === arquivoAtual) {
  const pacote = process.env.PACOTE_DIR;
  if (!pacote) throw new Error("PACOTE_DIR ausente no .env.");
  await importarHistorico(getDb(), pacote);
}
