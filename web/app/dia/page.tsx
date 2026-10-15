import type { Metadata } from "next";
import { TelaDoDia } from "@/components/dia/TelaDoDia";
import { usuarioAtual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";
import { dadosDoDia } from "@/lib/dia/tela";
import { perfilPode } from "@/lib/sessao";

export const metadata: Metadata = { title: "AGROVIA Hoje" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const usuario = await usuarioAtual();
  // Quem opera a descarga: gestor de armazém, Compras e Adm Master (a rota já barra os demais perfis)
  const podeOperar = !!usuario && perfilPode(usuario.perfil, "armazem");
  return <TelaDoDia inicial={await dadosDoDia(getDb(), agoraISO())} podeOperar={podeOperar} />;
}
