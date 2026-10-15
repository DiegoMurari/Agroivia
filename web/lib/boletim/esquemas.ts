import { z } from "zod";
import { decBR, paraTexto } from "@/lib/money";

/** Quantidade digitada (aceita vírgula): vira texto com ponto; recusa negativo e texto solto. */
const quantidade = z
  .string()
  .optional()
  .transform((texto, ctx) => {
    if (texto === undefined || texto.trim() === "") return "0";
    try {
      const v = decBR(texto);
      if (v.isNegative()) {
        ctx.addIssue({ code: "custom", message: "A quantidade não pode ser negativa. Digite 0 ou um valor maior." });
        return z.NEVER;
      }
      return paraTexto(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "Número inválido. Use só dígitos e vírgula para as casas, ex.: 2778 ou 12,5." });
      return z.NEVER;
    }
  });

export const esquemaBoletim = z.object({
  armazemId: z.number().int().positive("Escolha o armazém."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD."),
  linhas: z.array(
    z.object({
      tipoItemId: z.number().int().positive(),
      descarga: quantidade,
      remocao: quantidade,
      transferencia: quantidade,
    }),
  ),
  equipe: z.array(
    z.object({
      matricula: z.string().trim().min(1, "Informe a matrícula."),
      tipo: z.enum(["completa", "meia"]),
    }),
  ),
  responsavel: z.string().trim().nullish(),
  observacao: z.string().trim().nullish(),
});
