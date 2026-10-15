import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { controlBase } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

const selectVariants = cva([...controlBase, "cursor-pointer appearance-auto pr-2"], {
  variants: {
    size: {
      sm: "h-8 px-2 text-base sm:text-[13px]",
      md: "h-9 px-2.5 text-base sm:text-sm",
      lg: "h-11 px-3 text-base",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type SelectProps = Omit<React.ComponentProps<"select">, "size"> & VariantProps<typeof selectVariants>;

/**
 * <select> nativo com o visual do Input. Funciona dentro do <Field>:
 * <Field label="Armazém"><Select name="armazem"><option value="1">Adubo</option></Select></Field>
 */
function Select({ className, size, ...props }: SelectProps) {
  return <select data-slot="select" className={cn(selectVariants({ size }), className)} {...props} />;
}

export { Select, selectVariants, type SelectProps };
