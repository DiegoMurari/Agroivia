"use client";

import { useEffect, useState } from "react";

import { dataBR } from "@/lib/agendamento/datas";
import type { CargaDaPlaca } from "@/lib/agendamento/historico";

import { chamar } from "./api";

const MOTIVO: Record<string, string> = {
  divergencia_nota_pedido: "divergência nota e pedido",
  sem_agendamento_sem_vaga: "sem agendamento e sem vaga",
  caso_fortuito: "caso fortuito",
  outro: "outro motivo",
};

/** Últimas cargas da placa digitada: data, fornecedor, atraso e não recebimento. Só leitura. */
export function HistoricoPlaca({ placa, excluirId }: { placa: string; excluirId?: number }) {
  const [cargas, setCargas] = useState<CargaDaPlaca[]>([]);
  const limpa = placa.replace(/[^A-Za-z0-9]/g, "");

  useEffect(() => {
    if (limpa.length < 5) return;
    let ativo = true;
    const t = setTimeout(async () => {
      const r = await chamar<CargaDaPlaca[]>(`/api/agendamento/placa?q=${encodeURIComponent(limpa)}${excluirId ? `&excluir=${excluirId}` : ""}`);
      if (ativo) setCargas(r.data ?? []);
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [limpa, excluirId]);

  if (limpa.length < 5) return null;
  if (cargas.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma carga anterior com esta placa.</p>;
  return (
    <div className="space-y-1 rounded-lg border p-3 text-sm" aria-live="polite">
      <div className="font-medium">Últimas cargas desta placa</div>
      <ul className="space-y-1 text-muted-foreground">
        {cargas.map((c) => (
          <li key={c.agendamentoId}>
            {dataBR(c.data)} {c.horario} · {c.fornecedor} ·{" "}
            {c.naoRecebimento
              ? `não recebido (${MOTIVO[c.naoRecebimento] ?? c.naoRecebimento})`
              : c.atrasoMin === null
                ? "não chegou"
                : c.atrasoMin > 0
                  ? `atraso de ${c.atrasoMin} min`
                  : "no horário"}
          </li>
        ))}
      </ul>
    </div>
  );
}
