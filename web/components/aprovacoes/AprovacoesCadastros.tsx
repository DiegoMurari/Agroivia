"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import type { CadastroPendente } from "@/lib/aprovacoes/cadastro";
import { enviar } from "./api";

const ROTULOS: Record<string, string> = {
  razaoSocial: "Razão social",
  nomeFantasia: "Nome fantasia",
  cnpj: "CNPJ",
  inscricaoEstadual: "Inscrição estadual",
  email: "E-mail",
  telefone: "Telefone",
  responsavel: "Responsável",
  endereco: "Endereço",
  tiposMercadoria: "Tipos de mercadoria",
};

const texto = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === undefined || v === null || v === "" ? "não informado" : String(v));

function Item({ c, alteracao }: { c: CadastroPendente; alteracao: boolean }) {
  const router = useRouter();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [campoErro, setCampoErro] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function decidir(decisao: "aprovado" | "recusado") {
    setOcupado(true);
    setErro(null);
    setCampoErro(undefined);
    const r = await enviar(`/api/aprovacoes/cadastro/${c.id}`, "POST", { decisao, comentario: motivo });
    setOcupado(false);
    if (r.ok) router.refresh();
    else {
      setCampoErro(r.campos?.comentario);
      setErro(r.mensagem ?? "Não foi possível registrar a decisão.");
    }
  }

  const campos = alteracao && c.alteracao ? Object.keys(c.alteracao) : Object.keys(ROTULOS);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h3 text-brand">{c.razaoSocial}</h3>
          <Badge variant="warning">{alteracao ? "Alteração de dados" : "Cadastro novo"}</Badge>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          {campos.map((k) => {
            const antes = (c.atual as unknown as Record<string, unknown>)[k];
            const depois = alteracao && c.alteracao ? (c.alteracao as Record<string, unknown>)[k] : undefined;
            return (
              <div key={k}>
                <dt className="text-sm text-muted-foreground">{ROTULOS[k] ?? k}</dt>
                <dd>
                  {alteracao ? (
                    <>
                      <span className="sr-only">Antes: </span>
                      <span className="text-muted-foreground line-through">{texto(antes)}</span> <span className="sr-only">Depois: </span>
                      <strong>{texto(depois)}</strong>
                    </>
                  ) : (
                    texto(antes)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
        {recusando && (
          <Field label="Motivo da recusa" required error={campoErro}>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
          </Field>
        )}
        <div aria-live="polite">{erro && !campoErro && <Alert variant="destructive">{erro}</Alert>}</div>
        <div className="flex flex-wrap gap-2">
          {recusando ? (
            <>
              <Button type="button" variant="destructive" loading={ocupado} onClick={() => decidir("recusado")}>
                <X /> Confirmar recusa
              </Button>
              <Button type="button" variant="outline" onClick={() => setRecusando(false)}>
                Voltar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" loading={ocupado} onClick={() => decidir("aprovado")}>
                <Check /> Aprovar
              </Button>
              <Button type="button" variant="outline" onClick={() => setRecusando(true)}>
                <X /> Recusar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AprovacoesCadastros({ novos, alteracoes }: { novos: CadastroPendente[]; alteracoes: CadastroPendente[] }) {
  if (novos.length === 0 && alteracoes.length === 0) {
    return <EmptyState title="Nenhum cadastro esperando decisão" description="Cadastros novos e alterações de dados dos fornecedores aparecem aqui." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {novos.map((c) => (
        <Item key={`n${c.id}`} c={c} alteracao={false} />
      ))}
      {alteracoes.map((c) => (
        <Item key={`a${c.id}`} c={c} alteracao />
      ))}
    </div>
  );
}
