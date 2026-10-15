import { z } from "zod";

import { conferirTamanhoDoCorpo, TAMANHO_MAXIMO_ARQUIVO, type NfLida } from "@/lib/agendamento/agendar";
import { ErroNfe, lerNfeXml } from "@/lib/agendamento/nf-xml";
import { caminhaoSemAgendamento } from "@/lib/agendamento/portaria";
import { xmlPorChave } from "@/lib/agendamento/xml-por-chave";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ACONDICIONAMENTO_OCUPACAO } from "@/lib/db/enums";
import { ErroDeRegra, lerJson, ok, responderErro, validar } from "@/lib/http";
import { papelAtual } from "@/lib/papel";
import { agoraISO } from "@/lib/relogio";

const esquema = z.object({
  fornecedorId: z.number().int().positive("Escolha o fornecedor."),
  placa: z.string().trim().max(10).nullish(),
  acondicionamento: z.enum(ACONDICIONAMENTO_OCUPACAO),
  pesoKg: z.string().trim().max(20).nullish(),
});

/**
 * Caminhão sem agendamento: agenda na hora se houver vaga hoje; senão registra o não recebimento.
 * Aceita JSON ou formulário com o XML da nota (`arquivo`): com o XML, o pedido já nasce com a NF, o peso e a observação.
 */
export async function POST(request: Request) {
  try {
    await exigirAcesso("portaria");
    const tipo = request.headers.get("content-type") ?? "";
    let entrada: unknown;
    let nota: NfLida | undefined;
    if (tipo.includes("multipart/form-data")) {
      conferirTamanhoDoCorpo(request.headers.get("content-length"));
      const form = await request.formData();
      entrada = {
        fornecedorId: Number(form.get("fornecedorId")),
        placa: typeof form.get("placa") === "string" ? String(form.get("placa")) : null,
        acondicionamento: String(form.get("acondicionamento") ?? ""),
        pesoKg: typeof form.get("pesoKg") === "string" ? String(form.get("pesoKg")) : null,
      };
      const arquivo = form.get("arquivo");
      const chave = typeof form.get("chave") === "string" ? String(form.get("chave")) : null;
      const xmlDaChave = !arquivo && chave ? xmlPorChave(chave) : null;
      if (xmlDaChave) {
        try {
          const nf = lerNfeXml(xmlDaChave.toString("utf8"));
          nota = { arquivo: { nome: `${nf.chaveAcesso}.xml`, conteudo: xmlDaChave, acondicionamento: nf.acondicionamentoSugerido ?? "batido" }, nf };
        } catch {
          // XML ilegível: registra sem a nota
        }
      } else if (arquivo && typeof arquivo !== "string") {
        if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) throw new ErroDeRegra(`${arquivo.name} passa de 2 MB. Anexe o XML original da nota.`, { status: 413 });
        try {
          const conteudo = Buffer.from(await arquivo.arrayBuffer());
          const nf = lerNfeXml(conteudo.toString("utf8"));
          nota = { arquivo: { nome: arquivo.name, conteudo, acondicionamento: nf.acondicionamentoSugerido ?? "batido" }, nf };
        } catch (e) {
          if (e instanceof ErroNfe) throw new ErroDeRegra(`${arquivo.name}: ${e.message}`, { status: 422 });
          throw e;
        }
      }
    } else entrada = await lerJson(request);
    const v = validar(esquema, entrada);
    if (!v.ok) return v.resposta;
    return ok(caminhaoSemAgendamento(getDb(), { ...v.data, nota }, await papelAtual(), agoraISO()));
  } catch (e) {
    return responderErro(e);
  }
}
