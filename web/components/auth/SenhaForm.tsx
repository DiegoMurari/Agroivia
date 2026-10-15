"use client";

import * as React from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

interface Resposta {
  ok: boolean;
  data?: { destino: string };
  erro?: { mensagem: string; campos?: Record<string, string> };
}

/** Define a senha pelo link de convite ou de recuperação, ou troca a senha temporária de quem já entrou. */
export function SenhaForm({ token, minimo }: { token?: string; minimo: number }) {
  const [senha, setSenha] = React.useState("");
  const [repete, setRepete] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const diferente = repete.length > 0 && senha !== repete;

  async function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (senha.length < minimo) return setErro(`A senha precisa de pelo menos ${minimo} caracteres.`);
    if (senha !== repete) return setErro("As duas senhas precisam ser iguais.");
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const corpo = (await r.json()) as Resposta;
      if (corpo.ok && corpo.data) return window.location.assign(corpo.data.destino);
      setErro(corpo.erro?.campos?.senha ?? corpo.erro?.mensagem ?? "Não foi possível gravar a senha.");
    } catch {
      setErro("Sem resposta do servidor. Confira a conexão e tente de novo.");
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-5" noValidate>
      <Field label="Nova senha" description={`Pelo menos ${minimo} caracteres.`} required>
        <Input type="password" name="senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </Field>
      <Field label="Repita a senha" required error={diferente ? "As duas senhas precisam ser iguais." : undefined}>
        <Input type="password" name="repete" autoComplete="new-password" value={repete} onChange={(e) => setRepete(e.target.value)} />
      </Field>
      {erro && (
        <Alert variant="destructive" title="Senha não gravada">
          {erro}
        </Alert>
      )}
      <Button type="submit" className="w-full" loading={enviando}>
        Gravar senha e entrar
      </Button>
    </form>
  );
}
