import { z } from "zod";

import { criarCompra } from "@/lib/agendamento/compra";
import { getDb } from "@/lib/db";
import { lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { papelAtual } from "@/lib/papel";

const esquema = z
  .object({
    fornecedorId: z.number().int().positive().optional(),
    fornecedorNovo: z.object({ razaoSocial: z.string().trim().min(2, "Informe a razão social."), cnpj: z.string().optional() }).optional(),
    numeroPedido: z.string().max(40).optional(),
    descricao: z.string().max(300).optional(),
    itens: z
      .array(
        z.object({
          produtoId: z.number().int().positive().nullish(),
          descricao: z.string().trim().min(1, "Descreva o item."),
          quantidade: z.string().max(20).nullish(),
          unidade: z.string().max(10).nullish(),
          pesoKg: z.string().max(20).nullish(),
        }),
      )
      .max(50)
      .optional(),
  })
  .refine((v) => v.fornecedorId !== undefined || v.fornecedorNovo !== undefined, { message: "Escolha o fornecedor.", path: ["fornecedorId"] });

export async function POST(request: Request) {
  try {
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    const r = criarCompra(getDb(), { ...v.data, criadaPor: await papelAtual() }, agoraISO());
    return ok(r, 201);
  } catch (e) {
    return responderErro(e);
  }
}
