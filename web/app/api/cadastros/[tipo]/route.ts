import type { z } from "zod";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { criarArmazem, criarChapa, criarEquipamento, esquemaArmazem, esquemaChapa, esquemaEquipamento, listarArmazens, listarChapas, listarEquipamentos } from "@/lib/cadastros/servico";

type Ctx = { params: Promise<{ tipo: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { tipo } = await ctx.params;
    const db = getDb();
    if (tipo === "armazens") return ok(listarArmazens(db));
    if (tipo === "equipamentos") return ok(listarEquipamentos(db));
    if (tipo === "chapas") return ok(listarChapas(db));
    return erro(404, "Cadastro desconhecido. Use armazens, equipamentos ou funcionários.");
  } catch (e) {
    return responderErro(e);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { tipo } = await ctx.params;
    const db = getDb();
    const corpo = await lerJson(request);
    const com = <T,>(esquema: z.ZodType<T>, grava: (d: T) => unknown) => {
      const v = validar(esquema, corpo);
      return v.ok ? ok(grava(v.data), 201) : v.resposta;
    };
    if (tipo === "armazens") return com(esquemaArmazem, (d) => criarArmazem(db, d));
    if (tipo === "equipamentos") return com(esquemaEquipamento, (d) => criarEquipamento(db, d));
    if (tipo === "chapas") return com(esquemaChapa, (d) => criarChapa(db, d));
    return erro(404, "Cadastro desconhecido. Use armazens, equipamentos ou funcionários.");
  } catch (e) {
    return responderErro(e);
  }
}
