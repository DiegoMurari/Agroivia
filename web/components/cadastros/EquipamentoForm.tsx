"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Wrench } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

interface Props {
  armazens: { id: number; nome: string }[];
  /** Nulo na tela de equipamento novo. */
  inicial: { id: number; armazemId: number; nome: string; finalidade: string; status: string; indisponivelMotivo: string } | null;
}

/** Tela própria de um equipamento: cada um é uma unidade única, com nome único no armazém e a situação dele. */
export function EquipamentoForm({ armazens, inicial }: Props) {
  const router = useRouter();
  const [armazemId, setArmazemId] = React.useState(String(inicial?.armazemId ?? armazens[0]?.id ?? ""));
  const [nome, setNome] = React.useState(inicial?.nome ?? "");
  const [finalidade, setFinalidade] = React.useState(inicial?.finalidade ?? "");
  const [parado, setParado] = React.useState(inicial?.status === "manutencao");
  const [motivo, setMotivo] = React.useState(inicial?.indisponivelMotivo ?? "");
  const [erro, setErro] = React.useState<{ mensagem: string; campos?: Record<string, string> } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const corpo = {
        armazemId: Number(armazemId),
        nome,
        finalidade,
        // Cada equipamento é uma unidade: quantidade 1, disponível só se não estiver em manutenção
        quantidade: 1,
        disponivel: parado ? 0 : 1,
        indisponivelMotivo: parado ? motivo : "",
        status: parado ? "manutencao" : "operacional",
      };
      const r = await fetch(inicial ? `/api/cadastros/equipamentos/${inicial.id}` : "/api/cadastros/equipamentos", {
        method: inicial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = (await r.json()) as { ok: boolean; erro?: { mensagem: string; campos?: Record<string, string> } };
      if (json.ok) {
        router.push("/cadastros");
        router.refresh();
        return;
      }
      setErro(json.erro ?? { mensagem: "Não foi possível salvar." });
    } catch {
      setErro({ mensagem: "Não foi possível falar com o servidor. Tente de novo." });
    }
    setOcupado(false);
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-6 rounded-xl border bg-card p-6 shadow-card">
      {erro && (
        <Alert variant="destructive" title="Não foi possível salvar">
          {erro.mensagem}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do equipamento" description="Único dentro do armazém. Ex.: Empilhadeira a gás 02." required error={erro?.campos?.nome}>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Armazém" required error={erro?.campos?.armazemId}>
          <Select value={armazemId} onChange={(e) => setArmazemId(e.target.value)}>
            {armazens.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Para que serve">
        <Input value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Situação</legend>
        <div role="radiogroup" aria-label="Situação" className="grid gap-3 sm:grid-cols-2">
          {[
            { valor: false, titulo: "Operacional", texto: "Disponível para as descargas.", icone: CircleCheck },
            { valor: true, titulo: "Em manutenção", texto: "Fica de fora da Tela do Dia até voltar.", icone: Wrench },
          ].map((o) => {
            const ativo = parado === o.valor;
            const Icone = o.icone;
            return (
              <button
                key={o.titulo}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setParado(o.valor)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  ativo ? (o.valor ? "border-warning bg-warning/10" : "border-success bg-success/10") : "border-border hover:bg-accent",
                )}
              >
                <Icone className={cn("mt-0.5 size-5 shrink-0", o.valor ? "text-warning" : "text-success")} aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{o.titulo}</span>
                  <span className="block text-sm text-muted-foreground">{o.texto}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {parado && (
        <Field label="Motivo da manutenção">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button asChild variant="outline">
          <Link href="/cadastros">Cancelar</Link>
        </Button>
        <Button type="submit" loading={ocupado}>
          {inicial ? "Salvar equipamento" : "Criar equipamento"}
        </Button>
      </div>
    </form>
  );
}
