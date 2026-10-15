/** Chamada JSON no formato de `@/lib/http`. Só código de cliente. */
export interface RespostaApi<T> {
  ok: boolean;
  status: number;
  data?: T;
  mensagem?: string;
  campos?: Record<string, string>;
}

export async function enviar<T>(url: string, metodo: "POST" | "PUT", corpo?: unknown): Promise<RespostaApi<T>> {
  try {
    const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const j = await r.json();
    if (j.ok) return { ok: true, status: r.status, data: j.data as T };
    return { ok: false, status: r.status, mensagem: j.erro?.mensagem, campos: j.erro?.campos };
  } catch {
    return { ok: false, status: 0, mensagem: "Sem resposta do servidor. Tente de novo em instantes." };
  }
}
