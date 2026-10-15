import { z } from "zod";
import { getDb } from "@/lib/db";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";
import { criarEquipe, copiarEscala, esquemaEquipe, lerEscala, resumoDoMes, sugestoesDeChapas, ultimaEscalaAntes } from "@/lib/equipes/servico";

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A escala do dia, as sugestões de nomes e o último dia que teve escala; com `mes`, o resumo do mês (equipes e chapas por dia). */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const mes = params.get("mes");
    if (mes !== null) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return erro(400, "Informe o mês no formato AAAA-MM.");
      return ok({ resumo: resumoDoMes(getDb(), mes) });
    }
    const data = params.get("data") ?? "";
    if (!DIA.safeParse(data).success) return erro(400, "Informe a data no formato AAAA-MM-DD.");
    const db = getDb();
    return ok({ equipes: lerEscala(db, data), sugestoes: sugestoesDeChapas(db), ultimaEscala: ultimaEscalaAntes(db, data) });
  } catch (e) {
    return responderErro(e);
  }
}

const esquemaCopia = z.object({ copiarDe: DIA, data: DIA });

/** Cria uma equipe; com `copiarDe`, copia a escala de outro dia. */
export async function POST(request: Request) {
  try {
    const corpo = await lerJson(request);
    if (corpo && typeof corpo === "object" && "copiarDe" in corpo) {
      const v = validar(esquemaCopia, corpo);
      if (!v.ok) return v.resposta;
      return ok({ copiadas: copiarEscala(getDb(), v.data.copiarDe, v.data.data, agoraISO()) }, 201);
    }
    const v = validar(esquemaEquipe, corpo);
    if (!v.ok) return v.resposta;
    return ok(criarEquipe(getDb(), v.data, agoraISO()), 201);
  } catch (e) {
    return responderErro(e);
  }
}
