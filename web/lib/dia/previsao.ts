/**
 * Previsão do tempo para a tela do dia (grupo 6). Chamada só no servidor, com timeout de 3 s e cache
 * na tabela `previsao_tempo` (gravada só por este módulo). Sem rede, a tela abre normal: devolve o cache
 * antigo marcado como tal ou nulo ("Previsão indisponível"). Open-Meteo não pede chave.
 */
import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

export const TIMEOUT_MS = 3000;
const VALIDADE_MIN = 180;
const PAUSA_APOS_FALHA_MIN = 10;
const FONTE = "open-meteo";
// Franca (SP)
const URL_API =
  "https://api.open-meteo.com/v1/forecast?latitude=-20.5386&longitude=-47.4008" +
  "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
  "&timezone=America%2FSao_Paulo&forecast_days=3";

export interface Previsao {
  data: string;
  resumo: string;
  chuvaProb: string | null;
  /** Instante em que o dado foi buscado. */
  atualizadoEm: string;
  /** Verdadeiro quando a busca falhou e o dado vem do cache antigo. */
  desatualizada: boolean;
}

export type Buscador = (url: string, timeoutMs: number) => Promise<unknown>;

export const buscarComFetch: Buscador = async (url, timeoutMs) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const CODIGOS: [number, string][] = [
  [0, "Céu limpo"], [2, "Parcialmente nublado"], [3, "Nublado"], [48, "Neblina"], [57, "Garoa"], [67, "Chuva"], [77, "Neve"], [82, "Pancadas de chuva"], [99, "Tempestade"],
];
function descricao(codigo: number): string {
  return (CODIGOS.find(([max]) => codigo <= max) ?? [0, "Tempo indefinido"])[1];
}

interface Dia { data: string; resumo: string; chuvaProb: string | null }

function interpretar(json: unknown): Dia[] {
  const d = (json as { daily?: Record<string, unknown[]> } | null)?.daily;
  const datas = d?.time;
  if (!d || !Array.isArray(datas)) throw new Error("Resposta inesperada");
  return datas.map((data, i) => {
    const cod = Number(d.weathercode?.[i]);
    const min = d.temperature_2m_min?.[i];
    const max = d.temperature_2m_max?.[i];
    const chuva = d.precipitation_probability_max?.[i];
    const temp = min != null && max != null ? `, ${Math.round(Number(min))}° a ${Math.round(Number(max))}°` : "";
    return { data: String(data), resumo: `${Number.isFinite(cod) ? descricao(cod) : "Tempo indefinido"}${temp}`, chuvaProb: chuva == null ? null : String(Math.round(Number(chuva))) };
  });
}

const minutos = (de: string, ate: string) => (new Date(ate).getTime() - new Date(de).getTime()) / 60000;
/** Última falha por banco, para não esperar 3 s a cada atualização de 20 s sem rede. */
const ultimaFalha = new Map<string, string>();

export async function previsaoDoDia(db: Db, hoje: string, agoraISO: string, buscar: Buscador = buscarComFetch): Promise<Previsao | null> {
  const linha = () => db.select().from(schema.previsaoTempo).where(eq(schema.previsaoTempo.data, hoje)).get();
  const paraPrevisao = (l: NonNullable<ReturnType<typeof linha>>, desatualizada: boolean): Previsao => ({
    data: l.data, resumo: l.resumo ?? "", chuvaProb: l.chuvaProb, atualizadoEm: l.atualizadoEm ?? "", desatualizada,
  });

  const cache = linha();
  if (cache?.atualizadoEm && minutos(cache.atualizadoEm, agoraISO) < VALIDADE_MIN) return paraPrevisao(cache, false);

  const chave = db.$client.name;
  const falha = ultimaFalha.get(chave);
  if (!falha || minutos(falha, agoraISO) >= PAUSA_APOS_FALHA_MIN) {
    try {
      const dias = interpretar(await buscar(URL_API, TIMEOUT_MS));
      db.transaction((tx) => {
        for (const x of dias) {
          tx.insert(schema.previsaoTempo)
            .values({ data: x.data, resumo: x.resumo, chuvaProb: x.chuvaProb, fonte: FONTE, atualizadoEm: agoraISO })
            .onConflictDoUpdate({ target: schema.previsaoTempo.data, set: { resumo: x.resumo, chuvaProb: x.chuvaProb, fonte: FONTE, atualizadoEm: agoraISO } })
            .run();
        }
      }, { behavior: "immediate" });
      ultimaFalha.delete(chave);
      const nova = linha();
      if (nova) return paraPrevisao(nova, false);
    } catch {
      ultimaFalha.set(chave, agoraISO);
    }
  }
  const velha = linha();
  return velha ? paraPrevisao(velha, true) : null;
}
