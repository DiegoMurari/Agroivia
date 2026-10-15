"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** Quantos cartões cabem de uma vez na tela larga; acima disso a fila anda para o lado em vez de quebrar para baixo. */
export const CARTOES_VISIVEIS = 3;

/** Cada cartão ocupa 1 coluna no celular, 2 no médio e 3 no largo, com o espaço de 20 px entre eles. */
export const LARGURA_DO_CARTAO = "basis-full md:basis-[calc((100%-1.25rem)/2)] xl:basis-[calc((100%-2.5rem)/3)]";

/** Fila horizontal com rolagem suave e setas. As setas só aparecem quando há para onde andar. */
export function Carrossel({ children, rotulo, compacto = false, alinhado = false }: { children: React.ReactNode; rotulo: string; /** Cartões pequenos, com espaço menor entre eles. */ compacto?: boolean; /** Sem calha lateral: os cartões alinham com a coluna e as setas ficam numa linha embaixo, sem cobrir nada. */ alinhado?: boolean }) {
  const faixa = React.useRef<HTMLUListElement>(null);
  const [pode, setPode] = React.useState({ esquerda: false, direita: false });

  const medir = React.useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    setPode({ esquerda: el.scrollLeft > 4, direita: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  React.useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [medir, children]);

  function andar(sentido: -1 | 1) {
    const el = faixa.current;
    if (!el) return;
    el.scrollBy({ left: sentido * (el.clientWidth + (compacto ? 12 : 20)), behavior: "smooth" });
  }

  const seta = "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border bg-card text-brand shadow-elevated transition-[opacity,transform] duration-200 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <div className={cn("relative min-w-0 max-w-full", !alinhado && "md:px-8")} role="region" aria-roledescription="carrossel" aria-label={rotulo}>
      <ul
        ref={faixa}
        onScroll={medir}
        className={cn("flex w-full min-w-0 snap-x snap-mandatory items-stretch overflow-x-auto overflow-y-hidden scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", compacto ? "gap-3" : "gap-5")}
      >
        {children}
      </ul>
      {alinhado ? (
        <div className="mt-1 flex justify-center gap-3">
          <button type="button" aria-label="Ver os cartões anteriores" onClick={() => andar(-1)} disabled={!pode.esquerda} className={cn(seta, "static translate-y-0", !pode.esquerda && "opacity-40")}>
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Ver os próximos cartões" onClick={() => andar(1)} disabled={!pode.direita} className={cn(seta, "static translate-y-0", !pode.direita && "opacity-40")}>
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <button type="button" aria-label="Ver os cartões anteriores" onClick={() => andar(-1)} tabIndex={pode.esquerda ? 0 : -1} className={cn(seta, "left-0 max-md:hidden", !pode.esquerda && "pointer-events-none opacity-0")}>
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Ver os próximos cartões" onClick={() => andar(1)} tabIndex={pode.direita ? 0 : -1} className={cn(seta, "right-0 max-md:hidden", !pode.direita && "pointer-events-none opacity-0")}>
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

/** Cartão de mentira, em branco e desfocado, que guarda o lugar de uma entrega para o quadro não mudar de forma. */
export function CartaoFantasma() {
  return (
    <li aria-hidden="true" className={cn("shrink-0 snap-start select-none", LARGURA_DO_CARTAO)}>
      <div className="flex h-full min-h-72 flex-col gap-5 rounded-2xl border bg-card p-6 opacity-70 blur-[5px]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid flex-1 gap-2">
            <span className="h-5 w-20 rounded-full bg-muted" />
            <span className="h-6 w-4/5 rounded bg-muted" />
            <span className="h-4 w-1/2 rounded bg-muted" />
          </div>
          <span className="h-9 w-16 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="mx-auto size-7 rounded-full bg-muted" />
          ))}
        </div>
        <span className="h-16 rounded-xl bg-muted" />
        <span className="mt-auto h-11 rounded-md bg-muted" />
      </div>
    </li>
  );
}

/** Três fantasmas com um aviso por cima: o que aparece quando nada está em andamento. */
export function QuadroVazio({ mensagem }: { mensagem: string }) {
  return (
    <div className="relative px-8">
      <ul className="flex items-stretch gap-5 overflow-hidden" aria-hidden="true">
        {Array.from({ length: CARTOES_VISIVEIS }, (_, i) => (
          <CartaoFantasma key={i} />
        ))}
      </ul>
      <p role="status" className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl border border-success/30 bg-card px-6 py-4 text-lg font-medium text-success shadow-elevated">
        <CircleCheck className="size-6" aria-hidden="true" /> {mensagem}
      </p>
    </div>
  );
}
