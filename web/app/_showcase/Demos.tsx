"use client";

import * as React from "react";
import { Check, CircleCheck, Copy, RotateCcw, Rocket } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/** Ciclo completo de um botão assíncrono: ocioso, carregando e sucesso. */
export function PublishButtonDemo() {
  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");

  React.useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(
      () => setState(state === "loading" ? "done" : "idle"),
      state === "loading" ? 1400 : 1800,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <>
      <Button
        className="min-w-32"
        loading={state === "loading"}
        onClick={() => state === "idle" && setState("loading")}
      >
        {state === "done" ? <Check /> : <Rocket />}
        {state === "idle" ? "Publicar" : state === "loading" ? "Publicando" : "Publicado"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {state === "done" ? "Projeto publicado" : ""}
      </span>
    </>
  );
}

/** Botão de copiar com confirmação visual. */
export function CopyButton({ value, label = "Copiar comando" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Sem permissão de clipboard: o comando continua visível para copiar à mão.
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={copied ? "Copiado" : label}>
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}

type ProjectErrors = Partial<Record<"name" | "email", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formulário com validação no envio, erros inline e foco no primeiro campo inválido. */
export function ProjectFormDemo() {
  const [errors, setErrors] = React.useState<ProjectErrors>({});
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");

  React.useEffect(() => {
    if (status !== "sending") return;
    const timer = window.setTimeout(() => setStatus("sent"), 1200);
    return () => window.clearTimeout(timer);
  }, [status]);

  function clearError(field: keyof ProjectErrors) {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();

    const nextErrors: ProjectErrors = {};
    if (!name) nextErrors.name = "Informe o nome do projeto.";
    if (!EMAIL_PATTERN.test(email)) nextErrors.email = "Use um e-mail válido, como time@exemplo.com.";
    setErrors(nextErrors);

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      const control = form.elements.namedItem(firstInvalid);
      if (control instanceof HTMLElement) control.focus();
      setStatus("idle");
      return;
    }

    setStatus("sending");
    form.reset();
  }

  return (
    <Card asChild>
      <form noValidate onSubmit={handleSubmit} aria-labelledby="project-form-title">
        <CardHeader>
          <CardTitle id="project-form-title">Enviar projeto</CardTitle>
          <CardDescription>Envie vazio para ver os erros e o foco indo para o primeiro campo.</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-5">
          <Field label="Nome do projeto" required error={errors.name}>
            <Input name="name" placeholder="Ex.: Radar de Enchentes" autoComplete="off" onChange={() => clearError("name")} />
          </Field>
          <Field
            label="E-mail do time"
            required
            error={errors.email}
            description="A confirmação chega neste endereço."
          >
            <Input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="time@exemplo.com"
              onChange={() => clearError("email")}
            />
          </Field>
          <Field label="Descrição" description="Uma frase sobre o problema que o projeto resolve.">
            <Textarea name="description" rows={3} placeholder="Alertas de enchente por bairro, em tempo real." />
          </Field>
        </CardContent>

        <CardFooter className="justify-between border-t">
          <p aria-live="polite" className="flex items-center gap-1.5 text-[13px] font-medium text-success">
            {status === "sent" && (
              <>
                <CircleCheck className="size-4" />
                Projeto enviado.
              </>
            )}
          </p>
          <Button type="submit" loading={status === "sending"}>
            Enviar projeto
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const entrances = ["fade-in", "fade-in-up", "fade-in-down", "scale-in"] as const;

const entranceClass: Record<(typeof entrances)[number], string> = {
  "fade-in": "animate-fade-in",
  "fade-in-up": "animate-fade-in-up",
  "fade-in-down": "animate-fade-in-down",
  "scale-in": "animate-scale-in",
};

/** Animações de entrada do tema + skeleton de carregamento. */
export function MotionDemo() {
  const [run, setRun] = React.useState(0);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <p className="text-sm text-muted-foreground">Entradas com ease-out-expo, em cascata de 80 ms.</p>
        <Button variant="outline" size="sm" onClick={() => setRun((count) => count + 1)}>
          <RotateCcw />
          Reproduzir
        </Button>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {entrances.map((name, index) => (
          <div
            key={`${name}-${run}`}
            className={cn(
              "grid h-24 place-items-center rounded-lg border bg-muted/50 font-mono text-xs text-muted-foreground",
              entranceClass[name],
            )}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            animate-{name}
          </div>
        ))}
      </div>

      <div className="border-t px-6 py-5">
        <p className="mb-3 text-sm font-medium text-foreground">Carregando</p>
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="skeleton size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-2/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
        </div>
      </div>
    </Card>
  );
}
