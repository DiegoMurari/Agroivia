"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { enviar } from "./api";
import { CamposFornecedor, type ValoresFornecedor } from "./CamposFornecedor";

/** Edição dos dados do fornecedor aprovado. A mudança vai para aprovação; os dados atuais continuam valendo. */
export function DadosFornecedorForm({ inicial, aguardando }: { inicial: ValoresFornecedor; aguardando: boolean }) {
  const router = useRouter();
  const [valores, setValores] = useState<ValoresFornecedor>(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function gravar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErros({});
    setMensagem(null);
    const r = await enviar("/api/fornecedor/dados", "PUT", valores);
    setOcupado(false);
    if (r.ok) {
      setEnviado(true);
      router.refresh();
    } else {
      setErros(r.campos ?? {});
      setMensagem(r.mensagem ?? "Não foi possível enviar a alteração.");
    }
  }

  return (
    <form onSubmit={gravar} noValidate className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="text-h3 text-brand">Dados da empresa</h2>
      {(aguardando || enviado) && (
        <Alert variant="warning" title="Alteração aguardando aprovação">
          Compras ainda não aprovou a última alteração. Até lá, os dados anteriores continuam valendo. Se você enviar de novo, a nova alteração substitui a anterior.
        </Alert>
      )}
      <CamposFornecedor valores={valores} aoMudar={setValores} erros={erros} />
      <div aria-live="polite">
        {mensagem && (
          <Alert variant="destructive" title="Confira os dados">
            {mensagem}
          </Alert>
        )}
      </div>
      <div className="border-t pt-4">
        <Button type="submit" loading={ocupado}>
          Enviar alteração para aprovação
        </Button>
      </div>
    </form>
  );
}
