"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface DialogProps extends Omit<React.ComponentProps<"dialog">, "title" | "open" | "onClose"> {
  open: boolean;
  /** Chamado ao fechar por Esc, pelo X ou pelo clique fora. */
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Botões do rodapé (cancelar à esquerda, ação principal à direita). */
  footer?: React.ReactNode;
}

/**
 * Modal sobre o <dialog> nativo: foco preso, Esc fecha, fundo escurecido.
 *
 * <Dialog open={aberto} onClose={() => setAberto(false)} title="Cancelar agendamento"
 *   footer={<><Button variant="outline" onClick={fechar}>Voltar</Button><Button variant="destructive">Cancelar</Button></>}>
 *   <Field label="Motivo"><Textarea name="motivo" /></Field>
 * </Dialog>
 */
function Dialog({ open, onClose, title, description, footer, className, children, ...props }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-slot="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(evento) => {
        evento.preventDefault();
        onClose();
      }}
      onClick={(evento) => {
        // Clique no fundo (o próprio <dialog>, fora do conteúdo) fecha.
        if (evento.target === evento.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-popover p-0 text-popover-foreground shadow-overlay",
        "backdrop:bg-foreground/40 open:motion-safe:animate-scale-in",
        className,
      )}
      {...props}
    >
      <div className="grid gap-5 p-6">
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 id={titleId} className="text-h3 text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={onClose} className="-mt-1 -mr-2">
            <X />
          </Button>
        </header>

        {children && <div className="grid gap-4">{children}</div>}

        {footer && <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</footer>}
      </div>
    </dialog>
  );
}

export { Dialog, type DialogProps };
