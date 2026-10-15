import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, CircleHelp, Sun, type LucideIcon } from "lucide-react";

import type { TipoDeTempo } from "@/lib/tempo";
import { cn } from "@/lib/utils";

const ICONES: Record<TipoDeTempo, LucideIcon> = {
  sol: Sun,
  parcial: CloudSun,
  nublado: Cloud,
  neblina: CloudFog,
  chuva: CloudRain,
  tempestade: CloudLightning,
  indefinido: CircleHelp,
};

const COR: Record<TipoDeTempo, string> = {
  sol: "text-warning",
  parcial: "text-warning",
  nublado: "text-muted-foreground",
  neblina: "text-muted-foreground",
  chuva: "text-brand",
  tempestade: "text-brand",
  indefinido: "text-muted-foreground",
};

/** Ícone do tempo, decorativo: o texto ao lado diz a mesma coisa. */
export function ClimaIcone({ tipo, className }: { tipo: TipoDeTempo; className?: string }) {
  const Icone = ICONES[tipo];
  return <Icone aria-hidden="true" className={cn(COR[tipo], className)} />;
}
