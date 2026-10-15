"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const ROTULOS: Record<string, string> = {
  "/agendamento": "Agendamento",
  "/boletim": "Boletim",
  "/cadastros": "Cadastros",
  "/auditoria": "Auditoria",
  "/fornecedor": "Meus pedidos",
  "/fornecedor/pedidos": "Meus pedidos",
  "/dia": "Hoje",
};

/** Telas de detalhe: a de cima é a lista do módulo. Fora disso, sobe um nível na rota. */
function paiDe(caminho: string, perfil: string): string | null {
  const partes = caminho.split("/").filter(Boolean);
  if (partes.length < 2) return null;
  // Telas soltas que não são detalhe de nada
  if (["login", "senha", "cadastro", "design"].includes(partes[0])) return null;
  // As abas do Espaço Fornecedor ficam no menu: só o detalhe de um pedido volta para a lista
  if (caminho === "/fornecedor/pedidos" || caminho === "/fornecedor/dados") return null;
  let pai = `/${partes.slice(0, -1).join("/")}`;
  // Pastas que existem só para agrupar o detalhe: o pai de verdade é a lista do módulo
  if (["/boletim/dia", "/agendamento/descarga", "/agendamento/agendar", "/cadastros/equipamentos"].includes(pai)) pai = `/${partes[0]}`;
  if (partes[0] === "agendamento") {
    // O gestor de armazém e a portaria não têm a lista de Agendamento; o fornecedor volta para a área dele
    if (perfil === "fornecedor") return "/fornecedor";
    if (perfil === "armazem") return caminho.startsWith("/agendamento/descarga") ? "/dia" : null;
    if (perfil === "portaria") return caminho.startsWith("/agendamento/descarga") ? "/agendamento/portaria" : null;
  }
  return pai === "" ? null : pai;
}

function rotuloDe(pai: string): string {
  return ROTULOS[pai] ?? "Voltar";
}

/** Botão "Voltar" no alto das telas de dentro de um módulo. Não sai no papel. */
export function BotaoVoltar({ perfil }: { perfil: string | null }) {
  const pathname = usePathname();
  if (!perfil) return null;
  const pai = paiDe(pathname, perfil);
  if (!pai) return null;
  const nome = pai === "/agendamento/portaria" ? "Portaria" : rotuloDe(pai);
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8 print:hidden">
      <Link
        href={pai}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-brand transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {nome === "Voltar" ? "Voltar" : `Voltar para ${nome}`}
      </Link>
    </div>
  );
}
