/**
 * Previsão do tempo por dia, compartilhada (D52): o calendário do fornecedor mostra o tempo de cada dia.
 * Usa o mesmo cache da tela do dia (tabela `previsao_tempo`, mesmo formato de `resumo`), com 16 dias.
 * Chamada só no servidor, com timeout de 3 s. Sem rede devolve o que houver no cache; dia sem dado não aparece.
 * Open-Meteo não pede chave e não recebe dado nenhum do usuário.
 */
import { and, gte, lte } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

export const TIMEOUT_MS = 3000;
const VALIDADE_MIN = 180;
const PAUSA_APOS_FALHA_MIN = 10;
const FONTE = "open-meteo";
/** A Open-Meteo prevê no máximo 16 dias. */
export const DIAS_DE_PREVISAO = 16;
// Franca (SP)
const URL_API =
  "https://api.open-meteo.com/v1/forecast?latitude=-20.5386&longitude=-47.4008" +
  "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
  `&timezone=America%2FSao_Paulo&forecast_days=${DIAS_DE_PREVISAO}`;

export type TipoDeTempo = "sol" | "parcial" | "nublado" | "neblina" | "chuva" | "tempestade" | "indefinido";

export interface TempoDoDia {
  /** AAAA-MM-DD */
  data: string;
  tipo: TipoDeTempo;
  /** "Céu limpo", "Chuva"... */
  descricao: string;
  minC: number | null;
  maxC: number | null;
  /** Probabilidade de chuva, 0 a 100. */
  chuvaPct: number | null;
  /** Chuva provável (60% ou mais): atenção para carga solta e descarga em área aberta. */
  alertaChuva: boolean;
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
const TIPOS: Record<string, TipoDeTempo> = {
  "Céu limpo": "sol", "Parcialmente nublado": "parcial", Nublado: "nublado", Neblina: "neblina",
  Garoa: "chuva", Chuva: "chuva", Neve: "chuva", "Pancadas de chuva": "chuva", Tempestade: "tempestade",
};
export const LIMITE_ALERTA_CHUVA = 60;

/** Lê o texto gravado no cache ("Chuva, 16° a 25°") de volta para os campos da tela. */
export function interpretarResumo(data: string, resumo: string | null, chuvaProb: string | null): TempoDoDia {
  const [descricao = "", resto = ""] = (resumo ?? "").split(",", 2);
  const temp = /(-?\d+)° a (-?\d+)°/.exec(resto);
  const chuva = chuvaProb == null || chuvaProb === "" ? null : Number(chuvaProb);
  const chuvaPct = chuva != null && Number.isFinite(chuva) ? chuva : null;
  return {
    data,
    tipo: TIPOS[descricao.trim()] ?? "indefinido",
    descricao: descricao.trim() || "Tempo indefinido",
    minC: temp ? Number(temp[1]) : null,
    maxC: temp ? Number(temp[2]) : null,
    chuvaPct,
    alertaChuva: chuvaPct != null && chuvaPct >= LIMITE_ALERTA_CHUVA,
  };
}

function paraLinhas(json: unknown): { data: string; resumo: string; chuvaProb: string | null }[] {
  const d = (json as { daily?: Record<string, unknown[]> } | null)?.daily;
  const datas = d?.time;
  if (!d || !Array.isArray(datas)) throw new Error("Resposta inesperada");
  return datas.map((data, i) => {
    const cod = Number(d.weathercode?.[i]);
    const min = d.temperature_2m_min?.[i];
    const max = d.temperature_2m_max?.[i];
    const chuva = d.precipitation_probability_max?.[i];
    const descricao = Number.isFinite(cod) ? (CODIGOS.find(([limite]) => cod <= limite)?.[1] ?? "Tempo indefinido") : "Tempo indefinido";
    const temp = min != null && max != null ? `, ${Math.round(Number(min))}° a ${Math.round(Number(max))}°` : "";
    return { data: String(data), resumo: `${descricao}${temp}`, chuvaProb: chuva == null ? null : String(Math.round(Number(chuva))) };
  });
}

const minutos = (de: string, ate: string) => (new Date(ate).getTime() - new Date(de).getTime()) / 60000;
/** Última busca por banco (com ou sem sucesso), para não esperar 3 s a cada abertura do calendário. */
const ultimaBusca = new Map<string, { em: string; falhou: boolean }>();

/**
 * Tempo de cada dia entre `de` e `ate` (AAAA-MM-DD, inclusive), por data. Dia sem previsão fica fora do mapa.
 * Busca na rede no máximo uma vez a cada 3 h por banco (10 min depois de uma falha).
 */
export async function tempoDosDias(
  db: Db,
  de: string,
  ate: string,
  agoraISO: string,
  buscar: Buscador = buscarComFetch,
): Promise<Record<string, TempoDoDia>> {
  const chave = db.$client.name;
  const ultima = ultimaBusca.get(chave);
  const espera = ultima?.falhou ? PAUSA_APOS_FALHA_MIN : VALIDADE_MIN;
  if (!ultima || minutos(ultima.em, agoraISO) >= espera) {
    try {
      const linhas = paraLinhas(await buscar(URL_API, TIMEOUT_MS));
      db.transaction((tx) => {
        for (const x of linhas) {
          tx.insert(schema.previsaoTempo)
            .values({ data: x.data, resumo: x.resumo, chuvaProb: x.chuvaProb, fonte: FONTE, atualizadoEm: agoraISO })
            .onConflictDoUpdate({ target: schema.previsaoTempo.data, set: { resumo: x.resumo, chuvaProb: x.chuvaProb, fonte: FONTE, atualizadoEm: agoraISO } })
            .run();
        }
      }, { behavior: "immediate" });
      ultimaBusca.set(chave, { em: agoraISO, falhou: false });
    } catch {
      ultimaBusca.set(chave, { em: agoraISO, falhou: true });
    }
  }

  const linhas = db
    .select()
    .from(schema.previsaoTempo)
    .where(and(gte(schema.previsaoTempo.data, de), lte(schema.previsaoTempo.data, ate)))
    .all();
  const porDia: Record<string, TempoDoDia> = {};
  for (const l of linhas) porDia[l.data] = interpretarResumo(l.data, l.resumo, l.chuvaProb);
  return porDia;
}
