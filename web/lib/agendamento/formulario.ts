import { z } from "zod";

import { ACONDICIONAMENTO_NF } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";

import { TAMANHO_MAXIMO_ARQUIVO, conferirTamanhoDoCorpo, type ArquivoEnviado } from "./agendar";
import type { DadosPedido } from "./pedido";

/** Lê o formulário multipart do portal (pedido novo ou edição) e devolve os dados já conferidos. */

const esquemaManuais = z.array(
  z.object({
    chaveAcesso: z.string().max(60),
    numero: z.string().max(20).nullish(),
    emitenteCnpj: z.string().max(20).nullish(),
    valorTotal: z.string().max(20).nullish(),
    pesoLiquidoKg: z.string().max(20).nullish(),
  }),
);

function json(valor: FormDataEntryValue | null, padrao: unknown): unknown {
  try {
    return JSON.parse(String(valor ?? JSON.stringify(padrao)));
  } catch {
    return undefined;
  }
}

function texto(valor: FormDataEntryValue | null, max: number): string | null {
  const t = typeof valor === "string" ? valor.trim() : "";
  return t ? t.slice(0, max) : null;
}

export async function lerFormularioDoPedido(request: Request): Promise<DadosPedido> {
  conferirTamanhoDoCorpo(request.headers.get("content-length"));
  const form = await request.formData();
  const arquivos = form.getAll("arquivos").filter((f): f is File => typeof f !== "string");
  if (arquivos.length > 10) throw new ErroDeRegra("No máximo 10 notas por pedido.", { status: 400 });

  const acond = z.array(z.enum(ACONDICIONAMENTO_NF)).safeParse(json(form.get("acondicionamentos"), []));
  const manuais = esquemaManuais.safeParse(json(form.get("manuais"), []));
  if (!acond.success || !manuais.success) throw new ErroDeRegra("Os dados das notas anexadas estão incompletos. Anexe de novo.", { status: 400 });
  if (acond.data.length !== arquivos.length) throw new ErroDeRegra("Informe o acondicionamento de cada nota anexada.", { status: 400 });
  if (manuais.data.length > arquivos.length) throw new ErroDeRegra("Dados de PDF demais para os arquivos anexados.", { status: 400 });

  // PDFs vêm depois dos XML, na mesma ordem de `manuais`
  const primeiroPdf = arquivos.length - manuais.data.length;
  const lidos: ArquivoEnviado[] = [];
  for (const [i, f] of arquivos.entries()) {
    if (f.size > TAMANHO_MAXIMO_ARQUIVO) throw new ErroDeRegra(`${f.name} passa de 2 MB. Anexe o XML original da NF-e.`, { status: 413 });
    lidos.push({
      nome: f.name,
      conteudo: Buffer.from(await f.arrayBuffer()),
      acondicionamento: acond.data[i],
      manual: i >= primeiroPdf ? manuais.data[i - primeiroPdf] : undefined,
    });
  }
  return {
    data: String(form.get("data") ?? ""),
    horario: String(form.get("horario") ?? ""),
    // o número do agendamento é gerado pelo sistema: qualquer "numeroPedido" do corpo é ignorado
    tipoMercadoria: texto(form.get("tipoMercadoria"), 80),
    tipoOutros: texto(form.get("tipoOutros"), 80),
    observacao: texto(form.get("observacao"), 500),
    arquivos: lidos,
    enviar: form.get("enviar") === "1",
  };
}
