import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { z } from "zod";

import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";

/**
 * Cadastros do pacote de dados (PACOTE_DIR, fora do git): produto, fornecedor e chapa.
 * Lê tudo antes (o exceljs é assíncrono) e grava numa transação, em lotes de até 500 linhas.
 * Linha ruim é contada e não aborta.
 */

const LOTE = 500;

type Celula = unknown;

/** Valor simples de uma célula: resolve fórmula, texto rico e data. */
function valor(celula: Celula): string | number | null {
  if (celula === null || celula === undefined) return null;
  if (typeof celula === "string") return celula.trim() === "" ? null : celula.trim();
  if (typeof celula === "number") return celula;
  if (celula instanceof Date) return celula.toISOString();
  if (typeof celula === "object") {
    const objeto = celula as { result?: Celula; richText?: { text: string }[]; text?: string };
    if (objeto.richText) return valor(objeto.richText.map((r) => r.text).join(""));
    if ("result" in objeto) return valor(objeto.result);
    if (typeof objeto.text === "string") return valor(objeto.text);
  }
  return null;
}

function texto(celula: Celula): string | null {
  const v = valor(celula);
  return v === null ? null : String(v).trim() || null;
}

/** Número da planilha → texto decimal sem expoente (peso unitário). */
function decimalTexto(celula: Celula): string | null {
  const v = valor(celula);
  if (v === null) return null;
  if (typeof v === "number") {
    return Number.isFinite(v) ? v.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 10 }) : null;
  }
  const limpo = v.replace(",", ".");
  return /^\d+(\.\d+)?$/.test(limpo) ? limpo : null;
}

function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

async function lerAba(arquivo: string): Promise<{ cabecalho: string[]; linhas: Celula[][] }> {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.readFile(arquivo);
  const aba = pasta.worksheets[0];
  const linhas: Celula[][] = [];
  aba.eachRow((linha) => linhas.push((linha.values as Celula[]).slice(1)));
  const cabecalho = (linhas.shift() ?? []).map((c) => normalizar(String(valor(c) ?? "")));
  return { cabecalho, linhas };
}

function coluna(cabecalho: string[], nome: string, arquivo: string): number {
  const i = cabecalho.indexOf(normalizar(nome));
  if (i < 0) throw new Error(`Coluna "${nome}" não encontrada em ${arquivo}. Cabeçalho lido: ${cabecalho.join(" | ")}`);
  return i;
}

const produtoZ = z.object({
  item: z.string().min(1),
  descricao: z.string().nullable(),
  unidade: z.string().nullable(),
  pesoUnitarioKg: z.string().nullable(),
  subgrupo: z.string().nullable(),
  grupo: z.string().nullable(),
  grupoDescricao: z.string().nullable(),
  deposito: z.string(),
});
type ProdutoLido = z.infer<typeof produtoZ>;

const fornecedorZ = z.object({
  codigo: z.string().min(1),
  razaoSocial: z.string().min(1),
  cnpj: z.string().regex(/^\d+$/).nullable(),
});
type FornecedorLido = z.infer<typeof fornecedorZ>;

interface ChapaLida {
  matricula: string;
  nome: string;
  lotacaoAdubo: boolean;
}

export interface CadastrosLidos {
  produtos: ProdutoLido[];
  fornecedores: FornecedorLido[];
  chapas: ChapaLida[];
  ruins: { produtos: number; fornecedores: number };
}

