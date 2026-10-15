"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

import { postJson } from "./api";

/** Aviso de atraso: pelo link do fornecedor (token) ou pela portaria (agendamentoId). Não remarca. */
export function AvisarAtraso({ token, agendamentoId }: { token?: string; agendamentoId?: number }) {
  const router = useRouter();
  const [previsao, setPrevisao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    setErro(null);
    setFeito(false);
    setOcupado(true);
    const r = token
      ? await postJson(`/api/agendamento/atraso/${token}`, { previsao, motivo })
      : await postJson(`/api/agendamento/descarga/${agendamentoId}`, { acao: "atraso_manual", previsao, motivo });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem ?? "Não foi possível registrar o aviso.");
      return;
    }
    setFeito(true);
    setPrevisao("");
    setMotivo("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">Avisar atraso</h3>
      <p className="text-sm text-muted-foreground">Registra o aviso e a previsão de chegada. O horário agendado não muda.</p>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field label="Previsão de chegada" description="HH:MM">
          <Input value={previsao} onChange={(e) => setPrevisao(e.target.value)} placeholder="09:30" inputMode="numeric" />
        </Field>
        <Field label="Motivo">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        <Button variant="outline" disabled={ocupado || !previsao || !motivo.trim()} onClick={enviar}>
          Avisar atraso
        </Button>
      </div>
      {erro && <Alert variant="destructive" title="Não foi possível avisar">{erro}</Alert>}
      {feito && <Alert variant="success" title="Atraso registrado">A Agrovia vê o aviso na tela da descarga.</Alert>}
    </div>
  );
}
