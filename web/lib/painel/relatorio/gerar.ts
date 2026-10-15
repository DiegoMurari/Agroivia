/**
 * Gera os blocos numéricos de `docs/relatorio.md` a partir das MESMAS funções do painel (consultas.ts, frase.ts).
 * Escreve só entre marcadores `<!-- gerar:nome -->` e `<!-- /gerar:nome -->`; o texto fora deles nunca é tocado.
 * Idempotente: sem data nem hora no conteúdo, rodar duas vezes não muda nada.
 * Rode: npm run run:s3 -- lib/painel/relatorio/gerar.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDb, schema, type Db } from "@/lib/db";
import { deInteiro, dividir, formatNumero, multiplicar, paraTexto } from "@/lib/money";
import {
  AVISO_TETO_PISO,
  demandaPorArmazem,
  lerParametros,
  resumoBoletins,
  resumoHistorico,
  type Filtro,
  type ResumoHistorico,
} from "../consultas";
import { cargasPorDia } from "../indicadores";
import { fraseDaResposta } from "../frase";

const f2 = (v: Parameters<typeof formatNumero>[0]) => formatNumero(v, 2);

const PERIODOS: { filtro: Filtro; titulo: string }[] = [
  { filtro: { tipo: "safra" }, titulo: "Safra (outubro a março)" },
  { filtro: { tipo: "entressafra" }, titulo: "Entressafra (abril a setembro)" },
  { filtro: { tipo: "tudo" }, titulo: "Todo o período com dado" },
];

function blocoResposta(db: Db): string {
  const piso = lerParametros(db).piso;
  const linhas: string[] = [];
  for (const p of PERIODOS.slice(0, 2)) {
    const h = resumoHistorico(db, p.filtro);
    linhas.push(`**${p.titulo}** (origem: histórico)`, "");
    if (!h.resumo) {
      linhas.push("Sem dado neste período.", "");
      continue;
    }
    const fr = fraseDaResposta(h.resumo, piso, h.rotulo);
    linhas.push(`> ${fr.principal}`, "", fr.detalhe, "", fr.pico, "", fr.ressalva, "");
  }
  linhas.push(`**Leitura:** ${AVISO_TETO_PISO} Os dois lados convivem: há dias com excesso e dias com falta, e a média líquida esconde isso.`);
  return linhas.join("\n");
}

function linhaNumeros(titulo: string, h: ResumoHistorico, piso: string): string {
  const r = h.resumo;
  if (!r) return `| ${titulo} | histórico | sem dado | | | | | | |`;
  const justificadas = dividir(r.producaoTotal, multiplicar(piso, deInteiro(r.diasConsiderados)));
  return (
    `| ${titulo} | histórico | ${r.diasConsiderados} | ${f2(r.efetivoMedio)} | ${f2(justificadas)} | ` +
    `${f2(r.excessoMedioChapas)} (R$ ${f2(r.excessoReaisMedio)}) | ${f2(r.faltaMediaChapas)} (R$ ${f2(r.faltaReaisMedia)}) | ` +
    `${r.diasExcesso} / ${r.diasFalta} | ${f2(r.pico.faltaMedianaChapas)} |`
  );
}

function blocoNumeros(db: Db): string {
  const piso = lerParametros(db).piso;
  const cab = [
    "| Período | Origem | Dias úteis comparados | Efetivo médio | Diárias justificadas médias | Excesso médio, chapas/dia (R$/dia) | Falta média, chapas/dia (R$/dia) | Dias com excesso / com falta | Falta mediana nos dias de pico |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  const corpo = PERIODOS.map((p) => linhaNumeros(p.titulo, resumoHistorico(db, p.filtro), piso));
  return [...cab, ...corpo, "", `Piso da diária: R$ ${formatNumero(piso, 4)}. Valores exibidos com 2 casas; o cálculo não arredonda. ${AVISO_TETO_PISO}`].join("\n");
}

function blocoMeses(db: Db): string {
  const h = resumoHistorico(db, { tipo: "tudo" });
  const linhas = [
    "| Mês | Situação | Dias comparados | Efetivo médio | Excesso médio (chapas/dia) | Falta média (chapas/dia) |",
    "|---|---|---|---|---|---|",
  ];
  for (const m of h.meses) {
    if (m.resumo) {
      linhas.push(
        `| ${m.anoMes} | com dado | ${m.resumo.diasConsiderados} | ${f2(m.resumo.efetivoMedio)} | ${f2(m.resumo.excessoMedioChapas)} | ${f2(m.resumo.faltaMediaChapas)} |`,
      );
    } else {
      linhas.push(`| ${m.anoMes} | ${m.status === "parcial" ? "parcial (fora das médias)" : "sem dado (fora das médias)"} | | | | |`);
    }
  }
  linhas.push("", `Dias de folha em sábado ou domingo, fora da comparação com o recebimento: ${h.fimDeSemanaFora}.`);
  return linhas.join("\n");
}

function blocoArmazem(db: Db): string {
  const d = demandaPorArmazem(db, { tipo: "safra" });
  const linhas: string[] = [];
  if (d) {
    linhas.push(
      d.premissa,
      "",
      "Safra, histórico:",
      "",
      "| Armazém | Diárias justificadas por dia | Parte da demanda | Efetivo rateado (premissa) |",
      "|---|---|---|---|",
    );
    for (const a of d.armazens) {
      linhas.push(
        `| ${a.nome} | ${f2(a.diariasPorDia)} | ${a.participacao ? `${formatNumero(a.participacao.times(100), 1)}%` : "sem boletim"} | ${a.efetivoRateado ? f2(a.efetivoRateado) : "fora da comparação"} |`,
      );
    }
  } else linhas.push("Sem dado por armazém no histórico.");
  const novos = resumoBoletins(db, { tipo: "tudo" });
  linhas.push("", "**Medido por armazém nos boletins novos** (exato; origem em cada linha):", "");
  if (novos.length === 0) linhas.push("Nenhum boletim fechado ainda.");
  else {
    linhas.push(
      "| Armazém | Origem | Dias | Excesso médio (chapas/dia) | Falta média (chapas/dia) | Complemento médio (R$/dia) |",
      "|---|---|---|---|---|---|",
    );
    for (const n of novos) {
      linhas.push(
        `| ${n.nome} | ${n.origem} | ${n.resumo.diasConsiderados} | ${f2(n.resumo.excessoMedioChapas)} | ${f2(n.resumo.faltaMediaChapas)} | ${f2(n.resumo.excessoReaisMedio)} |`,
      );
    }
  }
  return linhas.join("\n");
}

function blocoImportacao(db: Db): string {
  const logs = db
    .select()
    .from(schema.histImportacaoLog)
    .all()
    .sort((a, b) => (a.arquivo ?? "").localeCompare(b.arquivo ?? ""));
  if (logs.length === 0) return "A importação do histórico ainda não foi executada.";
  const linhas = ["| Arquivo | Linhas lidas | Sem marca | Marcadas |", "|---|---|---|---|"];
  for (const l of logs) linhas.push(`| ${l.arquivo} | ${l.linhasLidas} | ${l.linhasOk} | ${l.linhasMarcadas} |`);
  linhas.push("", "Marcas por arquivo (linhas afetadas; uma linha pode ter mais de uma marca):", "");
  for (const l of logs) {
    let motivos: Record<string, number> = {};
    try {
      motivos = JSON.parse(l.motivos ?? "{}") as Record<string, number>;
    } catch {
      motivos = { motivos_ilegiveis: 1 };
    }
    const texto = Object.entries(motivos)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .map(([k, v]) => `${k} ${v}`)
      .join("; ");
    linhas.push(`- **${l.arquivo}:** ${texto || "nenhuma marca"}`);
  }
  const cargas = db.select().from(schema.histCarga).all().length;
  linhas.push("", `Cargas históricas derivadas (mesmo fornecedor e mesma data de recebimento, D21): ${cargas}.`);
  const periodos = db.select().from(schema.histPeriodoSemDado).all().sort((a, b) => a.anoMes.localeCompare(b.anoMes));
  linhas.push("", `Meses fora das médias: ${periodos.map((p) => `${p.anoMes} (${p.tipo === "parcial" ? "parcial" : "sem dado"})`).join(", ") || "nenhum"}.`);
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Gráficos em SVG (fundo branco, cores chart-1 e chart-2 do tema claro) para o relatório
// ---------------------------------------------------------------------------------------------

// Identidade Agrovia (D48)
const COR_1 = "#005BA0";
const COR_2 = "#4CB033";
const COR_TEXTO = "#2B2B2B";
const COR_LINHA = "#D1D9E6";
const ESCAPAR = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

interface Barra {
  rotulo: string;
  valores: (number | null)[];
  textos: (string | null)[];
}

function svgBarras(titulo: string, descricao: string, series: { nome: string; cor: string }[], barras: Barra[]): string {
  const larg = 84;
  const topo = 64;
  const util = 220;
  const base = 56;
  const largura = 24 + barras.length * larg;
  const altura = topo + util + base;
  const maximo = Math.max(1e-9, ...barras.flatMap((b) => b.valores.filter((v): v is number => v !== null)));
  const lb = (larg - 14) / series.length;
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" font-family="Arial, sans-serif">`,
    `<title>${ESCAPAR(titulo)}</title><desc>${ESCAPAR(descricao)}</desc>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="12" y="20" font-size="14" font-weight="700" fill="${COR_TEXTO}">${ESCAPAR(titulo)}</text>`,
    `<text x="12" y="38" font-size="10" fill="${COR_TEXTO}">${ESCAPAR(descricao)}</text>`,
  ];
  series.forEach((sr, i) => {
    partes.push(`<rect x="${12 + i * 110}" y="46" width="10" height="10" rx="2" fill="${sr.cor}"/><text x="${28 + i * 110}" y="55" font-size="10" fill="${COR_TEXTO}">${ESCAPAR(sr.nome)}</text>`);
  });
  partes.push(`<line x1="12" x2="${largura - 12}" y1="${topo + util}" y2="${topo + util}" stroke="${COR_LINHA}"/>`);
  barras.forEach((b, ci) => {
    const x0 = 12 + ci * larg + 7;
    b.valores.forEach((v, si) => {
      const x = x0 + si * lb;
      if (v === null) {
        partes.push(`<text x="${x + lb / 2}" y="${topo + util - 4}" font-size="9" text-anchor="middle" fill="${COR_TEXTO}">sem dado</text>`);
        return;
      }
      const h = Math.max((v / maximo) * util, 1);
      partes.push(`<rect x="${x}" y="${topo + util - h}" width="${lb - 2}" height="${h}" rx="2" fill="${series[si].cor}"/>`);
      partes.push(`<text x="${x + (lb - 2) / 2}" y="${topo + util - h - 4}" font-size="10" text-anchor="middle" fill="${COR_TEXTO}">${ESCAPAR(b.textos[si] ?? "")}</text>`);
    });
    partes.push(`<text x="${x0 + (series.length * lb) / 2}" y="${topo + util + 18}" font-size="10" text-anchor="middle" fill="${COR_TEXTO}">${ESCAPAR(b.rotulo)}</text>`);
  });
  partes.push("</svg>");
  return partes.join("\n");
}

/** Escreve os SVG em `docs/artefatos/img/`. Mesmo conteúdo a cada rodada (idempotente). */
export function gerarGraficos(db: Db, pastaImg: string): string[] {
  fs.mkdirSync(pastaImg, { recursive: true });
  const h = resumoHistorico(db, { tipo: "tudo" });
  const meses: Barra[] = h.meses.map((m) => ({
    rotulo: m.anoMes,
    valores: m.resumo ? [Number(paraTexto(m.resumo.excessoMedioChapas)), Number(paraTexto(m.resumo.faltaMediaChapas))] : [null, null],
    textos: m.resumo ? [f2(m.resumo.excessoMedioChapas), f2(m.resumo.faltaMediaChapas)] : [null, null],
  }));
  const grafico1 = svgBarras(
    "Excesso e falta médios por mês (histórico)",
    "Funcionários por dia comparado. Excesso é teto e falta é piso. Mês sem dado ou parcial fica sem barra.",
    [
      { nome: "Excesso", cor: COR_1 },
      { nome: "Falta", cor: COR_2 },
    ],
    meses,
  );
  const c = cargasPorDia(db, { tipo: "tudo" });
  const porMes = new Map<string, { dias: number; cargas: number }>();
  for (const d of c?.dias ?? []) {
    const a = porMes.get(d.data.slice(0, 7)) ?? { dias: 0, cargas: 0 };
    a.dias++;
    a.cargas += d.total;
    porMes.set(d.data.slice(0, 7), a);
  }
  const desde = "2025-01"; // mesmo intervalo da folha, para ficar lado a lado com o gráfico anterior
  const cargas: Barra[] = [...porMes.entries()]
    .filter(([m]) => m >= desde)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, a]) => {
      const media = dividir(deInteiro(a.cargas), deInteiro(a.dias));
      return { rotulo: m, valores: [Number(paraTexto(media))], textos: [f2(media)] };
    });
  const grafico2 = svgBarras(
    "Cargas por dia, média de cada mês (histórico)",
    "Caminhões por dia com recebimento. Aproximação da D21: mesmo fornecedor na mesma data de recebimento.",
    [{ nome: "Cargas por dia", cor: COR_1 }],
    cargas,
  );
  const arquivos: [string, string][] = [
    ["excesso-falta-por-mes.svg", grafico1],
    ["cargas-por-dia-por-mes.svg", grafico2],
  ];
  for (const [nome, conteudo] of arquivos) fs.writeFileSync(path.join(pastaImg, nome), conteudo + "\n", "utf8");
  return arquivos.map(([nome]) => nome);
}

