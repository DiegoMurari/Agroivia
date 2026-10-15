"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Truck, UserPlus } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type Tipo = "compras" | "fornecedor";

const TIPOS: { valor: Tipo; rotulo: string; icone: typeof Truck }[] = [
  { valor: "compras", rotulo: "Agrovia", icone: Building2 },
  { valor: "fornecedor", rotulo: "Fornecedor", icone: Truck },
];

interface Resposta {
  ok: boolean;
  data?: { destino?: string; mensagem?: string; linkDemo?: string };
  erro?: { mensagem: string; campos?: Record<string, string> };
}

async function enviar(url: string, corpo: unknown): Promise<Resposta> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
    return (await r.json()) as Resposta;
  } catch {
    return { ok: false, erro: { mensagem: "Sem resposta do servidor. Confira a conexão e tente de novo." } };
  }
}

/** Login único (D49): o usuário escolhe Agrovia ou Fornecedor antes de entrar. */
export function LoginForm({ voltar, tipoInicial = "compras" }: { voltar?: string; /** Aba aberta de início: o site da Agrovia manda o fornecedor direto para a aba dele. */ tipoInicial?: Tipo }) {
  const [tipo, setTipo] = React.useState<Tipo>(tipoInicial);
  const [modo, setModo] = React.useState<"entrar" | "recuperar">("entrar");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [mostrar, setMostrar] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<{ mensagem: string; link?: string } | null>(null);

  function limpar() {
    setErro(null);
    setAviso(null);
  }

  async function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    if (modo === "entrar") {
      const r = await enviar("/api/auth/entrar", { email, senha, tipo });
      if (r.ok && r.data?.destino) {
        // Agrovia sempre cai no Hoje. O fornecedor só volta para um caminho interno da própria área.
        const interno = !!voltar && voltar.startsWith("/") && !voltar.startsWith("//");
        const daArea = tipo === "fornecedor" && interno && voltar.startsWith("/fornecedor");
        window.location.assign(daArea && !r.data.destino.startsWith("/senha") ? voltar : r.data.destino);
        return;
      }
      setErro(r.erro?.mensagem ?? "Não foi possível entrar.");
    } else {
      const r = await enviar("/api/auth/recuperar", { email, tipo });
      if (r.ok) setAviso({ mensagem: r.data?.mensagem ?? "Pedido registrado.", link: r.data?.linkDemo });
      else setErro(r.erro?.campos?.email ?? r.erro?.mensagem ?? "Não foi possível enviar o link.");
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-5 [&_input:not([type=checkbox])]:h-11 [&_input:not([type=checkbox])]:text-base [&_label]:text-sm [&_label]:font-semibold" noValidate>
      <div role="radiogroup" aria-label="Tipo de acesso" className="relative grid grid-cols-2 rounded-xl border border-input bg-muted p-1">
        {/* O destaque desliza de um lado ao outro (só transform) */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-card shadow-card ring-1 ring-border",
            "transition-transform duration-300 ease-out-expo",
            tipo === "fornecedor" && "translate-x-full",
          )}
        />
        {TIPOS.map(({ valor, rotulo, icone: Icone }) => {
          const ativo = tipo === valor;
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => {
                setTipo(valor);
                limpar();
              }}
              className={cn(
                "relative z-10 flex h-11 items-center justify-center gap-2 rounded-md text-base font-semibold transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                ativo ? "text-brand" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="size-5" /> {rotulo}
            </button>
          );
        })}
      </div>

      <Field label="E-mail" required>
        <Input size="lg" type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>

      {modo === "entrar" && (
        <div className="space-y-2">
          <Field label="Senha" required>
            <Input size="lg" type={mostrar ? "text" : "password"} name="senha" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Field>
          <Checkbox label="Mostrar a senha" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
        </div>
      )}

      {erro && (
        <Alert variant="destructive" title={modo === "entrar" ? "Não foi possível entrar" : "Não foi possível enviar"}>
          {erro}
        </Alert>
      )}
      {aviso && (
        <Alert variant="info" title="Confira seu e-mail">
          {aviso.mensagem}
          {aviso.link && (
            <span className="mt-1 block">
              Sem servidor de e-mail:{" "}
              <Link className="text-brand underline" href={aviso.link}>
                abrir o link de nova senha
              </Link>
              .
            </span>
          )}
        </Alert>
      )}

      <Button type="submit" size="lg" className="h-11 w-full text-base" loading={enviando}>
        {modo === "entrar" ? "Entrar" : "Enviar link de nova senha"}
      </Button>

      <div className="flex flex-col items-center gap-3 text-sm">
        <button
          type="button"
          className="text-brand underline"
          onClick={() => {
            setModo(modo === "entrar" ? "recuperar" : "entrar");
            limpar();
          }}
        >
          {modo === "entrar" ? "Esqueci a senha" : "Voltar para o login"}
        </button>
        {tipo === "fornecedor" ? (
          <div className="w-full space-y-2 border-t pt-3 text-center">
            <p className="text-muted-foreground">Ainda não tem cadastro?</p>
            <Button asChild variant="outline" size="lg" className="h-11 w-full text-base">
              <Link href="/cadastro/aberto">
                <UserPlus /> Registre-se
              </Link>
            </Button>
          </div>
        ) : (
          <span className="text-center text-muted-foreground">Não tem conta? Peça ao Adm Master.</span>
        )}
      </div>
    </form>
  );
}
