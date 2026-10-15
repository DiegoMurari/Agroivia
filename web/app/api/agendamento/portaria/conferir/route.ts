import { conferirTamanhoDoCorpo, TAMANHO_MAXIMO_ARQUIVO } from "@/lib/agendamento/agendar";
import { conferirNota } from "@/lib/agendamento/conferencia";
import { ErroNfe, lerNfeXml, type NfeLida } from "@/lib/agendamento/nf-xml";
import { xmlPorChave } from "@/lib/agendamento/xml-por-chave";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ErroDeRegra, ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

/** Confere a nota com os agendamentos aprovados. Não grava nada. Envie o XML (`arquivo`) ou a chave de 44 números (`chave`). */
export async function POST(request: Request) {
  try {
    await exigirAcesso("portaria");
    conferirTamanhoDoCorpo(request.headers.get("content-length"));
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    const chave = typeof form.get("chave") === "string" ? String(form.get("chave")) : null;
    const placa = typeof form.get("placa") === "string" ? String(form.get("placa")).trim().slice(0, 10) || null : null;
    const escolhido = Number(form.get("agendamentoId"));

    let nf: NfeLida | null = null;
    if (arquivo && typeof arquivo !== "string") {
      if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) throw new ErroDeRegra(`${arquivo.name} passa de 2 MB. Anexe o XML original da nota.`, { status: 413 });
      try {
        nf = lerNfeXml(Buffer.from(await arquivo.arrayBuffer()).toString("utf8"));
      } catch (e) {
        if (e instanceof ErroNfe) throw new ErroDeRegra(`${arquivo.name}: ${e.message}`, { status: 422 });
        throw e;
      }
    } else if (!chave || chave.replace(/\D/g, "").length === 0) {
      throw new ErroDeRegra("Anexe o XML da nota fiscal ou digite a chave de 44 números.", { status: 400 });
    } else {
      // só a chave (câmera ou digitada): busca a nota completa pela chave, para preencher tudo sozinho
      const xml = xmlPorChave(chave);
      if (xml) {
        try {
          nf = lerNfeXml(xml.toString("utf8"));
        } catch {
          nf = null; // XML ilegível: segue só com a chave
        }
      }
    }
    return ok({
      ...conferirNota(getDb(), { nf, chave, placa, agendamentoId: Number.isInteger(escolhido) && escolhido > 0 ? escolhido : null }, agoraISO()),
      nota: nf && {
        numero: nf.numero,
        emitenteNome: nf.emitenteNome,
        emitenteCnpj: nf.emitenteCnpj,
        placa: nf.placa,
        serie: nf.serie,
        emitidaEm: nf.emitidaEm,
        valorTotal: nf.valorTotal,
        pesoBrutoKg: nf.pesoBrutoKg,
        pesoLiquidoKg: nf.pesoLiquidoKg,
        volumes: nf.volumes,
        especie: nf.especie,
        transportadora: nf.transportadora,
        pedidoFornecedor: nf.pedidoFornecedor,
        acondicionamentoSugerido: nf.acondicionamentoSugerido,
        itens: nf.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade, valorUnitario: i.valorUnitario })),
      },
    });
  } catch (e) {
    return responderErro(e);
  }
}
