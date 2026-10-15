import type { Config } from "tailwindcss";

/**
 * Tema do design system.
 *
 * Este arquivo mapeia as variáveis CSS de `app/globals.css` para utilitários
 * do Tailwind (bg-primary, text-muted-foreground, rounded-xl, shadow-card...).
 * Os VALORES das cores (light e dark) vivem no globals.css; aqui ficam só os nomes.
 *
 * Tailwind v4 carrega este arquivo via `@config` no globals.css.
 *
 * Regra de formas (manter em todo o projeto):
 *   - Controles (Button, Input): rounded-md  (6px)
 *   - Superfícies (Card, painéis): rounded-xl (12px)
 *   - Indicadores (Badge, avatar): rounded-full
 */
const config = {
  darkMode: "selector", // classe `.dark` no <html>, aplicada pelo next-themes
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        excess: "var(--excess)",
        lack: "var(--lack)",
        brand: {
          DEFAULT: "var(--brand)",
          foreground: "var(--brand-foreground)",
        },
        highlight: {
          DEFAULT: "var(--highlight)",
          foreground: "var(--highlight-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Escala de títulos com tracking negativo (padrão Vercel/Linear).
      // Corpo de texto continua com text-sm / text-base do Tailwind.
      fontSize: {
        display: ["3rem", { lineHeight: "1.05", letterSpacing: "-0.045em", fontWeight: "600" }],
        h1: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.03em", fontWeight: "600" }],
        h3: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        overlay: "var(--shadow-overlay)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
      },
      // accordion-down/up e collapsible-down/up já vêm do tw-animate-css
      // (importado no globals.css), junto com animate-in/animate-out.
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        // Faixa de pendências: a lista é duplicada, então andar metade da largura fecha o laço
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        // Carta que "cai" na mesa (compras recentes)
        "drop-in": {
          "0%": { opacity: "0", transform: "translateY(-28px) scale(0.92) rotate(-2deg)" },
          "60%": { opacity: "1", transform: "translateY(4px) scale(1.01) rotate(0.5deg)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1) rotate(0)" },
        },
      },
      // Entradas usam fill-mode "backwards": aplicam o estado inicial durante o delay
      // e não deixam transform residual no fim (que quebraria position: fixed nos filhos).
      animation: {
        "fade-in": "fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "fade-out": "fade-out 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards",
        "fade-in-up": "fade-in-up 500ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "fade-in-down": "fade-in-down 200ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "scale-in": "scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        shimmer: "shimmer 2s linear infinite",
        marquee: "marquee 40s linear infinite",
        "drop-in": "drop-in 600ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
      },
    },
  },
} satisfies Config;

export default config;
