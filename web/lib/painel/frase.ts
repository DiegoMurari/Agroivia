/**
 * A resposta em frase (RF3-00), no formato do roteiro da demo, em chapas e em reais.
 * Pura: recebe o resumo e devolve o texto. Palavras da Agrovia: "excesso" e "falta" de funcionários.
 * Usada pela página do painel e pelo gerador do relatório, para os dois mostrarem o mesmo texto.
 */
import { formatNumero } from "@/lib/money";
import type { Resumo } from "./sobra-falta";
import { reaisDoSaldo } from "./sobra-falta";

export interface Frase {
  /** Frase principal, no formato do roteiro. */
  principal: string;
  /** Os dois lados, para o saldo líquido não esconder um no outro. */
  detalhe: string;
  /** Como o pico é definido, para vir escrito ao lado do número. */
  pico: string;
  /** Teto e piso, ao lado de todo número histórico. */
  ressalva: string;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const num = (v: Parameters<typeof formatNumero>[0]) => formatNumero(v, 2);

export const RESSALVA_HISTORICO =
  "Estimativa do histórico: a produção vem só do recebimento de compras, sem carregamento de cooperado, remoção e transferência. O excesso é um teto e a falta é um piso.";

export const SEM_DADO = "Sem dado para este período: nenhum mês tem folha e recebimento comparáveis.";

export function fraseDaResposta(r: Resumo, piso: string, rotulo: string): Frase {
  const principal =
    `No período “${rotulo}” houve excesso médio de ${num(r.excessoMedioChapas)} funcionários por dia, ` +
    `cerca de R$ ${num(r.excessoReaisMedio)} por dia em complemento; ` +
    `nos dias de pico, falta mediana de ${num(r.pico.faltaMedianaChapas)} funcionários.`;

  const excesso = r.excessoMedioNosDiasComExcesso
    ? `${r.diasExcesso} ${plural(r.diasExcesso, "dia", "dias")} com excesso (em média ${num(r.excessoMedioNosDiasComExcesso)} funcionários a mais, cerca de R$ ${num(reaisDoSaldo(r.excessoMedioNosDiasComExcesso, piso))} por dia)`
    : "nenhum dia com excesso";
  const falta = r.faltaMediaNosDiasComFalta
    ? `${r.diasFalta} ${plural(r.diasFalta, "dia", "dias")} com falta (em média ${num(r.faltaMediaNosDiasComFalta)} funcionários a menos, cerca de R$ ${num(reaisDoSaldo(r.faltaMediaNosDiasComFalta, piso))} por dia)`
    : "nenhum dia com falta";
  const detalhe = `Em ${r.diasConsiderados} dias úteis comparados: ${excesso}; ${falta}.`;

  const pico =
    `Dias de pico: ${r.pico.criterio}. São ${r.pico.dias} ${plural(r.pico.dias, "dia", "dias")}; ` +
    `falta média de ${num(r.pico.faltaMediaChapas)} e mediana de ${num(r.pico.faltaMedianaChapas)} funcionários.`;
  return { principal, detalhe, pico, ressalva: RESSALVA_HISTORICO };
}
