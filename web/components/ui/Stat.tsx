import * as React from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface StatProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** Número em destaque, já formatado (ex.: formatNumero do lib/money). */
  value: React.ReactNode;
  /** Unidade ao lado do número: "chapas", "min", "R$". */
  unit?: React.ReactNode;
  /** Linha de apoio abaixo: método, período ou comparação. */
  description?: React.ReactNode;
  /** Canto superior direito: a origem do dado (<Badge>Histórico</Badge>) ou um status. */
  badge?: React.ReactNode;
  /** Cor do número quando ele é um veredito. */
  tone?: "default" | "success" | "warning" | "destructive";
}

const TONS = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
} as const;

/**
 * Número em destaque com rótulo, unidade e origem.
 *
 * <Stat label="Complemento pago" value="73,71" unit="R$" description="17/11/2025, Adubo"
 *   badge={<Badge variant="outline">Teste</Badge>} />
 */
function Stat({ label, value, unit, description, badge, tone = "default", className, ...props }: StatProps) {
  return (
    <Card data-slot="stat" className={cn("gap-0 px-5 py-5", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {badge}
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("text-[1.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums", TONS[tone])}>
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>

      {description && <p className="mt-3 text-[13px] text-muted-foreground">{description}</p>}
    </Card>
  );
}

export { Stat, type StatProps };
