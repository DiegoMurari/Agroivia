"use client";

import { LucideProvider } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";

/**
 * Providers globais do app.
 * - next-themes: aplica a classe `.dark` no <html> sem flash no carregamento. A tela de login é sempre clara.
 * - LucideProvider: padroniza a espessura de traço de todos os ícones.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange forcedTheme={pathname === "/login" ? "light" : undefined}>
      <LucideProvider strokeWidth={1.75}>{children}</LucideProvider>
    </ThemeProvider>
  );
}
