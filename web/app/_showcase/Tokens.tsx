import { Card } from "@/components/ui/Card";

const colorGroups: { title: string; tokens: { name: string; utility: string }[] }[] = [
  {
    title: "Superfícies",
    tokens: [
      { name: "background", utility: "bg-background" },
      { name: "card", utility: "bg-card" },
      { name: "popover", utility: "bg-popover" },
      { name: "secondary", utility: "bg-secondary" },
      { name: "muted", utility: "bg-muted" },
      { name: "accent", utility: "bg-accent" },
    ],
  },
  {
    title: "Texto e ação",
    tokens: [
      { name: "foreground", utility: "text-foreground" },
      { name: "muted-foreground", utility: "text-muted-foreground" },
      { name: "primary", utility: "bg-primary" },
      { name: "brand", utility: "bg-brand / text-brand" },
      { name: "highlight", utility: "bg-highlight" },
      { name: "ring", utility: "outline-ring" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "success", utility: "text-success" },
      { name: "warning", utility: "text-warning" },
      { name: "destructive", utility: "bg-destructive" },
    ],
  },
  {
    title: "Bordas",
    tokens: [
      { name: "border", utility: "border-border" },
      { name: "input", utility: "border-input" },
    ],
  },
  {
    title: "Gráficos (use nesta ordem)",
    tokens: [1, 2, 3, 4, 5].map((n) => ({ name: `chart-${n}`, utility: `bg-chart-${n}` })),
  },
];

/** Amostras ao vivo: as cores mudam junto com o tema. */
export function ColorTokens() {
  return (
    <div className="grid gap-8">
      {colorGroups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-3 text-sm font-medium text-foreground">{group.title}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {group.tokens.map((token) => (
              <li key={token.name} className="min-w-0">
                <div
                  className="h-14 rounded-lg border shadow-xs"
                  style={{ backgroundColor: `var(--${token.name})` }}
                />
                <p className="mt-2 truncate font-mono text-xs font-medium text-foreground">--{token.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{token.utility}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const typeScale = [
  { utility: "text-display", sample: "Construa rápido.", className: "text-display" },
  { utility: "text-h1", sample: "Título da página", className: "text-h1" },
  { utility: "text-h2", sample: "Título de seção", className: "text-h2" },
  { utility: "text-h3", sample: "Título de card", className: "text-h3" },
  {
    utility: "text-base",
    sample: "Corpo de texto em 16px com entrelinha confortável. Mantenha parágrafos em até 65 caracteres por linha.",
    className: "max-w-[65ch] text-base",
  },
  {
    utility: "text-sm text-muted-foreground",
    sample: "Texto secundário para descrições, metadados e legendas.",
    className: "text-sm text-muted-foreground",
  },
  { utility: "font-mono text-[13px]", sample: "npm run dev", className: "font-mono text-[13px]" },
];

export function TypeScale() {
  return (
    <Card className="gap-0 divide-y py-0">
      {typeScale.map((row) => (
        <div key={row.utility} className="grid gap-2 px-6 py-5 md:grid-cols-[220px_1fr] md:items-baseline md:gap-8">
          <p className="font-mono text-xs text-muted-foreground">{row.utility}</p>
          <p className={`min-w-0 text-foreground ${row.className}`}>{row.sample}</p>
        </div>
      ))}
      <div className="grid gap-2 px-6 py-5 md:grid-cols-[220px_1fr] md:items-baseline md:gap-8">
        <p className="font-mono text-xs text-muted-foreground">&lt;kbd&gt;</p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          Exemplo de atalho <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </p>
      </div>
    </Card>
  );
}
