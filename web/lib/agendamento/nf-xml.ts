import { XMLParser } from "fast-xml-parser";

import type { AcondicionamentoNf } from "@/lib/db/enums";
import { decOuNulo, paraTexto, somar, type Valor } from "@/lib/money";

/**
 * Leitor de NF-e (XML). Função pura: recebe o texto e devolve os dados lidos.
 * Todo número sai como texto decimal (o parser não converte), sem arredondar.
 */

export interface ItemNfe {
  codigo: string | null;
  descricao: string | null;
  quantidade: string | null;
  unidade: string | null;
  valorUnitario: string | null;
  pedido: string | null;
}

export interface NfeLida {
  chaveAcesso: string;
  numero: string | null;
  serie: string | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  emitidaEm: string | null;
  valorTotal: string | null;
  /** Soma de `vol/qVol`. */
  volumes: string | null;
  especie: string | null;
  /** Soma de `vol/pesoL`. */
  pesoLiquidoKg: string | null;
  /** Soma de `vol/pesoB`. */
  pesoBrutoKg: string | null;
  placa: string | null;
  transportadora: string | null;
  /** `xPed` do primeiro item que o trouxer. */
  pedidoFornecedor: string | null;
  itens: ItemNfe[];
  /** Sugestão pela espécie; o batido é sempre o fornecedor quem marca. */
  acondicionamentoSugerido: AcondicionamentoNf | null;
}

export class ErroNfe extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNfe";
  }
}

type No = Record<string, unknown>;

const parser = new XMLParser({
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  // só as 5 entidades padrão (&amp; &lt; &gt; &quot; &apos;), com teto de expansão; DOCTYPE é recusado em lerNfeXml
  processEntities: { enabled: true, maxTotalExpansions: 1000, maxEntitySize: 200 },
  htmlEntities: false,
  isArray: (nome) => nome === "det" || nome === "vol",
});

function noDe(valor: unknown): No | undefined {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as No) : undefined;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string") return valor.trim() === "" ? null : valor.trim();
  if (typeof valor === "number") return String(valor);
  return null;
}

function decimal(valor: unknown): string | null {
  const t = texto(valor);
  if (t === null) return null;
  const v = decOuNulo(t);
  return v === null ? null : paraTexto(v);
}

function somarCampos(volumes: No[], campo: string): string | null {
  const valores = volumes.map((v) => decOuNulo(texto(v[campo])));
  // volume sem o campo: a soma seria parcial e subestimada, então não devolve nada
  if (valores.length === 0 || valores.some((v) => v === null)) return null;
  return paraTexto(somar(...(valores as Valor[])));
}

/** Espécie sem maiúsculas, espaços nem acentos. */
function normalizarEspecie(esp: string): string {
  return esp
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function sugerirAcondicionamento(especie: string | null): AcondicionamentoNf | null {
  if (!especie) return null;
  const e = normalizarEspecie(especie);
  // "BIG-BAG 1000KG", "PALLET PBR" e similares: a espécie traz a palavra no meio do texto
  if (e.includes("BIGBAG")) return "big_bag";
  if (e.includes("PALETE") || e.includes("PALLET")) return "paletizado";
  return null;
}

export function lerNfeXml(conteudo: string): NfeLida {
  // NF-e não declara DTD nem entidades próprias: recusa para não expandir entidade definida no arquivo
  if (/<!DOCTYPE|<!ENTITY/i.test(conteudo)) {
    throw new ErroNfe("O arquivo tem declaração de DTD, que não existe numa NF-e. Anexe o XML original baixado do emitente.");
  }
  let raiz: No;
  try {
    raiz = parser.parse(conteudo) as No;
  } catch {
    throw new ErroNfe("O arquivo não é um XML válido. Baixe de novo o XML da NF-e no sistema do emitente e anexe o arquivo original.");
  }

  const nfe = noDe(noDe(raiz.nfeProc)?.NFe) ?? noDe(raiz.NFe);
  const inf = noDe(nfe?.infNFe);
  if (!inf) {
    throw new ErroNfe("O XML não é uma NF-e (não achei a tag infNFe). Anexe o XML da nota fiscal eletrônica, não o de outro documento.");
  }

  const id = texto(inf["@_Id"]) ?? "";
  const chave = id.replace(/^NFe/i, "");
  if (!/^\d{44}$/.test(chave)) {
    throw new ErroNfe("A chave de acesso do XML não tem 44 dígitos. Confira se o arquivo é o XML original da NF-e.");
  }

  const ide = noDe(inf.ide);
  const emit = noDe(inf.emit);
  const transp = noDe(inf.transp);
  const volumes = ((transp?.vol as unknown[] | undefined) ?? []).map(noDe).filter((v): v is No => v !== undefined);
  const dets = ((inf.det as unknown[] | undefined) ?? []).map(noDe).filter((d): d is No => d !== undefined);

  const itens: ItemNfe[] = dets.map((det) => {
    const prod = noDe(det.prod) ?? {};
    return {
      codigo: texto(prod.cProd),
      descricao: texto(prod.xProd),
      quantidade: decimal(prod.qCom),
      unidade: texto(prod.uCom),
      valorUnitario: decimal(prod.vUnCom),
      pedido: texto(prod.xPed),
    };
  });

  const especie = volumes.map((v) => texto(v.esp)).find((e) => e !== null) ?? null;

  return {
    chaveAcesso: chave,
    numero: texto(ide?.nNF),
    serie: texto(ide?.serie),
    emitenteCnpj: texto(emit?.CNPJ) ?? texto(emit?.CPF),
    emitenteNome: texto(emit?.xNome),
    emitidaEm: texto(ide?.dhEmi) ?? texto(ide?.dEmi),
    valorTotal: decimal(noDe(noDe(inf.total)?.ICMSTot)?.vNF),
    volumes: somarCampos(volumes, "qVol"),
    especie,
    pesoLiquidoKg: somarCampos(volumes, "pesoL"),
    pesoBrutoKg: somarCampos(volumes, "pesoB"),
    placa: texto(noDe(transp?.veicTransp)?.placa),
    transportadora: texto(noDe(transp?.transporta)?.xNome),
    pedidoFornecedor: itens.map((i) => i.pedido).find((p) => p !== null) ?? null,
    itens,
    acondicionamentoSugerido: sugerirAcondicionamento(especie),
  };
}
