import DecimalBase from "decimal.js";

/**
 * Dinheiro, peso e quantidade com casas decimais (D02, D03).
 * Texto decimal no banco, decimal.js no código, nunca `number`.
 * Nada aqui arredonda no cálculo: 2 casas só em formatBRL e formatNumero.
 */
const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
  toExpNeg: -60,
  toExpPos: 60,
});

export type Valor = InstanceType<typeof Decimal>;
/** O que as funções aceitam: texto decimal com ponto (`"0.3224"`) ou um Valor. */
export type Entrada = string | Valor;

const TEXTO_DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/** Lê texto decimal com ponto (`"918.1952"`). Recusa vazio, vírgula, expoente e NaN. */
export function dec(valor: Entrada): Valor {
  if (typeof valor !== "string") return valor;
  const texto = valor.trim();
  if (!TEXTO_DECIMAL.test(texto)) {
    throw new Error(`Valor decimal inválido: "${valor}". Use ponto e só dígitos, ex.: "0.3224".`);
  }
  return new Decimal(texto);
}

/** Lê um inteiro (contagem: chapas, linhas, minutos). Recusa número com casas. */
export function deInteiro(inteiro: number | bigint): Valor {
  if (typeof inteiro === "number" && !Number.isSafeInteger(inteiro)) {
    throw new Error(`deInteiro só aceita inteiro; recebeu ${inteiro}. Para valor com casas use texto.`);
  }
  return new Decimal(inteiro.toString());
}

/**
 * Lê o que o usuário digitou no padrão brasileiro: `"1.289,60"`, `"0,3224"`, `"2778"`.
 * Recusa o ambíguo em vez de adivinhar: `"2.778"` (milhar ou decimal?) e `"1,289.60"` (padrão americano).
 */
export function decBR(texto: string): Valor {
  const limpo = texto.trim().replace(/\s/g, "");
  const ambiguo = !limpo.includes(",") && /^[+-]?\d{1,3}(\.\d{3})+$/.test(limpo);
  const americano = limpo.includes(",") && limpo.indexOf(",") < limpo.lastIndexOf(".");
  if (ambiguo || americano) {
    throw new Error(`Número ambíguo: "${texto}". Use vírgula para as casas decimais, ex.: 2778 ou 2.778,00.`);
  }
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return dec(normal);
}

/** Igual a `dec`, mas devolve null em vez de lançar (célula vazia, dado sujo). */
export function decOuNulo(valor: string | null | undefined): Valor | null {
  if (valor === null || valor === undefined) return null;
  const texto = valor.trim();
  return TEXTO_DECIMAL.test(texto) ? new Decimal(texto) : null;
}

export const ZERO: Valor = new Decimal(0);

export function somar(...valores: Entrada[]): Valor {
  return valores.reduce<Valor>((total, v) => total.plus(dec(v)), ZERO);
}

export function subtrair(a: Entrada, b: Entrada): Valor {
  return dec(a).minus(dec(b));
}

export function multiplicar(a: Entrada, b: Entrada): Valor {
  return dec(a).times(dec(b));
}

/** Divisão com 40 dígitos significativos. Divisor zero lança erro (nunca Infinity ou NaN). */
export function dividir(a: Entrada, b: Entrada): Valor {
  const divisor = dec(b);
  if (divisor.isZero()) throw new Error("Divisão por zero.");
  return dec(a).div(divisor);
}

/** -1 se a < b, 0 se iguais, 1 se a > b. Serve de comparador em `sort`. */
export function comparar(a: Entrada, b: Entrada): -1 | 0 | 1 {
  return dec(a).cmp(dec(b)) as -1 | 0 | 1;
}

/** Igualdade de valor: `"54.8080"` e `"54.808"` são iguais. Nunca compare texto com texto. */
export function igual(a: Entrada, b: Entrada): boolean {
  return dec(a).eq(dec(b));
}

export function menorQue(a: Entrada, b: Entrada): boolean {
  return dec(a).lt(dec(b));
}

export function maiorQue(a: Entrada, b: Entrada): boolean {
  return dec(a).gt(dec(b));
}

export function maior(a: Entrada, b: Entrada): Valor {
  return maiorQue(a, b) ? dec(a) : dec(b);
}

/** Texto para gravar no banco: ponto, sem expoente, sem zero à direita, precisão cheia. */
export function paraTexto(valor: Entrada): string {
  return dec(valor).toFixed();
}

/** Texto com casas fixas (ex.: valor por diária com 10 casas). Só para exibir ou auditar. */
export function paraTextoCasas(valor: Entrada, casas: number): string {
  return dec(valor).toFixed(casas, Decimal.ROUND_HALF_UP);
}

/** Exibição brasileira com casas fixas e ROUND_HALF_UP: `"1289.6"` → `"1.289,60"`. */
export function formatNumero(valor: Entrada, casas = 2): string {
  const fixo = dec(valor).toFixed(casas, Decimal.ROUND_HALF_UP);
  const negativo = fixo.startsWith("-");
  const [inteiro, fracao] = (negativo ? fixo.slice(1) : fixo).split(".");
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const corpo = fracao ? `${milhares},${fracao}` : milhares;
  const zero = /^[0.,]+$/.test(corpo);
  return negativo && !zero ? `-${corpo}` : corpo;
}

/** Exibição em reais: `"946.81755"` → `"R$ 946,82"`. Os "exibe" do PRD são `formatNumero`. */
export function formatBRL(valor: Entrada): string {
  const texto = formatNumero(valor, 2);
  return texto.startsWith("-") ? `-R$ ${texto.slice(1)}` : `R$ ${texto}`;
}
