/**
 * XML de NF-e do pacote (amostra de formato, não de volume): leitura e tratamento (D22, D42).
 * Chave em `infNFe@Id` sem o prefixo `NFe`; `transp/vol` pode ser um ou vários; a placa pode faltar.
 * Espécie e acondicionamento só entram quando a chave casa com a movimentação (D22): nunca inferir.
 */
import fs from "node:fs";
import path from "node:path";

import { XMLParser } from "fast-xml-parser";

import { paraTexto, somar } from "@/lib/money";
import { contar, numeroComoTexto, soDigitos, texto } from "./util";

export type AcondicionamentoXml = "batido" | "paletizado" | "big_bag" | "maquina";

export interface NfXmlBruta {
  arquivo: string;
  /** Conteúdo do XML; null se o arquivo não pôde ser lido. */
  xml: string | null;
}

export interface NfXmlTratada {
  arquivo: string;
  chaveAcesso: string | null;
  numero: string | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  emitidaEm: string | null;
  saidaEm: string | null;
  valorTotal: string | null;
  pesoLiquidoKg: string | null;
  pesoBrutoKg: string | null;
  volumes: string | null;
  especie: string | null;
  placa: string | null;
  transportadora: string | null;
  modalidadeFrete: string | null;
  pedidoFornecedor: string | null;
  itensQtd: number | null;
  /** Mapeamento da espécie para a norma; null quando a espécie não diz o acondicionamento. */
  acondicionamento: AcondicionamentoXml | null;
  qualidade: string;
  considerada: boolean;
}

export function lerXmls(pacoteDir: string): NfXmlBruta[] {
  const dir = path.join(pacoteDir, "01_notas_fiscais", "xml");
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".xml"))
    .sort()
    .map((arquivo) => {
      try {
        return { arquivo, xml: fs.readFileSync(path.join(dir, arquivo), "utf8") };
      } catch {
        return { arquivo, xml: null };
      }
    });
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Dicionário da espécie declarada (`esp`) para o acondicionamento da norma. Só o que a espécie diz:
 * big bag, palete, máquina, saco e granel (carga batida, saco a saco). Volume, caixa, tonelada e afins
 * não dizem como a carga vem e ficam sem acondicionamento (D22).
 */
export function especieParaAcondicionamento(especie: string | null): AcondicionamentoXml | null {
  if (!especie) return null;
  const e = semAcento(especie).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (/\bBIG ?BAGS?\b|\bBIGBAG\b/.test(e)) return "big_bag";
  if (/\bPALLETS?\b|\bPALETES?\b|\bPALETIZAD/.test(e)) return "paletizado";
  if (/\bMAQUINAS?\b|\bMAQ\b/.test(e)) return "maquina";
  if (/\bSACOS?\b|\bSC\b|\bSAC\b|\bSACARIAS?\b|\bENSACADO\b|\bGRANEL\b/.test(e)) return "batido";
  return null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  isArray: (nome) => nome === "det" || nome === "vol",
});

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

function somaCampo(vols: Obj[], campo: string): string | null {
  const nums = vols.map((v) => numeroComoTexto(v[campo])).filter((n): n is string => n !== null);
  return nums.length ? paraTexto(somar(...nums)) : null;
}

export function tratarXmls(
  brutas: NfXmlBruta[],
  chavesDaMovimentacao?: Set<string>,
): { linhas: NfXmlTratada[]; motivos: Record<string, number> } {
  const motivos: Record<string, number> = {};
  const chavesVistas = new Set<string>();
  const linhas = brutas.map((b): NfXmlTratada => {
    const marcas: string[] = [];
    let considerada = true;
    let inf: Obj = {};
    try {
      if (b.xml === null) throw new Error("ilegível");
      const j = obj(parser.parse(b.xml));
      inf = obj(obj(obj(j.nfeProc).NFe ?? j.NFe).infNFe);
    } catch {
      inf = {};
    }
    if (Object.keys(inf).length === 0) {
      contar(motivos, "xml_invalido");
      contar(motivos, "_fora");
      return {
        arquivo: b.arquivo, chaveAcesso: null, numero: null, emitenteCnpj: null, emitenteNome: null, emitidaEm: null, saidaEm: null,
        valorTotal: null, pesoLiquidoKg: null, pesoBrutoKg: null, volumes: null, especie: null, placa: null, transportadora: null,
        modalidadeFrete: null, pedidoFornecedor: null, itensQtd: null, acondicionamento: null, qualidade: "xml_invalido", considerada: false,
      };
    }

    const chave = soDigitos(String(inf["@Id"] ?? "").replace(/^NFe/, "")) || null;
    if (chave === null || chave.length !== 44) marcas.push("chave_invalida");
    if (chave !== null) {
      if (chavesVistas.has(chave)) {
        marcas.push("chave_repetida");
        considerada = false;
      }
      chavesVistas.add(chave);
      if (chavesDaMovimentacao && !chavesDaMovimentacao.has(chave)) marcas.push("fora_da_movimentacao");
    }
    const ide = obj(inf.ide);
    const emit = obj(inf.emit);
    const transp = obj(inf.transp);
    const vols = (Array.isArray(transp.vol) ? transp.vol : []).map(obj);
    const especies = [...new Set(vols.map((v) => texto(v.esp)).filter((e): e is string => e !== null))];
    const especie = especies.length ? especies.join("; ") : null;
    const acondicionamentos = new Set(especies.map(especieParaAcondicionamento));
    // espécies que mapeiam para acondicionamentos diferentes: carga mista, não se escolhe um
    const acondicionamento = acondicionamentos.size === 1 ? ([...acondicionamentos][0] ?? null) : null;
    const dets = (Array.isArray(inf.det) ? inf.det : []).map(obj);
    const pesoLiquido = somaCampo(vols, "pesoL");
    const pesoBruto = somaCampo(vols, "pesoB");

    if (vols.length === 0) marcas.push("sem_volume");
    if (especie === null) marcas.push("sem_especie");
    if (pesoLiquido === null && pesoBruto === null) marcas.push("sem_peso");
    if (texto(obj(transp.veicTransp).placa) === null) marcas.push("sem_placa");
    if (vols.length > 1) marcas.push("varios_volumes");
    if (dets.length === 0) marcas.push("sem_itens");

    const xPed = dets.map((d) => texto(obj(d.prod).xPed)).find((x) => x !== null && x !== undefined) ?? null;
    for (const m of marcas) contar(motivos, m);
    contar(motivos, considerada ? "_consideradas" : "_fora");
    return {
      arquivo: b.arquivo,
      chaveAcesso: chave,
      numero: texto(ide.nNF),
      emitenteCnpj: soDigitos(emit.CNPJ ?? emit.CPF) || null,
      emitenteNome: texto(emit.xNome),
      emitidaEm: texto(ide.dhEmi ?? ide.dEmi),
      saidaEm: texto(ide.dhSaiEnt ?? ide.dSaiEnt),
      valorTotal: numeroComoTexto(obj(obj(inf.total).ICMSTot).vNF),
      pesoLiquidoKg: pesoLiquido,
      pesoBrutoKg: pesoBruto,
      volumes: somaCampo(vols, "qVol"),
      especie,
      placa: texto(obj(transp.veicTransp).placa),
      transportadora: texto(obj(transp.transporta).xNome),
      modalidadeFrete: texto(transp.modFrete),
      pedidoFornecedor: xPed,
      itensQtd: dets.length,
      acondicionamento,
      qualidade: marcas.join(","),
      considerada,
    };
  });
  return { linhas, motivos };
}
