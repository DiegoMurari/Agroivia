/**
 * Apoio das rotas GET de /api/painel: filtro validado com zod e serialização de Decimal em texto.
 * Valor nunca vira number no caminho: sai como string, com o ponto decimal (o formato de lib/money).
 */
import { z } from "zod";

import { paraTexto } from "@/lib/money";
import { filtroDaUrl, type Filtro } from "./consultas";

const consulta = z.object({
  periodo: z.string().max(20).optional(),
  semana: z.string().max(10).optional(),
});

/** Query string → filtro. Valor inválido cai no padrão (safra), como na página; nunca vira erro. */
export function filtroDaRequisicao(url: string): Filtro {
  const p = new URL(url).searchParams;
  const q = consulta.safeParse({ periodo: p.get("periodo") ?? undefined, semana: p.get("semana") ?? undefined });
  return q.success ? filtroDaUrl(q.data.periodo, q.data.semana) : filtroDaUrl();
}

function ehValor(v: unknown): v is Parameters<typeof paraTexto>[0] & object {
  return typeof v === "object" && v !== null && typeof (v as { toFixed?: unknown }).toFixed === "function" && typeof (v as { times?: unknown }).times === "function";
}

/** Percorre o objeto e troca cada Decimal pelo texto. Map vira lista de pares; o resto segue igual. */
export function serializar<T>(v: T): unknown {
  if (ehValor(v)) return paraTexto(v);
  if (Array.isArray(v)) return v.map(serializar);
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [k, serializar(x)]);
  if (typeof v === "object" && v !== null) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serializar(x)]));
  return v;
}
