"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function BotaoImprimir() {
  return (
    <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
      <Printer /> Imprimir
    </Button>
  );
}
