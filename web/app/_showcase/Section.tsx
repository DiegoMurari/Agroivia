import { cn } from "@/lib/utils";

/** Seção do style guide: título + descrição empilhados, conteúdo abaixo. */
export function Section({
  id,
  title,
  description,
  className,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={className}>
      <div className="mb-6 max-w-2xl space-y-1.5">
        <h2 id={`${id}-title`} className="text-h2 text-brand">
          {title}
        </h2>
        {description && <p className="text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Linha de amostra: rótulo + exemplo de código à esquerda, componentes à direita. */
export function Specimen({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 px-6 py-5 md:grid-cols-[200px_1fr] md:items-center md:gap-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="font-mono text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}

/** Código inline dentro de textos corridos. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1 py-px font-mono text-[0.85em] whitespace-nowrap text-foreground">
      {children}
    </code>
  );
}
