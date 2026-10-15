import type { Metadata } from "next";

import { CadastroForm } from "@/components/aprovacoes/CadastroForm";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDb } from "@/lib/db";
import { conviteDoToken } from "@/lib/aprovacoes/cadastro";
import { SENHA_MINIMA } from "@/lib/senha";

export const metadata: Metadata = { title: "Cadastro de fornecedor" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const convite = conviteDoToken(getDb(), token);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6 border-b-4 border-highlight pb-4">
        <h1 className="text-h1 text-brand">Registre-se como fornecedor</h1>
        <p className="mt-1 text-muted-foreground">Preencha os dados da sua empresa. Compras da Agrovia confere e aprova antes do primeiro acesso.</p>
      </div>
      {!convite ? (
        <Alert variant="destructive" title="Convite não encontrado">
          Confira o link recebido ou peça um novo convite a Compras.
        </Alert>
      ) : convite.usado ? (
        <Alert variant="warning" title="Este convite já foi usado">
          Se o cadastro já foi enviado, aguarde a aprovação de Compras. Para outro cadastro, peça um novo convite.
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Dados da empresa</h2>
            </CardTitle>
            <CardDescription>Campos com asterisco são obrigatórios.</CardDescription>
          </CardHeader>
          <CardContent>
            <CadastroForm token={token} senhaMinima={SENHA_MINIMA} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
