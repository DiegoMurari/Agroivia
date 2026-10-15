import { ORIGEM, type Origem } from "@/lib/db/enums";

/**
 * Origem das linhas novas (D06, D37). No evento o `.env` traz ORIGEM_PADRAO=teste;
 * sem a variável, `operacao`. Toda linha operacional gravada leva `origem: origemPadrao()`.
 */
export function origemPadrao(): Origem {
  const valor = process.env.ORIGEM_PADRAO?.trim();
  if (!valor) return "operacao";
  if (!(ORIGEM as readonly string[]).includes(valor)) {
    throw new Error(`ORIGEM_PADRAO inválida: "${valor}". Use ${ORIGEM.join(", ")}.`);
  }
  return valor as Origem;
}
