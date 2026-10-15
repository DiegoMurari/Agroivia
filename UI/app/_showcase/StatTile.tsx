import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

import type { Kpi } from "./data";

/** KPI: rótulo, valor, variação (direção x se subir é bom) e medidor opcional. */
export function StatTile({ label, value, unit, delta, progress, progressLabel }: Kpi) {
  return (
    <Card className="gap-0 px-5 py-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-foreground">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>

      {delta && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-[13px] font-medium",
            delta.good ? "text-success" : "text-destructive",
          )}
        >
          {delta.trend === "up" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {delta.value}
          <span className="font-normal text-muted-foreground">{delta.period}</span>
          <span className="sr-only">{delta.good ? "(melhora)" : "(piora)"}</span>
        </p>
      )}

      {progress !== undefined && (
        <div className="mt-3.5 space-y-1.5">
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-brand/15"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
          </div>
          {progressLabel && <p className="text-[13px] text-muted-foreground">{progressLabel}</p>}
        </div>
      )}
    </Card>
  );
}
