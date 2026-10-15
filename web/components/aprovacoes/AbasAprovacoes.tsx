"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

/** As abas da página de Aprovações; o conteúdo vem pronto do servidor. */
export function AbasAprovacoes({
  cadastros,
  pedidos,
  historico,
  totalCadastros,
  totalPedidos,
}: {
  cadastros: ReactNode;
  pedidos: ReactNode;
  historico: ReactNode;
  totalCadastros: number;
  totalPedidos: number;
}) {
  return (
    <Tabs defaultValue={totalCadastros === 0 && totalPedidos > 0 ? "pedidos" : "cadastros"}>
      <TabsList aria-label="Tipo de aprovação">
        <TabsTrigger value="cadastros">Fornecedores{totalCadastros > 0 ? ` (${totalCadastros})` : ""}</TabsTrigger>
        <TabsTrigger value="pedidos">Pedidos{totalPedidos > 0 ? ` (${totalPedidos})` : ""}</TabsTrigger>
        <TabsTrigger value="historico">Quem aprovou</TabsTrigger>
      </TabsList>
      <TabsContent value="cadastros" className="pt-4">
        {cadastros}
      </TabsContent>
      <TabsContent value="pedidos" className="pt-4">
        {pedidos}
      </TabsContent>
      <TabsContent value="historico" className="pt-4">
        {historico}
      </TabsContent>
    </Tabs>
  );
}
