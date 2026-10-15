/**
 * Cargas históricas (D21): caminhão = linhas consideradas do mesmo fornecedor (`cod_pn`) na mesma data de recebimento.
 * É aproximação declarada. O armazém da carga segue o grupo de cada item (D16): carga em dois armazéns conta
 * uma vez em cada e uma vez no total. Espécie e acondicionamento só quando TODAS as notas da carga têm XML (D22).
 */
import { paraTexto, somar } from "@/lib/money";
import type { MovTratada } from "./movimentacao";
import type { NfXmlTratada } from "./nf-xml";
import { especieParaAcondicionamento } from "./nf-xml";

export interface CargaArmazem {
  armazemId: number;
  itensQtd: number;
  pesoKg: string | null;
  quantidadeBoletim: string | null;
  producaoEstimada: string | null;
}

export interface CargaHist {
  /** Id determinístico (ordem por data e fornecedor), para rodar duas vezes dar o mesmo resultado. */
  id: number;
  codPn: string;
  data: string;
  notasQtd: number;
  itensQtd: number;
  pesoTotalKg: string | null;
  especieXml: string | null;
  acondicionamentoXml: string | null;
  armazens: CargaArmazem[];
}

function somaOuNulo(valores: (string | null)[]): string | null {
  const v = valores.filter((x): x is string => x !== null);
  return v.length ? paraTexto(somar(...v)) : null;
}

export function derivarCargas(movs: MovTratada[], xmls: NfXmlTratada[]): CargaHist[] {
  const xmlPorChave = new Map<string, NfXmlTratada>();
  for (const x of xmls) if (x.considerada && x.chaveAcesso) xmlPorChave.set(x.chaveAcesso, x);

  const grupos = new Map<string, MovTratada[]>();
  for (const l of movs) {
    if (!l.considerada || !l.codPn || !l.dataRecebimento) continue;
    const k = `${l.dataRecebimento}|${l.codPn}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(l);
  }

  const cargas: CargaHist[] = [];
  for (const k of [...grupos.keys()].sort()) {
    const linhas = grupos.get(k)!;
    const [data, codPn] = k.split("|");
    const notas = new Set(linhas.map((l) => l.chaveAcesso ?? `${l.pedidoCompra}|${l.nfNumero}`));
    const chaves = [...new Set(linhas.map((l) => l.chaveAcesso).filter((c): c is string => c !== null))];
    const todasComXml = chaves.length > 0 && chaves.length === notas.size && chaves.every((c) => xmlPorChave.has(c));
    let especieXml: string | null = null;
    let acondicionamentoXml: string | null = null;
    if (todasComXml) {
      const especies = [...new Set(chaves.map((c) => xmlPorChave.get(c)!.especie).filter((e): e is string => e !== null))];
      especieXml = especies.length ? especies.join("; ") : null;
      const acond = new Set(especies.map(especieParaAcondicionamento));
      if (especies.length > 0 && !acond.has(null)) acondicionamentoXml = [...acond].sort().join(",");
    }

    const porArmazem = new Map<number, MovTratada[]>();
    for (const l of linhas) {
      if (l.armazemId === null) continue;
      (porArmazem.get(l.armazemId) ?? porArmazem.set(l.armazemId, []).get(l.armazemId)!).push(l);
    }
    cargas.push({
      id: cargas.length + 1,
      codPn,
      data,
      notasQtd: notas.size,
      itensQtd: linhas.length,
      pesoTotalKg: somaOuNulo(linhas.map((l) => l.pesoKg)),
      especieXml,
      acondicionamentoXml,
      armazens: [...porArmazem.entries()]
        .sort(([a], [b]) => a - b)
        .map(([armazemId, ls]) => ({
          armazemId,
          itensQtd: ls.length,
          pesoKg: somaOuNulo(ls.map((l) => l.pesoKg)),
          quantidadeBoletim: somaOuNulo(ls.map((l) => l.quantidadeBoletim)),
          producaoEstimada: somaOuNulo(ls.map((l) => l.producaoEstimada)),
        })),
    });
  }
  return cargas;
}