async function lerProdutos(pacote: string): Promise<{ ok: ProdutoLido[]; ruins: number }> {
  const arquivo = path.join(pacote, "02_cadastros", "produtos.xlsx");
  const { cabecalho, linhas } = await lerAba(arquivo);
  const c = {
    item: coluna(cabecalho, "Nº do item", arquivo),
    descricao: coluna(cabecalho, "Descrição do item", arquivo),
    unidade: coluna(cabecalho, "Unidade de medida", arquivo),
    peso: coluna(cabecalho, "Peso", arquivo),
    subgrupo: coluna(cabecalho, "Nome do grupo", arquivo),
    grupo: coluna(cabecalho, "Grupo", arquivo),
    grupoDescricao: coluna(cabecalho, "Descrição", arquivo),
    deposito: coluna(cabecalho, "depósito", arquivo),
  };
  const ok: ProdutoLido[] = [];
  const vistos = new Set<string>();
  let ruins = 0;
  for (const linha of linhas) {
    const lido = produtoZ.safeParse({
      item: texto(linha[c.item]) ?? "",
      descricao: texto(linha[c.descricao]),
      unidade: texto(linha[c.unidade])?.toUpperCase() ?? null,
      pesoUnitarioKg: decimalTexto(linha[c.peso]),
      subgrupo: texto(linha[c.subgrupo]),
      grupo: texto(linha[c.grupo])?.toUpperCase() ?? null,
      grupoDescricao: texto(linha[c.grupoDescricao]),
      deposito: texto(linha[c.deposito]) ?? "",
    });
    const chave = lido.success ? `${lido.data.item}|${lido.data.deposito}` : "";
    if (!lido.success || vistos.has(chave)) {
      ruins++;
      continue;
    }
    vistos.add(chave);
    ok.push(lido.data);
  }
  return { ok, ruins };
}

async function lerFornecedores(pacote: string): Promise<{ ok: FornecedorLido[]; ruins: number }> {
  const arquivo = path.join(pacote, "02_cadastros", "fornecedores.xlsx");
  const { cabecalho, linhas } = await lerAba(arquivo);
  const c = {
    codigo: coluna(cabecalho, "COD", arquivo),
    nome: coluna(cabecalho, "FORNECEDOR", arquivo),
    cnpj: coluna(cabecalho, "CNPJ", arquivo),
  };
  const ok: FornecedorLido[] = [];
  const vistos = new Set<string>();
  let ruins = 0;
  for (const linha of linhas) {
    const codigo = texto(linha[c.codigo]);
    const nome = texto(linha[c.nome]);
    if (!codigo && !nome) continue; // linha em branco no fim da planilha
    const cnpj = (texto(linha[c.cnpj]) ?? "").replace(/\D/g, "");
    const lido = fornecedorZ.safeParse({ codigo: codigo ?? "", razaoSocial: nome ?? "", cnpj: cnpj || null });
    if (!lido.success || vistos.has(lido.data.codigo)) {
      ruins++;
      continue;
    }
    vistos.add(lido.data.codigo);
    ok.push(lido.data);
  }
  return { ok, ruins };
}

/** Lista matrícula → nome nas colunas N e O da planilha do boletim (lotação Adubo). */
async function lerChapasDoBoletim(pacote: string): Promise<ChapaLida[]> {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.readFile(path.join(pacote, "05_operacao", "boletim_diario_chapas.xlsx"));
  const aba = pasta.worksheets[0];
  const chapas: ChapaLida[] = [];
  for (let r = 1; r <= aba.rowCount; r++) {
    const matricula = valor(aba.getCell(r, 14).value);
    const nome = texto(aba.getCell(r, 15).value);
    if (typeof matricula === "number" && Number.isInteger(matricula) && nome && /^CHAPA_\d+$/.test(nome)) {
      chapas.push({ matricula: String(matricula), nome, lotacaoAdubo: true });
    }
  }
  return chapas;
}

/** Identificadores CHAPA_nn das folhas. Leitor em fluxo: o readFile do exceljs quebra nesses arquivos. */
async function lerChapasDasFolhas(pacote: string): Promise<string[]> {
  const nomes = new Set<string>();
  for (const ano of ["2025", "2026"]) {
    const arquivo = path.join(pacote, "04_mao_de_obra", `chapas_por_dia_${ano}.xlsx`);
    if (!fs.existsSync(arquivo)) continue;
    const leitor = new ExcelJS.stream.xlsx.WorkbookReader(arquivo, { sharedStrings: "cache", worksheets: "emit" });
    for await (const aba of leitor) {
      for await (const linha of aba) {
        for (const celula of linha.values as Celula[]) {
          const t = texto(celula);
          if (t && /^CHAPA_\d+$/.test(t)) nomes.add(t);
        }
      }
    }
  }
  return [...nomes].sort();
}

