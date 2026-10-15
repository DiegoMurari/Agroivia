import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#005BA0" },
    { media: "(prefers-color-scheme: dark)", color: "#091018" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: o next-themes ajusta a classe do <html> antes da hidratação
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(GeistSans.variable, GeistMono.variable, "antialiased")}
    >
      <body className="min-h-dvh">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
