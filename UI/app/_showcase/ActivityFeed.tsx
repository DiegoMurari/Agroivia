import { CircleCheck, CircleX, Clock, Info } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/Badge";

import type { Activity, ActivityStatus } from "./data";

const statusBadge: Record<
  ActivityStatus,
  { label: string; variant: BadgeProps["variant"]; icon: React.ReactNode }
> = {
  live: { label: "No ar", variant: "success", icon: <CircleCheck /> },
  building: { label: "Em build", variant: "warning", icon: <Clock /> },
  failed: { label: "Falhou", variant: "destructive", icon: <CircleX /> },
  review: { label: "Em revisão", variant: "info", icon: <Info /> },
};

export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <ul className="grid gap-4">
      {items.map((item) => {
        const status = statusBadge[item.status];
        return (
          <li key={`${item.name}-${item.action}`} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            >
              {item.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.action}</p>
              <p className="text-[13px] text-muted-foreground">
                {item.name}, {item.time}
              </p>
            </div>
            <Badge variant={status.variant}>
              {status.icon}
              {status.label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
