"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { dataBR } from "@/lib/agendamento/datas";

import { postJson } from "./api";

interface Vaga {
  id: number;
  data: string | null;
  horario: string | null;
  livre: boolean;
  candidatos: { agendamentoId: number; fornecedor: string; data: string; horario: string; acondicionamento: string }[];
}

export function Vagas({ vagas }: { vagas: Vaga[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function ocupar(vagaId: number, agendamentoId: number) {
    setErro(null);
    setOcupado(true);
    const r = await postJson(`/api/agendamento/vagas/${vagaId}`, { agendamentoId });
    setOcupado(false);
    if (!r.ok) setErro(r.mensagem ?? "Não foi possível ocupar a vaga.");
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      {erro && <Alert variant="destructive" title="Não foi possível ocupar a vaga">{erro}</Alert>}
      {vagas.map((v) => (
        <div key={v.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2 font-medium">
            Vaga de {dataBR(v.data!)} às {v.horario}
            <Badge variant={v.livre ? "success" : "warning"}>{v.livre ? "Livre" : "Já ocupada por outro horário cheio"}</Badge>
          </div>
          {v.candidatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento cabe nesta vaga agora.</p>
          ) : (
            <ul className="divide-y text-sm">
              {v.candidatos.map((c) => (
                <li key={c.agendamentoId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {c.fornecedor} <span className="text-muted-foreground">hoje em {dataBR(c.data)} {c.horario}, {c.acondicionamento}</span>
                  </span>
                  <Button size="sm" variant="outline" disabled={ocupado} onClick={() => ocupar(v.id, c.agendamentoId)}>
                    Ocupar a vaga com este
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
