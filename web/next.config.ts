import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cada janela tem a própria pasta de build (dev:s1 → .next-s1 ...). A demo usa .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // O indicador de dev fica no canto inferior esquerdo por padrão,
  // em cima do botão de recolher da Sidebar.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
