"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { enviar } from "./api";
import { CamposFornecedor, VAZIO, type ValoresFornecedor } from "./CamposFornecedor";

/** Formulário público do convite. Ao gravar, o cadastro fica aguardando a aprovação de Compras. */
export function CadastroForm({ token, senhaMinima }: { token: string; senhaMinima: number }) {
  const [valores, setValores] = useState<ValoresFornecedor>(VAZIO);
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function gravar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErros({});
    setMensagem(null);
    const r = await enviar(`/api/cadastro/${encodeURIComponent(token)}`, "POST", { ...valores, senha });
    setEnviando(false);
    if (r.ok) setPronto(true);
    else {
      setErros(r.campos ?? {});
      setMensagem(r.mensagem ?? "Não foi possível enviar o cadastro.");
    }
  }

  if (pronto) {
    return (
      <Alert variant="success" title="Cadastro enviado">
        <span className="flex items-center gap-2">
          <CircleCheck aria-hidden className="size-4" /> Aguardando aprovação de Compras. Quando for aprovado, você entra com o e-mail e a senha que escolheu.
        </span>
      </Alert>
    );
  }

  return (
    <form onSubmit={gravar} noValidate className="flex flex-col gap-5">
      <CamposFornecedor valores={valores} aoMudar={setValores} erros={erros} />
      <Field label="Senha" required error={erros.senha} description={`Mínimo de ${senhaMinima} caracteres.`}>
        <Input name="senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </Field>
      <div aria-live="polite">
        {mensagem && (
          <Alert variant="destructive" title="Confira o cadastro">
            {mensagem}
          </Alert>
        )}
      </div>
      <div>
        <Button type="submit" loading={enviando}>
          Enviar cadastro
        </Button>
      </div>
    </form>
  );
}