const BLOCOS: Record<string, (db: Db) => string> = {
  graficos: () =>
    [
      "![Excesso e falta médios por mês, histórico](artefatos/img/excesso-falta-por-mes.svg)",
      "",
      "![Cargas por dia, média de cada mês, histórico](artefatos/img/cargas-por-dia-por-mes.svg)",
    ].join("\n"),
  resposta: blocoResposta,
  numeros: blocoNumeros,
  meses: blocoMeses,
  armazem: blocoArmazem,
  importacao: blocoImportacao,
};

/** Substitui o conteúdo entre os marcadores. Marcador ausente no arquivo é ignorado; o texto fora dos marcadores fica igual. */
export function aplicarBlocos(texto: string, db: Db): string {
  let saida = texto;
  for (const [nome, gerar] of Object.entries(BLOCOS)) {
    const re = new RegExp(`(<!-- gerar:${nome} -->)[\\s\\S]*?(<!-- /gerar:${nome} -->)`);
    if (re.test(saida)) saida = saida.replace(re, (_m, a: string, b: string) => `${a}\n${gerar(db)}\n${b}`);
  }
  return saida;
}

export function gerarRelatorio(db: Db, caminho: string): boolean {
  const antes = fs.readFileSync(caminho, "utf8");
  const depois = aplicarBlocos(antes, db);
  if (depois !== antes) fs.writeFileSync(caminho, depois, "utf8");
  return depois !== antes;
}

const arquivoAtual = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === arquivoAtual) {
  const caminho = path.resolve(process.cwd(), "..", "docs", "relatorio.md");
  const db = getDb();
  gerarGraficos(db, path.resolve(process.cwd(), "..", "docs", "artefatos", "img"));
  const mudou = gerarRelatorio(db, caminho);
  console.log(mudou ? `Relatório atualizado: ${caminho}` : "Relatório já estava atualizado.");
}
