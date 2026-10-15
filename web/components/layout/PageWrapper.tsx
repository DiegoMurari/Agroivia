import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pageWrapperVariants = cva("mx-auto w-full px-4 py-6 sm:px-6 md:py-8 lg:px-8", {
  variants: {
    size: {
      narrow: "max-w-3xl", // formulários, configurações, texto longo
      default: "max-w-[1400px]", // dashboards e páginas gerais: a mesma largura de "wide", para o menu não pular entre telas
      wide: "max-w-[1400px]", // tabelas e grids densos
      full: "max-w-none",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

interface PageWrapperProps
  extends Omit<React.ComponentProps<"div">, "title">,
    VariantProps<typeof pageWrapperVariants> {
  /** Título da página (renderizado como o <h1> da página). */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Botões à direita do título. Quebram para baixo no mobile. */
  actions?: React.ReactNode;
  /** Animação de entrada (fade + leve subida). Desligada com prefers-reduced-motion. */
  animated?: boolean;
}

/**
 * Container padrão de página: largura máxima, respiro lateral e entrada suave.
 * Use dentro do <main> do layout.
 */
function PageWrapper({
  title,
  description,
  actions,
  size,
  animated = true,
  className,
  children,
  ...props
}: PageWrapperProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <div
      data-slot="page"
      className={cn(pageWrapperVariants({ size }), animated && "motion-safe:animate-fade-in-up", className)}
      {...props}
    >
      {hasHeader && (
        <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", actions ? "mb-6" : "sr-only")}>
          {/* Título e descrição só para leitores de tela: o menu já diz em que tela a pessoa está */}
          <div className="min-w-0">
            {title && <h1 className="sr-only">{title}</h1>}
            {description && <p className="sr-only">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}

export { PageWrapper, pageWrapperVariants };
