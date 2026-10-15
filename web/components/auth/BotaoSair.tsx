"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/Button";

/** Encerra a sessão e volta ao login. */
export function BotaoSair({ className, tamanho = "sm" }: { className?: string; tamanho?: "sm" | "md" }) {
  const router = useRouter();

  async function sair() {
    await fetch("/api/auth/sair", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size={tamanho} className={className} onClick={sair}>
      <LogOut /> Sair
    </Button>
  );
}
