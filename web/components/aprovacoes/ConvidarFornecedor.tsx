"use client";

import { Check, Copy, UserPlus } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { enviar } from "./api";

/** Gera o convite e mostra o link para copiar (não há envio de e-mail). */
export function ConvidarFornecedor() {
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro(null);
    setCopiado(false);
    const r = await enviar<{ caminho: string }>("/api/aprovacoes/convite", "POST");
    setGerando(false);
    if (r.ok && r.data) setLink(`${window.location.origin}${r.data.caminho}`);
    else setErro(r.mensagem ?? "Não foi possível gerar o convite.");
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      setCopiado(false);
      setErro("Não foi possível copiar sozinho. Selecione o link e use Ctrl+C.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" onClick={gerar} loading={gerando}>
          <UserPlus /> Convidar fornecedor
        </Button>
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {erro && <Alert variant="destructive">{erro}</Alert>}
        {link && (
          <Alert variant="info" title="Link do convite (uso único)">
            <div className="flex flex-col gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm break-all select-all">{link}</code>
              <div>
                <Button type="button" size="sm" variant="outline" onClick={copiar}>
                  {copiado ? <Check /> : <Copy />} {copiado ? "Link copiado" : "Copiar link"}
                </Button>
              </div>
              <p className="text-sm">Envie este link ao fornecedor por e-mail ou mensagem. Cada link vale para um cadastro.</p>
            </div>
          </Alert>
        )}
      </div>
    </div>
  );
}
