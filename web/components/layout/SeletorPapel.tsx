"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

interface SeletorPapelProps {
  /** Papel lido do cookie no servidor. */
  papel: string;
  /** Nome do cookie deste servidor (leva a porta). */
  cookie: string;
  opcoes: { valor: string; rotulo: string }[];
  className?: string;
}

/** Troca o papel (D05): grava o cookie e recarrega os dados do servidor. */
export function SeletorPapel({ papel, cookie, opcoes, className }: SeletorPapelProps) {
  const router = useRouter();
  const id = React.useId();

  function trocar(evento: React.ChangeEvent<HTMLSelectElement>) {
    document.cookie = `${cookie}=${evento.target.value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <label htmlFor={id} className="sr-only">
        Papel
      </label>
      <UserRound aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
      <select
        id={id}
        value={papel}
        onChange={trocar}
        className={cn(
          "h-8 max-w-40 cursor-pointer rounded-md border border-input bg-card px-2 text-[13px] font-medium text-foreground shadow-xs dark:bg-input/30",
          "transition-[border-color,box-shadow] duration-150 ease-out hover:border-muted-foreground/40",
          "focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/25",
        )}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
