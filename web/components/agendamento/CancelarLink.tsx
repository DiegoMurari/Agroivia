"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

import { postJson } from "./api";

export function CancelarLink({ token }: { token: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function cancelar() {
    setErro(null);
    setOcupado(true);
    const r = await postJson(`/api/agendamento/cancelar/${token}`, { motivo });
    setOcupado(false);
    if (!r.ok) setErro(r.mensagem ?? "Não foi possível cancelar.");
    else router.refresh();
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Field label="Cancelar este agendamento" description="Informe o motivo. A vaga volta para a agenda e este link não reabre.">
        <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
      {erro && <Alert variant="destructive" title="Não foi possível cancelar">{erro}</Alert>}
      <Button variant="destructive" disabled={ocupado || motivo.trim() === ""} onClick={cancelar}>Cancelar agendamento</Button>
    </div>
  );
}
