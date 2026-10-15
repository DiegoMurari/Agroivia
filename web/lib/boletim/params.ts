/** Parâmetros do boletim num ponto só. A leitura da tabela `parametro` fica no serviço (B3). */
export const PISO_DIARIA_PADRAO = "90.1731";
export const FATOR_MEIA_PADRAO = "0.5";
export const MAX_CHAPAS_PADRAO = 20;

export interface ParametrosBoletim {
  /** Piso por diária equivalente (texto decimal). */
  piso: string;
  /** Quanto a meia diária conta (texto decimal). */
  fatorMeia: string;
  maxChapas: number;
}

/** Une os padrões com o que veio da tabela `parametro` (chave → valor em texto). */
export function parametrosBoletim(tabela: Record<string, string> = {}): ParametrosBoletim {
  const max = Number.parseInt(tabela.max_chapas_boletim ?? "", 10);
  return {
    piso: tabela.piso_diaria ?? PISO_DIARIA_PADRAO,
    fatorMeia: tabela.fator_meia ?? FATOR_MEIA_PADRAO,
    maxChapas: Number.isSafeInteger(max) && max > 0 ? max : MAX_CHAPAS_PADRAO,
  };
}
