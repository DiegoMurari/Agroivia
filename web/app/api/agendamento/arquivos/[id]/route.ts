import { lerArquivoParaDownload } from "@/lib/agendamento/agendar";
import { getDb } from "@/lib/db";
import { erro } from "@/lib/http";

/** Só leitura (D38): devolve o arquivo original como anexo, com tipo fixo. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return erro(400, "Arquivo inválido.");
  const a = lerArquivoParaDownload(getDb(), id);
  if (!a) return erro(404, "Arquivo não encontrado.");
  const nome = a.nome.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(a.conteudo), {
    headers: {
      "Content-Type": a.tipoMime,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