export async function lerCadastros(pacote: string): Promise<CadastrosLidos> {
  const [produtos, fornecedores, doBoletim, dasFolhas] = await Promise.all([
    lerProdutos(pacote),
    lerFornecedores(pacote),
    lerChapasDoBoletim(pacote),
    lerChapasDasFolhas(pacote),
  ]);
  const jaTem = new Set(doBoletim.map((c) => c.nome));
  const chapas = [
    ...doBoletim,
    ...dasFolhas.filter((nome) => !jaTem.has(nome)).map((nome) => ({ matricula: nome, nome, lotacaoAdubo: false })),
  ];
  return {
    produtos: produtos.ok,
    fornecedores: fornecedores.ok,
    chapas,
    ruins: { produtos: produtos.ruins, fornecedores: fornecedores.ruins },
  };
}

function emLotes<T>(itens: T[]): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE) lotes.push(itens.slice(i, i + LOTE));
  return lotes;
}

export interface ContagemCadastros {
  produtos: number;
  produtosSemArmazem: number;
  gruposNovos: string[];
  fornecedores: number;
  chapas: number;
  ruins: CadastrosLidos["ruins"];
}

/** Grava os cadastros lidos. Espera o seed fixo já aplicado (armazéns, grupos e depósitos). */
export function gravarCadastros(db: Db, lidos: CadastrosLidos): ContagemCadastros {
  return db.transaction((tx) => {
    const armazemDoGrupo = new Map(tx.select().from(s.grupoProduto).all().map((g) => [g.grupo, g.armazemId]));
    const armazemDoDeposito = new Map(tx.select().from(s.depositoArmazem).all().map((d) => [d.deposito, d.armazemId]));
    const adubo = tx.select().from(s.armazem).all().find((a) => a.nome === "Adubo");

    // Grupo que aparece no cadastro e não está no mapa entra com armazém e tipo nulos (D16).
    const gruposNovos = new Map<string, string | null>();
    for (const p of lidos.produtos) {
      if (p.grupo && !armazemDoGrupo.has(p.grupo) && !gruposNovos.has(p.grupo)) gruposNovos.set(p.grupo, p.grupoDescricao);
    }
    if (gruposNovos.size > 0) {
      tx.insert(s.grupoProduto)
        .values([...gruposNovos].map(([grupo, descricao]) => ({ grupo, descricao })))
        .run();
    }

    // Depósito fora do mapa entra sem armazém, para o cadastro não perder a informação.
    const depositosNovos = new Set(lidos.produtos.map((p) => p.deposito).filter((d) => d && !armazemDoDeposito.has(d)));
    if (depositosNovos.size > 0) {
      tx.insert(s.depositoArmazem)
        .values([...depositosNovos].map((deposito) => ({ deposito, recebeDireto: false })))
        .run();
    }

    let produtosSemArmazem = 0;
    const produtos = lidos.produtos.map((p) => {
      const armazemId = (p.grupo ? armazemDoGrupo.get(p.grupo) : null) ?? armazemDoDeposito.get(p.deposito) ?? null;
      if (armazemId === null) produtosSemArmazem++;
      return {
        item: p.item,
        descricao: p.descricao,
        unidade: p.unidade,
        pesoUnitarioKg: p.pesoUnitarioKg,
        subgrupo: p.subgrupo,
        grupo: p.grupo,
        deposito: p.deposito,
        armazemId,
      };
    });
    for (const lote of emLotes(produtos)) tx.insert(s.produto).values(lote).run();

    const fornecedores = lidos.fornecedores.map((f) => ({ ...f, origem: "historico" as const }));
    for (const lote of emLotes(fornecedores)) tx.insert(s.fornecedor).values(lote).run();

    const chapas = lidos.chapas.map((c) => ({
      matricula: c.matricula,
      nome: c.nome,
      armazemId: c.lotacaoAdubo ? (adubo?.id ?? null) : null,
    }));
    for (const lote of emLotes(chapas)) tx.insert(s.chapa).values(lote).run();

    return {
      produtos: produtos.length,
      produtosSemArmazem,
      gruposNovos: [...gruposNovos.keys()],
      fornecedores: fornecedores.length,
      chapas: chapas.length,
      ruins: lidos.ruins,
    };
  });
}
