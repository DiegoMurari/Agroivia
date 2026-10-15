// Renderização dinâmica: as telas do módulo leem o banco a cada pedido.
// Sem isto o `next build` pré-renderiza e o `next start` mostra dado velho. Não remover.
export const dynamic = "force-dynamic";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
