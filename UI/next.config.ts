import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O indicador de dev fica no canto inferior esquerdo por padrão,
  // em cima do botão de recolher da Sidebar.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
