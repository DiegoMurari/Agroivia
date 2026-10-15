import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    // Carregando: mantém a cor (não parece desabilitado) e troca ícones pelo spinner
    "aria-busy:opacity-100 aria-busy:[&_svg:not(.animate-spin)]:hidden",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-brand underline-offset-4 hover:underline active:scale-100",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:outline-destructive dark:bg-destructive/60 dark:hover:bg-destructive/50",
      },
      size: {
        sm: "h-8 px-3 text-[13px] has-[>svg]:px-2.5",
        md: "h-9 px-4 text-sm has-[>svg]:px-3",
        lg: "h-11 px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0 has-[>svg]:px-0" }],
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza o filho (ex.: <a> ou <Link>) com o estilo do botão. */
    asChild?: boolean;
    /** Mostra um spinner, desabilita o botão e marca aria-busy. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-disabled={asChild && disabled ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <LoaderCircle className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
