"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

/** Botão que copia um texto pronto (aviso ao prestador). Sem permissão de área de transferência, seleciona o texto para copiar à mão. */
export function CopiarTexto({ texto, idDoTexto, rotulo = "Copiar aviso" }: { texto: string; idDoTexto: string; rotulo?: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "falhou">("parado");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      const alvo = document.getElementById(idDoTexto);
      if (alvo) {
        const faixa = document.createRange();
        faixa.selectNodeContents(alvo);
        const selecao = window.getSelection();
        selecao?.removeAllRanges();
        selecao?.addRange(faixa);
      }
      setEstado("falhou");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado("parado"), 3000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" variant="outline" onClick={copiar}>
        {estado === "copiado" ? <Check /> : <Copy />}
        {rotulo}
      </Button>
      <span role="status" className="text-sm text-muted-foreground">
        {estado === "copiado" && "Texto copiado."}
        {estado === "falhou" && "Não foi possível copiar sozinho: o texto foi selecionado, use Ctrl+C."}
      </span>
    </div>
  );
}
