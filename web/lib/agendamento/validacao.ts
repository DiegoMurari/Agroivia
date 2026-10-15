import { decOuNulo, igual, paraTexto, somar, type Valor } from "@/lib/money";
import type { ValidacaoStatus } from "@/lib/db/enums";

/**
 * Validação NF x pedido (RF1-05, D39). Regra pura: compara a(s) NF do agendamento com a compra.
 * Gera alertas automáticos (CNPJ, quantidade, peso) e sugere o resultado; quem decide é Compras.
 * Sem itens na compra, a validação é manual (`aguardando`).
 */

export interface NfParaValidar {
  emitenteCnpj: string | null;
  pesoLiquidoKg: string | null;
  pesoBrutoKg: string | null;
  itens: { quantidade: string | null }[];
}

export interface CompraParaValidar {
  fornecedorCnpj: string | null;
  itens: { quantidade: string | null; pesoKg: string | null }[];
}

export type TipoAlerta = "cnpj" | "quantidade" | "peso";

export interface AlertaValidacao {
  tipo: TipoAlerta;
  mensagem: string;
}

export interface ResultadoValidacao {
  alertas: AlertaValidacao[];
  sugestao: ValidacaoStatus;
}

function digitos(t: string | null): string {
  return (t ?? "").replace(/\D/g, "");
}

function somaOuNulo(valores: (string | null)[]): Valor | null {
  const v = valores.map((x) => decOuNulo(x)).filter((x): x is Valor => x !== null);
  return v.length === 0 ? null : somar(...v);
}

function fmt(v: Valor): string {
  return paraTexto(v).replace(".", ",");
}

export function validarNfPedido(nfs: readonly NfParaValidar[], compra: CompraParaValidar): ResultadoValidacao {
  const alertas: AlertaValidacao[] = [];

  const cnpjForn = digitos(compra.fornecedorCnpj);
  if (cnpjForn) {
    const emitentes = new Set(nfs.map((nf) => digitos(nf.emitenteCnpj)));
    for (const emit of emitentes) {
      if (emit && emit !== cnpjForn) {
        alertas.push({ tipo: "cnpj", mensagem: `CNPJ do emitente (${emit}) é diferente do CNPJ do fornecedor da compra (${cnpjForn}).` });
      }
    }
  }

  if (compra.itens.length === 0) {
    return { alertas, sugestao: "aguardando" };
  }

  const qtdNf = somaOuNulo(nfs.flatMap((nf) => nf.itens.map((i) => i.quantidade)));
  const qtdCompra = somaOuNulo(compra.itens.map((i) => i.quantidade));
  if (qtdNf && qtdCompra && !igual(qtdNf, qtdCompra)) {
    alertas.push({ tipo: "quantidade", mensagem: `Quantidade da NF (${fmt(qtdNf)}) é diferente da quantidade da compra (${fmt(qtdCompra)}).` });
  }

  const pesoNf = somaOuNulo(nfs.map((nf) => nf.pesoLiquidoKg ?? nf.pesoBrutoKg));
  const pesoCompra = somaOuNulo(compra.itens.map((i) => i.pesoKg));
  if (pesoNf && pesoCompra && !igual(pesoNf, pesoCompra)) {
    alertas.push({ tipo: "peso", mensagem: `Peso da NF (${fmt(pesoNf)} kg) é diferente do peso da compra (${fmt(pesoCompra)} kg).` });
  }

  return { alertas, sugestao: alertas.length > 0 ? "divergente" : "conforme" };
}
