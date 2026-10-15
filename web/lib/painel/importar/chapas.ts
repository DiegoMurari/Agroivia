/**
 * Folha de chapas (`chapas_por_dia.csv`): leitura e tratamento (D18, D20, D42).
 * O café está contido em `presentes`. Linha inconsistente (café maior que presentes) é marcada e fica fora (considerada 0).
 */
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { PeriodoSemDadoTipo } from "@/lib/db/enums";
import { contar, ehFimDeSemanaISO, nomeDiaSemana, numeroComoTexto, paraDataISO, texto } from "./util";

export interface LinhaChapasBruta {
  /** Linha no arquivo (cabeçalho = 1). */
  linha: number;
  data: unknown;
  diaSemana: unknown;
  presentes: unknown;
  cafe: unknown;
  valorPago: unknown;
}

export interface ChapasTratada {
  data: string | null;
  diaSemana: string | null;
  presentes: number | null;
  cafe: number | null;
  valorPago: string | null;
  qualidade: string;
  considerada: boolean;
}

export interface PeriodoSemDado {
  anoMes: string;
  tipo: PeriodoSemDadoTipo;
  motivo: string;
}

const CABECALHO = ["data", "dia_semana", "chapas_presentes", "chapas_operacao_cafe", "valor_pago_dia"];

const inteiro = z.string().regex(/^\d+$/);

export function lerChapasCsv(pacoteDir: string): LinhaChapasBruta[] {
  const bruto = fs.readFileSync(path.join(pacoteDir, "04_mao_de_obra", "chapas_por_dia.csv"), "utf8").replace(/^﻿/, "");
  const linhas = bruto.split(/\r?\n/);
  const cab = linhas[0].split(",").map((c) => c.trim());
  CABECALHO.forEach((nome, i) => {
    if (cab[i] !== nome) throw new Error(`Folha CSV: coluna ${i + 1} deveria ser "${nome}" e é "${cab[i]}".`);
  });
  const saida: LinhaChapasBruta[] = [];
  linhas.forEach((l, i) => {
    if (i === 0 || l.trim() === "") return;
    const c = l.split(",");
    saida.push({ linha: i + 1, data: c[0], diaSemana: c[1], presentes: c[2], cafe: c[3], valorPago: c[4] });
  });
  return saida;
}

function contagem(v: unknown): number | null {
  const s = texto(v);
  if (s === null || !inteiro.safeParse(s).success) return null;
  return Number(s);
}

export function tratarChapas(brutas: LinhaChapasBruta[]): { linhas: ChapasTratada[]; motivos: Record<string, number> } {
  const motivos: Record<string, number> = {};
  const datasVistas = new Set<string>();
  const linhas: ChapasTratada[] = brutas.map((b) => {
    const marcas: string[] = [];
    let considerada = true;
    const data = paraDataISO(b.data);
    const presentes = contagem(b.presentes);
    const cafe = contagem(b.cafe);
    const valorPago = numeroComoTexto(b.valorPago);

    if (data === null) {
      marcas.push("sem_data");
      considerada = false;
    } else {
      const valida = presentes !== null && cafe !== null && cafe <= presentes;
      if (datasVistas.has(data)) {
        marcas.push("data_repetida");
        considerada = false;
      } else if (valida) datasVistas.add(data); // linha inconsistente não "ocupa" o dia
      if (ehFimDeSemanaISO(data)) marcas.push("fim_de_semana");
      const dia = texto(b.diaSemana);
      if (dia !== null && dia.toLowerCase() !== nomeDiaSemana(data)) marcas.push("dia_semana_diverge");
    }
    if (presentes === null) {
      marcas.push("presentes_invalido");
      considerada = false;
    }
    if (cafe === null) {
      marcas.push("cafe_invalido");
      considerada = false;
    } else if (presentes !== null && cafe > presentes) {
      marcas.push("cafe_maior_que_presentes");
      considerada = false;
    } else if (cafe > 0) marcas.push("operacao_cafe");
    if (valorPago === null) marcas.push("valor_pago_invalido");

    const qualidade = marcas.join(",");
    for (const m of marcas) contar(motivos, m);
    contar(motivos, considerada ? "_consideradas" : "_fora");
    return { data, diaSemana: texto(b.diaSemana), presentes, cafe, valorPago, qualidade, considerada };
  });
  return { linhas, motivos };
}

function proximoMes(anoMes: string): string {
  const [a, m] = anoMes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Meses sem nenhuma linha dentro do intervalo da folha viram `sem_dado`; meses com menos de `diasMinimos`
 * dias de folha viram `parcial` (D20). Sem interpolação. Só olha as linhas consideradas.
 */
export function periodosSemDado(linhas: ChapasTratada[], diasMinimos: number): PeriodoSemDado[] {
  const porMes = new Map<string, number>();
  for (const l of linhas) {
    if (l.considerada && l.data) porMes.set(l.data.slice(0, 7), (porMes.get(l.data.slice(0, 7)) ?? 0) + 1);
  }
  if (porMes.size === 0) return [];
  const meses = [...porMes.keys()].sort();
  const saida: PeriodoSemDado[] = [];
  for (let m = meses[0]; m <= meses[meses.length - 1]; m = proximoMes(m)) {
    const dias = porMes.get(m) ?? 0;
    if (dias === 0) saida.push({ anoMes: m, tipo: "sem_dado", motivo: "Nenhuma linha de folha utilizável neste mês (sem interpolação)." });
    else if (dias < diasMinimos)
      saida.push({ anoMes: m, tipo: "parcial", motivo: `Só ${dias} dias de folha, abaixo do mínimo de ${diasMinimos} (fora das médias).` });
  }
  return saida;
}
