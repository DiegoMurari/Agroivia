import * as React from "react";

import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  /** Texto ao lado da caixa. Sem ele, passe `aria-label`. */
  label?: React.ReactNode;
  /** Texto de ajuda abaixo do rótulo. */
  description?: React.ReactNode;
}

/**
 * Caixa de seleção nativa com rótulo clicável.
 * <Checkbox name="fazBoletim" label="Faz boletim" defaultChecked />
 */
function Checkbox({ className, label, description, id, ...props }: CheckboxProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;

  const caixa = (
    <input
      type="checkbox"
      id={controlId}
      data-slot="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded-sm border border-input accent-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );

  if (!label) return caixa;

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-5 items-center">{caixa}</span>
      <div className="grid gap-1">
        <label htmlFor={controlId} className="cursor-pointer text-sm leading-5 font-medium text-foreground select-none">
          {label}
        </label>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export { Checkbox, type CheckboxProps };
