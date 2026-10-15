import { dec, formatNumero } from "@/lib/money";

/** Resumo de uma NF em uma linha, a partir do que o leitor já extrai. Sem LLM, sem rede. */

export interface NfParaResumo {
  numero: string | null;
  emitenteNome: string | null;
  pesoLiquidoKg: string | null;
  volumes: string | null;
  especie: string | null;
  acondicionamento: string;
  itens: { descricao: string | null }[];
}

const ROTULO_ACOND: Record<string, string> = { batido: "batido", paletizado: "paletizado", big_bag: "big bag" };
const MAX_ITENS = 2;

function peso(p: string | null): string | null {
  if (!p) return null;
  try {
    return `${formatNumero(dec(p), 3).replace(/,?0+$/, "").replace(/,$/, "")} kg`;
  } catch {
    return null;
  }
}

export function resumoNf(nf: NfParaResumo): string {
  const partes: string[] = [];
  partes.push(`NF ${nf.numero ?? "sem número"}`);
  partes.push(nf.emitenteNome ?? "emitente não informado");
  partes.push(peso(nf.pesoLiquidoKg) ?? "peso não informado");
  const vol = [nf.volumes, nf.especie].filter(Boolean).join(" ");
  if (vol) partes.push(vol);
  partes.push(ROTULO_ACOND[nf.acondicionamento] ?? nf.acondicionamento);
  const nomes = nf.itens.map((i) => i.descricao).filter((d): d is string => !!d);
  if (nomes.length > 0) {
    const resto = nomes.length - MAX_ITENS;
    partes.push(nomes.slice(0, MAX_ITENS).join(", ") + (resto > 0 ? ` e mais ${resto}` : ""));
  }
  return partes.join(" · ");
}
