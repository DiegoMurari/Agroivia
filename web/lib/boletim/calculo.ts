/**
 * Cálculo do boletim (RF2-04, RF2-05, RF2-07). Função pura: a tela e o servidor usam esta mesma.
 * Tudo em decimal.js, sem arredondar; o valor por diária (10 casas) é só para exibir (D03).
 */
import { dec, deInteiro, dividir, menorQue, multiplicar, paraTexto, paraTextoCasas, somar, subtrair, ZERO, type Valor } from "@/lib/money";
import { parametrosBoletim, type ParametrosBoletim } from "./params";

export class ErroBoletim extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroBoletim";
  }
}

export interface LinhaEntrada {
  /** Preço unitário em texto decimal (de `tipo_item`). */
  preco: string;
  descarga?: string;
  remocao?: string;
  transferencia?: string;
}

export interface ChapaEntrada {
  matricula: string;
  tipo: "completa" | "meia";
}

export interface EntradaBoletim {
  linhas: LinhaEntrada[];
  equipe: ChapaEntrada[];
  parametros?: ParametrosBoletim;
}

export interface LinhaCalculada {
  quantidade: string;
  valor: string;
}

export interface ResultadoBoletim {
  linhas: LinhaCalculada[];
  producaoTotal: string;
  diariasEquivalentes: string;
  /** 10 casas, só para exibir. */
  valorPorDiaria: string;
  totalAPagar: string;
  complemento: string;
  /** Complemento maior que zero. Igual ao piso conta como acima (T4). */
  abaixoDoPiso: boolean;
}

function quantidade(texto: string | undefined, rotulo: string): Valor {
  if (texto === undefined || texto.trim() === "") return ZERO;
  let valor: Valor;
  try {
    valor = dec(texto);
  } catch {
    throw new ErroBoletim(`Quantidade inválida em ${rotulo}: "${texto}". Digite só números, ex.: 2778.`);
  }
  if (valor.isNegative()) throw new ErroBoletim(`A quantidade de ${rotulo} não pode ser negativa. Corrija o valor.`);
  return valor;
}

/** Valida a equipe (1 ao máximo, sem matrícula repetida) e devolve as diárias equivalentes. */
export function diariasEquivalentes(equipe: ChapaEntrada[], parametros: ParametrosBoletim): Valor {
  if (equipe.length === 0) throw new ErroBoletim("O boletim precisa de pelo menos 1 funcionário. Inclua a equipe do dia.");
  if (equipe.length > parametros.maxChapas) {
    throw new ErroBoletim(`O boletim aceita no máximo ${parametros.maxChapas} funcionários e esta equipe tem ${equipe.length}. Tire os funcionários que passam do limite.`);
  }
  const vistas = new Set<string>();
  for (const c of equipe) {
    if (vistas.has(c.matricula)) throw new ErroBoletim(`O funcionário ${c.matricula} aparece mais de uma vez na equipe. Deixe só uma linha para ela.`);
    vistas.add(c.matricula);
  }
  const meias = equipe.filter((c) => c.tipo === "meia").length;
  const total = somar(deInteiro(equipe.length - meias), multiplicar(deInteiro(meias), parametros.fatorMeia));
  if (total.lte(0)) throw new ErroBoletim("As diárias equivalentes da equipe somam zero. Ajuste o fator da meia diária.");
  return total;
}

export function calcularBoletim(entrada: EntradaBoletim): ResultadoBoletim {
  const parametros = entrada.parametros ?? parametrosBoletim();
  const diarias = diariasEquivalentes(entrada.equipe, parametros);

  const linhas = entrada.linhas.map((l, i) => {
    const qtd = somar(
      quantidade(l.descarga, `descarga da linha ${i + 1}`),
      quantidade(l.remocao, `remoção da linha ${i + 1}`),
      quantidade(l.transferencia, `transferência da linha ${i + 1}`),
    );
    return { quantidade: paraTexto(qtd), valor: paraTexto(multiplicar(qtd, l.preco)) };
  });

  const producao = somar(...linhas.map((l) => l.valor));
  const minimo = multiplicar(parametros.piso, diarias);
  const abaixo = menorQue(producao, minimo);
  const total = abaixo ? minimo : producao;

  return {
    linhas,
    producaoTotal: paraTexto(producao),
    diariasEquivalentes: paraTexto(diarias),
    valorPorDiaria: paraTextoCasas(dividir(producao, diarias), 10),
    totalAPagar: paraTexto(total),
    complemento: paraTexto(subtrair(total, producao)),
    abaixoDoPiso: abaixo,
  };
}
