/** Chamada JSON ao servidor no formato de `@/lib/http`. Só código de cliente. */
export interface RespostaApi<T> {
  ok: boolean;
  status: number;
  data?: T;
  mensagem?: string;
  campos?: Record<string, string>;
  detalhe?: unknown;
}

export async function chamar<T>(url: string, opcoes: RequestInit = {}): Promise<RespostaApi<T>> {
  try {
    const r = await fetch(url, opcoes);
    const corpo = await r.json();
    if (corpo.ok) return { ok: true, status: r.status, data: corpo.data as T };
    return { ok: false, status: r.status, mensagem: corpo.erro?.mensagem, campos: corpo.erro?.campos, detalhe: corpo.erro?.detalhe };
  } catch {
    return { ok: false, status: 0, mensagem: "Sem resposta do servidor. Confira se ele está no ar e tente de novo." };
  }
}

export function postJson<T>(url: string, corpo: unknown) {
  return chamar<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
}
