import { inflateSync } from "node:zlib";

import { ErroNfe, lerNfeXml, type NfeLida } from "./nf-xml";
import { xmlPorChave } from "./xml-por-chave";

/**
 * Leitura do DANFE em PDF: acha a chave de 44 números (no texto do PDF ou no nome do arquivo) e,
 * com a chave, busca a nota completa (peso, itens, espécie) no mesmo ponto de consulta da portaria.
 * Funções puras, exceto a consulta pela chave. Sem biblioteca de PDF: o texto sai dos fluxos do próprio arquivo.
 */

const TAMANHO_MAXIMO = 2 * 1024 * 1024;
/** 44 números, juntos ou em grupos de 4 separados por espaço (como o DANFE imprime). */
const CHAVE = /(?<!\d)(?:\d{4}\s?){10}\d{4}(?!\d)/g;

/** Dígito verificador da chave (módulo 11, pesos de 2 a 9 da direita para a esquerda). */
export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

function chavesEm(texto: string): string[] {
  return (texto.match(CHAVE) ?? []).map((c) => c.replace(/\s/g, "")).filter(chaveValida);
}

/** Texto legível de um PDF: o conteúdo cru mais o de cada fluxo comprimido (FlateDecode). */
function textoDoPdf(conteudo: Buffer): string {
  const bruto = conteudo.toString("latin1");
  const partes = [bruto];
  const fluxo = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = fluxo.exec(bruto)) !== null) {
    const ini = m.index + m[0].length;
    const fim = bruto.indexOf("endstream", ini);
    if (fim < 0) break;
    try {
      partes.push(inflateSync(conteudo.subarray(ini, fim)).toString("latin1"));
    } catch {
      // fluxo que não é Flate (imagem, fonte): ignora
    }
    fluxo.lastIndex = fim;
  }
  return partes.join("\n");
}

/** Chave de acesso do DANFE: do texto do PDF; se não estiver lá, do nome do arquivo. Nulo se nenhuma passar no dígito verificador. */
export function chaveDoPdf(nome: string, conteudo: Buffer): string | null {
  if (conteudo.length <= TAMANHO_MAXIMO) {
    const doTexto = chavesEm(textoDoPdf(conteudo))[0];
    if (doTexto) return doTexto;
  }
  const doNome = nome.match(/(?<!\d)\d{44}(?!\d)/)?.[0];
  return doNome && chaveValida(doNome) ? doNome : null;
}

/** Nota só com o que a própria chave carrega (CNPJ do emitente, série e número). */
export function nfSoComChave(chave: string): NfeLida {
  return {
    chaveAcesso: chave,
    numero: String(Number(chave.slice(25, 34))),
    serie: String(Number(chave.slice(22, 25))),
    emitenteCnpj: chave.slice(6, 20),
    emitenteNome: null,
    emitidaEm: null,
    valorTotal: null,
    volumes: null,
    especie: null,
    pesoLiquidoKg: null,
    pesoBrutoKg: null,
    placa: null,
    transportadora: null,
    pedidoFornecedor: null,
    itens: [],
    acondicionamentoSugerido: null,
  };
}

/** Nota completa pela chave (XML do pacote ou, em produção, da SEFAZ), ou nulo se não estiver disponível. */
export function nfCompletaPelaChave(chave: string): NfeLida | null {
  const xml = xmlPorChave(chave);
  if (!xml) return null;
  try {
    return lerNfeXml(xml.toString("utf8"));
  } catch (e) {
    if (e instanceof ErroNfe) return null;
    throw e;
  }
}
