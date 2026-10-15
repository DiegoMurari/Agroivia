import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

interface CardProps extends React.ComponentProps<"div"> {
  /** Renderiza o filho (ex.: <a> ou <Link>) com o estilo do card. */
  asChild?: boolean;
  /** Hover com elevação e foco visível, para cards clicáveis. */
  interactive?: boolean;
}

function Card({ className, asChild = false, interactive = false, ...props }: CardProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-card",
        interactive && [
          "cursor-pointer transition-[box-shadow,border-color,transform] duration-200 ease-out-expo",
          "hover:-translate-y-px hover:border-muted-foreground/25 hover:shadow-elevated active:translate-y-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        ],
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

/** Renderiza um <h3>. Use asChild para trocar o nível: <CardTitle asChild><h2>...</h2></CardTitle> */
function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"h3"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "h3";

  return (
    <Comp
      data-slot="card-title"
      className={cn("text-base leading-snug font-semibold tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

/** Ação no canto superior direito do header (botão, badge, menu). */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      // mt-auto: em cards lado a lado (mesma altura), o rodapé alinha na base
      className={cn("mt-auto flex items-center gap-2 px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
