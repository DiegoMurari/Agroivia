"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/Button";

/**
 * Alterna entre tema claro e escuro.
 * Usa a View Transitions API (quando disponível) para um crossfade suave
 * e respeita `prefers-reduced-motion`.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || reduceMotion) {
      setTheme(next);
      return;
    }
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Alternar tema claro e escuro"
      title="Alternar tema"
      className={className}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
