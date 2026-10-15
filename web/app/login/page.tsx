import type { Metadata } from "next";
import Image from "next/image";
import { CalendarCheck, ClipboardCheck, ScanBarcode, Truck } from "lucide-react";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

const PONTOS = [
  { icone: CalendarCheck, texto: "Agenda de descargas por fornecedor e galpão" },
  { icone: ScanBarcode, texto: "Nota fiscal conferida na portaria, na hora" },
  { icone: ClipboardCheck, texto: "Cada etapa registrada, do pedido ao fim da descarga" },
];

/** Cartão de demonstração: a barra de progresso de uma entrega andando, como no Hoje. */
function EntregaDeExemplo() {
  return (
    <div aria-hidden="true" className="w-full max-w-md rounded-2xl bg-card p-5 text-card-foreground shadow-overlay motion-safe:animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-brand">Fornecedor exemplo</p>
          <p className="text-base text-muted-foreground">ABC1D23 · Adubo</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">08:00</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full origin-left rounded-full bg-success motion-safe:animate-[login-barra_6s_ease-in-out_infinite]" style={{ width: "100%" }} />
      </div>
      <div className="mt-2.5 grid grid-cols-5 text-xs font-medium text-muted-foreground">
        <span>A chegar</span>
        <span className="text-center">Portaria</span>
        <span className="text-center">Pátio</span>
        <span className="text-center">Descarga</span>
        <span className="text-right">Concluído</span>
      </div>
    </div>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ voltar?: string; tipo?: string }> }) {
  const { voltar, tipo } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <style>{`@keyframes login-barra{0%{transform:scaleX(.06)}55%{transform:scaleX(1)}85%{transform:scaleX(1)}100%{transform:scaleX(.06)}}`}</style>

      {/* Painel da marca: some no celular, onde só o formulário importa */}
      <aside className="relative hidden overflow-hidden bg-brand px-10 py-8 text-brand-foreground lg:flex lg:flex-col lg:justify-between lg:gap-6 lg:py-8">
        <span aria-hidden="true" className="absolute -top-24 -right-24 size-96 rounded-full border-[56px] border-white/5" />
        <span aria-hidden="true" className="absolute -bottom-32 -left-20 size-[28rem] rounded-full border-[56px] border-white/5" />
        <div className="relative">
          <span className="inline-block rounded-xl bg-white px-4 py-3 shadow-card">
            <Image src="/agrovia-logo.png" alt="AGROVIA" width={176} height={45} priority unoptimized className="h-11 w-auto" />
          </span>
        </div>
        <div className="relative space-y-6">
          <div className="space-y-3">
            <span aria-hidden="true" className="block h-1.5 w-16 rounded-full bg-highlight" />
            <h1 className="max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-[2.5rem]">Cada caminhão no lugar e na hora certa.</h1>
          </div>
          <EntregaDeExemplo />
          <ul className="grid gap-3 text-base">
            {PONTOS.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
                  <Icone className="size-5" aria-hidden="true" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-sm opacity-80">
          <Truck className="size-4" aria-hidden="true" /> Recebimento de insumos
        </p>
      </aside>

      <section className="flex items-center justify-center px-5 py-8 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:text-left">
            <span aria-hidden="true" className="mb-4 block h-1.5 w-12 rounded-full bg-highlight max-lg:mx-auto" />
            <h2 className="text-4xl font-semibold tracking-tight text-brand">Entrar</h2>
            <p className="mt-2 text-base text-muted-foreground text-balance">Use o e-mail e a senha da sua conta.</p>
          </div>
          <LoginForm voltar={voltar} tipoInicial={tipo === "fornecedor" ? "fornecedor" : "compras"} />
        </div>
      </section>
    </div>
  );
}
