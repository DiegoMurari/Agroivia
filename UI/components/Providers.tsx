"use client";

import { LucideProvider } from "lucide-react";
import { ThemeProvider } from "next-themes";

/**
 * Providers globais do app.
 * - next-themes: aplica a classe `.dark` no <html> sem flash no carregamento.
 * - LucideProvider: padroniza a espessura de traço de todos os ícones.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LucideProvider strokeWidth={1.75}>{children}</LucideProvider>
    </ThemeProvider>
  );
}
