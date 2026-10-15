import type { Db } from "@/lib/db";
import { relatorioChegadas, type RelatorioChegadas } from "./chegadas";
import { alertasEquipamento, type AlertaEquipamento } from "./equipamento";
import { resumoDoDia, type ResumoDoDia } from "./resumo";
import { previsaoDoDia, type Previsao } from "./previsao";
import { situacaoDoDia, type SituacaoDia } from "./servico";

export type DadosDia = SituacaoDia & { previsao: Previsao | null; alertasEquipamento: AlertaEquipamento[]; chegadas: RelatorioChegadas; resumo: ResumoDoDia };

/** Tudo da tela do dia num pedido só (page e GET /api/dia). Só leitura; a previsão grava só no próprio cache. */
export async function dadosDoDia(db: Db, agoraISO: string): Promise<DadosDia> {
  const situacao = situacaoDoDia(db, agoraISO);
  return {
    ...situacao,
    previsao: await previsaoDoDia(db, situacao.hoje, agoraISO),
    alertasEquipamento: alertasEquipamento(db, situacao.hoje),
    chegadas: relatorioChegadas(db, situacao.hoje, agoraISO),
    resumo: resumoDoDia(db, situacao.hoje),
  };
}
