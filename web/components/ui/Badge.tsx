import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status nunca depende só da cor: combine a variante com um ícone e um texto claro.
 * <Badge variant="success"><CircleCheck /> Aprovado</Badge>
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap",
    "[&>svg]:pointer-events-none [&>svg]:size-3 [&>svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        solid: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border text-foreground",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/10 text-warning",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-brand/20 bg-brand/10 text-brand",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, type BadgeProps };
