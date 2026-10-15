"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { dataBR } from "@/lib/agendamento/datas";

import { postJson } from "./api";

interface Pendencia {
  id: number;
  agendamentoId: number;
  descricao: string | null;
  status: string;
  abertaPor: string | null;
  abertaEm: string;
  resolvidaPor: string | null;
  resolvidaEm: string | null;
  resolucao: string | null;
  fornecedor: string;
  data: string;
  horario: string;
}

export function Pendencias({ pendencias }: { pendencias: Pendencia[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState<Record<number, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function resolver(id: number) {
    setErro(null);
    setOcupado(true);
    const r = await postJson(`/api/agendamento/pendencias/${id}`, { resolucao: texto[id] ?? "" });
    setOcupado(false);
    if (!r.ok) setErro(r.mensagem ?? "Não foi possível resolver.");
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      {erro && <Alert variant="destructive" title="Não foi possível resolver">{erro}</Alert>}
      {pendencias.map((p) => (
        <div key={p.id} className="space-y-2 rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={p.status === "aberta" ? "warning" : "success"}>{p.status === "aberta" ? "Aberta" : "Resolvida"}</Badge>
            <span className="font-medium">{p.fornecedor}</span>
            <Link className="text-brand underline" href={`/agendamento/descarga/${p.agendamentoId}`}>
              descarga {dataBR(p.data)} {p.horario}
            </Link>
          </div>
          <p>{p.descricao}</p>
          <p className="text-muted-foreground">Aberta por {p.abertaPor ?? "-"} em {p.abertaEm.slice(0, 16).replace("T", " ")}</p>
          {p.status === "resolvida" ? (
            <p className="text-muted-foreground">Resolvida por {p.resolvidaPor} em {p.resolvidaEm?.slice(0, 16).replace("T", " ")}: {p.resolucao}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Como foi resolvida" description="Em divergência pequena, informe a nota de devolução parcial emitida.">
                <Input value={texto[p.id] ?? ""} onChange={(e) => setTexto({ ...texto, [p.id]: e.target.value })} />
              </Field>
              <Button variant="outline" disabled={ocupado || !(texto[p.id] ?? "").trim()} onClick={() => resolver(p.id)}>Resolver</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
