import { CircleCheck, CircleX, Clock, Truck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

/** Selo da situação da descarga, com ícone e texto. */
export function EstadoDaDescarga({ status, pequeno = false }: { status: string; /** Tamanho do selo dos cartões de lista (o padrão é o do detalhe). */ pequeno?: boolean }) {
  const tam = pequeno ? "" : "px-3 py-1 text-sm";
  switch (status) {
    case "agendado":
      return <Badge variant="outline" className={tam}><Clock /> Agendado</Badge>;
    case "chegou":
      return <Badge variant="info" className={tam}><Truck /> Chegou</Badge>;
    case "em_descarga":
      return <Badge variant="info" className={tam}><Truck /> Em descarga</Badge>;
    case "concluido":
      return <Badge variant="success" className={tam}><CircleCheck /> Concluído</Badge>;
    case "nao_recebido":
      return <Badge variant="destructive" className={tam}><CircleX /> Não recebido</Badge>;
    case "cancelado":
      return <Badge variant="outline" className={tam}><CircleX /> Cancelado</Badge>;
    default:
      return <Badge variant="outline" className={tam}>{status}</Badge>;
  }
}
