import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pageWrapperVariants = cva("mx-auto w-full px-4 py-8 sm:px-6 md:py-10 lg:px-8", {
  variants: {
    size: {
      narrow: "max-w-3xl", // formulários, configurações, texto longo
      default: "max-w-6xl", // dashboards e páginas gerais
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
        <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            {title && <h1 className="text-h1 text-foreground">{title}</h1>}
            {description && <p className="max-w-2xl text-base text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}

export { PageWrapper, pageWrapperVariants };
