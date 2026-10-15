import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Estilos compartilhados por Input e Textarea. */
const controlBase = [
  "w-full min-w-0 rounded-md border border-input bg-card text-foreground shadow-xs dark:bg-input/30",
  "transition-[color,border-color,box-shadow] duration-150 ease-out",
  "placeholder:text-muted-foreground",
  "enabled:hover:border-muted-foreground/40",
  // Foco: borda na cor do anel + halo suave (visível também em alto contraste)
  "focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/25",
  // Erro: use aria-invalid (o <Field error> já aplica automaticamente)
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
];

const inputVariants = cva(
  [
    ...controlBase,
    "flex",
    "file:mr-3 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  ],
  {
    variants: {
      // text-base no mobile evita o zoom automático do iOS ao focar
      size: {
        sm: "h-8 px-2.5 text-base sm:text-[13px]",
        md: "h-9 px-3 text-base sm:text-sm",
        lg: "h-11 px-3.5 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

function Input({ className, type = "text", size, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        controlBase,
        "field-sizing-content min-h-24 resize-y px-3 py-2 text-base sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "inline-flex items-center gap-1 text-sm leading-none font-medium text-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

type FieldControlProps = {
  id?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-required"?: React.AriaAttributes["aria-required"];
};

interface FieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** Texto de ajuda abaixo do campo. Some quando há erro. */
  description?: React.ReactNode;
  /** Mensagem de erro. Marca o campo como inválido e é anunciada por leitores de tela. */
  error?: React.ReactNode;
  /** Mostra o asterisco e marca aria-required. */
  required?: boolean;
  /** Um único controle: <Input />, <Textarea /> ou similar. */
  children: React.ReactElement<FieldControlProps>;
}

/**
 * Label + controle + ajuda/erro, com ids e atributos ARIA ligados automaticamente.
 *
 * <Field label="E-mail" description="Usado só para login" error={errors.email}>
 *   <Input type="email" name="email" />
 * </Field>
 */
function Field({ label, description, error, required, children, className, ...props }: FieldProps) {
  const generatedId = React.useId();
  const controlId = children.props.id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const hasError = Boolean(error);
  const hint = hasError ? error : description;
  const describedBy =
    [children.props["aria-describedby"], hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div
      data-slot="field"
      data-disabled={children.props.disabled || undefined}
      className={cn("group/field grid gap-2", className)}
      {...props}
    >
      <Label htmlFor={controlId} className="group-data-disabled/field:opacity-50">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>

      {React.cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": hasError || children.props["aria-invalid"],
        "aria-required": required || children.props["aria-required"],
      })}

      {hasError ? (
        <p id={hintId} role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-destructive">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : description ? (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export { Field, Input, inputVariants, Label, Textarea, type InputProps };
