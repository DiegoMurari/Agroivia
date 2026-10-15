import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Ensina ao tailwind-merge os tokens customizados do tailwind.config.ts.
 * Sem isso, `text-h1` seria tratado como cor e removido ao lado de `text-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h1", "h2", "h3"],
      shadow: ["card", "elevated", "overlay"],
      ease: ["out-expo", "in-expo"],
      animate: ["fade-in", "fade-out", "fade-in-up", "fade-in-down", "scale-in", "shimmer"],
    },
  },
});

/** Junta classes condicionais e resolve conflitos do Tailwind (a última vence). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
