import type { z } from "zod";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { editarArmazem, editarChapa, editarEquipamento, esquemaArmazem, esquemaChapa, esquemaEquipamento } from "@/lib/cadastros/servico";

export async function PUT(request: Request, ctx: { params: Promise<{ tipo: string; id: string }> }) {
  try {
    const { tipo, id: idTexto } = await ctx.params;
    if (!/^\d+$/.test(idTexto)) return erro(400, "Número de cadastro inválido.");
    const id = Number(idTexto);
    const db = getDb();
    const corpo = await lerJson(request);
    const com = <T,>(esquema: z.ZodType<T>, grava: (d: T) => unknown) => {
      const v = validar(esquema, corpo);
      return v.ok ? ok(grava(v.data)) : v.resposta;
    };
    if (tipo === "armazens") return com(esquemaArmazem, (d) => editarArmazem(db, id, d));
    if (tipo === "equipamentos") return com(esquemaEquipamento, (d) => editarEquipamento(db, id, d));
    if (tipo === "chapas") return com(esquemaChapa, (d) => editarChapa(db, id, d));
    return erro(404, "Cadastro desconhecido. Use armazens, equipamentos ou funcionários.");
  } catch (e) {
    return responderErro(e);
  }
}
