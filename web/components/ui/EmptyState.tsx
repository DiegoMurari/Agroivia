import * as React from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Ícone do lucide-react: <CalendarX />. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ação que resolve o vazio: <Button>Novo agendamento</Button>. */
  action?: React.ReactNode;
}

/**
 * Estado vazio de lista, tabela ou período sem dado.
 *
 * <EmptyState icon={<CalendarX />} title="Nenhum agendamento hoje" description="Os de amanhã aparecem aqui à meia-noite." />
 */
function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center", className)}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };
