"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("TabsList, TabsTrigger e TabsContent precisam ficar dentro de <Tabs>.");
  return context;
}

interface TabsProps extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** Aba aberta no início (modo não controlado). */
  defaultValue?: string;
  /** Aba aberta (modo controlado, com onValueChange). */
  value?: string;
  onValueChange?: (value: string) => void;
}

/**
 * <Tabs defaultValue="safra">
 *   <TabsList aria-label="Período">
 *     <TabsTrigger value="safra">Safra</TabsTrigger>
 *     <TabsTrigger value="entressafra">Entressafra</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="safra">...</TabsContent>
 * </Tabs>
 */
function Tabs({ defaultValue = "", value, onValueChange, className, ...props }: TabsProps) {
  const [interno, setInterno] = React.useState(defaultValue);
  const baseId = React.useId();
  const atual = value ?? interno;

  const setValue = React.useCallback(
    (novo: string) => {
      if (value === undefined) setInterno(novo);
      onValueChange?.(novo);
    },
    [value, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: atual, setValue, baseId }}>
      <div data-slot="tabs" className={cn("grid min-w-0 gap-4", className)} {...props} />
    </TabsContext.Provider>
  );
}

function TabsList({ className, onKeyDown, ...props }: React.ComponentProps<"div">) {
  // Setas, Home e End movem o foco entre as abas (padrão ARIA de tabs).
  function navegar(evento: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(evento);
    const abas = Array.from(evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const atual = abas.indexOf(document.activeElement as HTMLButtonElement);
    if (atual < 0) return;
    const destino =
      evento.key === "ArrowRight"
        ? (atual + 1) % abas.length
        : evento.key === "ArrowLeft"
          ? (atual - 1 + abas.length) % abas.length
          : evento.key === "Home"
            ? 0
            : evento.key === "End"
              ? abas.length - 1
              : -1;
    if (destino < 0) return;
    evento.preventDefault();
    abas[destino].focus();
    abas[destino].click();
  }

  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      onKeyDown={navegar}
      className={cn("inline-flex min-w-0 w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1", className)}
      {...props}
    />
  );
}

function TabsTrigger({ value, className, ...props }: React.ComponentProps<"button"> & { value: string }) {
  const tabs = useTabs();
  const ativo = tabs.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${tabs.baseId}-aba-${value}`}
      aria-selected={ativo}
      aria-controls={`${tabs.baseId}-painel-${value}`}
      tabIndex={ativo ? 0 : -1}
      data-slot="tabs-trigger"
      data-state={ativo ? "active" : "inactive"}
      onClick={() => tabs.setValue(value)}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap",
        "transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        ativo ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ value, className, ...props }: React.ComponentProps<"div"> & { value: string }) {
  const tabs = useTabs();
  if (tabs.value !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${tabs.baseId}-painel-${value}`}
      aria-labelledby={`${tabs.baseId}-aba-${value}`}
      tabIndex={0}
      data-slot="tabs-content"
      className={cn("min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
