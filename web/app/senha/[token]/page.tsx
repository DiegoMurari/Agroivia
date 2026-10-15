import type { Metadata } from "next";

import { SenhaForm } from "@/components/auth/SenhaForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { SENHA_MINIMA } from "@/lib/auth";

export const metadata: Metadata = { title: "Definir senha" };
export const dynamic = "force-dynamic";

/** `/senha/<token>` (convite ou recuperação) e `/senha/trocar` (senha temporária de quem já entrou). */
export default async function SenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pelaSessao = token === "trocar";
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] w-full max-w-md flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>{pelaSessao ? "Troque a senha temporária" : "Defina sua senha"}</h1>
          </CardTitle>
          <CardDescription>
            {pelaSessao
              ? "É o seu primeiro acesso: escolha uma senha só sua para continuar."
              : "O link vale uma vez. Depois de gravar, você já entra no sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SenhaForm token={pelaSessao ? undefined : token} minimo={SENHA_MINIMA} />
        </CardContent>
      </Card>
    </div>
  );
}
