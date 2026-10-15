import { conferirTamanhoDoCorpo, lerNfs, TAMANHO_MAXIMO_ARQUIVO } from "@/lib/agendamento/agendar";
import { getDb } from "@/lib/db";
import { ErroDeRegra, ok, responderErro } from "@/lib/http";

/** Lê os XML e devolve o que foi lido de cada NF. Não grava nada. */
export async function POST(request: Request) {
  try {
    conferirTamanhoDoCorpo(request.headers.get("content-length"));
    const form = await request.formData();
    const arquivos = form.getAll("arquivos").filter((f): f is File => typeof f !== "string");
    if (arquivos.length === 0) throw new ErroDeRegra("Anexe o XML de pelo menos uma nota fiscal.", { status: 400 });
    if (arquivos.length > 10) throw new ErroDeRegra("No máximo 10 notas por agendamento.", { status: 400 });
    const lidos = [];
    for (const f of arquivos) {
      if (f.size > TAMANHO_MAXIMO_ARQUIVO) throw new ErroDeRegra(`${f.name} passa de 2 MB. Anexe o XML original da NF-e.`, { status: 413 });
      lidos.push({ nome: f.name, conteudo: Buffer.from(await f.arrayBuffer()) });
    }
    return ok(lerNfs(getDb(), lidos));
  } catch (e) {
    return responderErro(e);
  }
}
