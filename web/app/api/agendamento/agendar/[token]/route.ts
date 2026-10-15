import { z } from "zod";

import { agendarPorToken, conferirLinkAtivo, conferirTamanhoDoCorpo, TAMANHO_MAXIMO_ARQUIVO } from "@/lib/agendamento/agendar";
import { getDb } from "@/lib/db";
import { ACONDICIONAMENTO_NF } from "@/lib/db/enums";
import { ErroDeRegra, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data da lista."),
  horario: z.string().regex(/^\d{2}:\d{2}$/, "Escolha um horário da lista."),
  acondicionamentos: z.array(z.enum(ACONDICIONAMENTO_NF)).min(1, "Informe o acondicionamento de cada nota."),
});

const esquemaManuais = z.array(
  z.object({
    chaveAcesso: z.string().max(60),
    numero: z.string().max(20).nullish(),
    emitenteCnpj: z.string().max(20).nullish(),
    valorTotal: z.string().max(20).nullish(),
    pesoLiquidoKg: z.string().max(20).nullish(),
  }),
);

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    conferirTamanhoDoCorpo(request.headers.get("content-length"));
    conferirLinkAtivo(getDb(), token);
    const form = await request.formData();
    const arquivos = form.getAll("arquivos").filter((f): f is File => typeof f !== "string");
    let acond: unknown;
    try {
      acond = JSON.parse(String(form.get("acondicionamentos") ?? "[]"));
    } catch {
      acond = undefined;
    }
    let manuaisBrutos: unknown;
    try {
      manuaisBrutos = JSON.parse(String(form.get("manuais") ?? "[]"));
    } catch {
      manuaisBrutos = undefined;
    }
    const mv = validar(esquemaManuais, manuaisBrutos);
    if (!mv.ok) return mv.resposta;
    const manuais = mv.data;
    if (manuais.length > arquivos.length) throw new ErroDeRegra("Dados de PDF demais para os arquivos anexados.", { status: 400 });
    const v = validar(esquema, { data: form.get("data"), horario: form.get("horario"), acondicionamentos: acond });
    if (!v.ok) return v.resposta;
    if (arquivos.length !== v.data.acondicionamentos.length) {
      throw new ErroDeRegra("Informe o acondicionamento de cada nota anexada.", { status: 400 });
    }
    if (arquivos.length > 10) throw new ErroDeRegra("No máximo 10 notas por agendamento.", { status: 400 });
    const itens: { nome: string; conteudo: Buffer; acondicionamento: (typeof v.data.acondicionamentos)[number]; manual?: (typeof manuais)[number] }[] = [];
    // PDFs vêm depois dos XML, na mesma ordem de `manuais`
    const primeiroPdf = arquivos.length - manuais.length;
    for (const [i, f] of arquivos.entries()) {
      if (f.size > TAMANHO_MAXIMO_ARQUIVO) throw new ErroDeRegra(`${f.name} passa de 2 MB.`, { status: 413 });
      const m = i >= primeiroPdf ? manuais[i - primeiroPdf] : undefined;
      itens.push({
        nome: f.name,
        conteudo: Buffer.from(await f.arrayBuffer()),
        acondicionamento: v.data.acondicionamentos[i],
        manual: m,
      });
    }
    const r = agendarPorToken(
      getDb(),
      { token, arquivos: itens, data: v.data.data, horario: v.data.horario, autor: "fornecedor" },
      agoraISO(),
    );
    return ok(r, 201);
  } catch (e) {
    return responderErro(e);
  }
}
