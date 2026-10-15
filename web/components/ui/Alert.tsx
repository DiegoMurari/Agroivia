import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-lg border border-l-4 bg-card px-4 py-3 text-sm shadow-card [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      info: "border-brand/20 border-l-brand text-foreground [&>svg]:text-brand",
      success: "border-success/20 border-l-success text-foreground [&>svg]:text-success",
      warning: "border-warning/25 border-l-warning text-foreground [&>svg]:text-warning",
      destructive: "border-destructive/20 border-l-destructive text-foreground [&>svg]:text-destructive",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const ICONES = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleAlert,
} as const;

interface AlertProps extends Omit<React.ComponentProps<"div">, "title">, VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
  /** Botão ou link à direita (ex.: "Ver próxima data"). */
  action?: React.ReactNode;
}

/**
 * Aviso em linha. O ícone acompanha a variante (status nunca só pela cor).
 * Erro e aviso são anunciados por leitores de tela.
 *
 * <Alert variant="destructive" title="Horário cheio">A próxima data disponível é 06/10 às 08:00.</Alert>
 */
function Alert({ className, variant, title, action, children, ...props }: AlertProps) {
  const Icone = ICONES[variant ?? "info"];
  const urgente = variant === "destructive" || variant === "warning";

  return (
    <div
      data-slot="alert"
      role={urgente ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icone aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="leading-5 font-medium">{title}</p>}
        {children && <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Alert, alertVariants, type AlertProps };
