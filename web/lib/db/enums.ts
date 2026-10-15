/**
 * Enumerações do DER (docs/DER.md) como constantes e tipos. TypeScript puro, sem banco.
 * Uso com zod: `z.enum(AGENDAMENTO_STATUS)`.
 * As marcadas "sem CHECK" não têm restrição no banco: a validação é só a do zod.
 */

export const ORIGEM = ["historico", "teste", "operacao"] as const;
export type Origem = (typeof ORIGEM)[number];

// Agendamento (Tarefa 1)

export const AGENDAMENTO_STATUS = ["agendado", "chegou", "em_descarga", "concluido", "cancelado", "nao_recebido"] as const;
export type AgendamentoStatus = (typeof AGENDAMENTO_STATUS)[number];

/** Acondicionamento para a ocupação do horário: unitizado = paletizado ou big bag. */
export const ACONDICIONAMENTO_OCUPACAO = ["batido", "unitizado"] as const;
export type AcondicionamentoOcupacao = (typeof ACONDICIONAMENTO_OCUPACAO)[number];

export const VALIDACAO_STATUS = ["aguardando", "conforme", "divergente"] as const;
export type ValidacaoStatus = (typeof VALIDACAO_STATUS)[number];

/** Sem CHECK. Na coluna, nulo quando não há exceção. */
export const EXCECAO_OCUPACAO = ["caso_fortuito", "prioridade"] as const;
export type ExcecaoOcupacao = (typeof EXCECAO_OCUPACAO)[number];

/** Acondicionamento por NF (`agendamento_nf.acondicionamento`). */
export const ACONDICIONAMENTO_NF = ["batido", "paletizado", "big_bag"] as const;
export type AcondicionamentoNf = (typeof ACONDICIONAMENTO_NF)[number];

/** Sem CHECK. */
export const FORMA_ENTRADA_NF = ["xml", "manual"] as const;
export type FormaEntradaNf = (typeof FORMA_ENTRADA_NF)[number];

export const COMPRA_STATUS = ["criada", "confirmada", "cancelada"] as const;
export type CompraStatus = (typeof COMPRA_STATUS)[number];

export const PENDENCIA_TIPO = ["divergencia_nf_pedido", "outra"] as const;
export type PendenciaTipo = (typeof PENDENCIA_TIPO)[number];

export const PENDENCIA_STATUS = ["aberta", "resolvida"] as const;
export type PendenciaStatus = (typeof PENDENCIA_STATUS)[number];

export const NAO_RECEBIMENTO_MOTIVO = [
  "divergencia_nota_pedido",
  "sem_agendamento_sem_vaga",
  "caso_fortuito",
  "outro",
] as const;
export type NaoRecebimentoMotivo = (typeof NAO_RECEBIMENTO_MOTIVO)[number];

/** Sem CHECK. */
export const AVISO_DESTINATARIO = ["fornecedor", "responsavel", "compras", "portaria", "prestador"] as const;
export type AvisoDestinatario = (typeof AVISO_DESTINATARIO)[number];

/** Sem CHECK; valores iniciais. */
export const EVENTO_TIPO = [
  "agendado",
  "validado",
  "autorizado",
  "destino_definido",
  "chegou",
  "entrada",
  "saida",
  "concluido",
  "desfeito",
  "cancelado",
  "remarcado",
  "atraso",
  "nao_recebido",
  "pendencia_aberta",
  "pendencia_resolvida",
  "vaga_ocupada",
] as const;
export type EventoTipo = (typeof EVENTO_TIPO)[number];

// Cadastros

/** Sem CHECK. */
export const USUARIO_PAPEL = ["fornecedor", "compras", "portaria", "responsavel", "direcao"] as const;
export type UsuarioPapel = (typeof USUARIO_PAPEL)[number];

export const TIPO_ITEM_CATEGORIA = ["item", "diaria"] as const;
export type TipoItemCategoria = (typeof TIPO_ITEM_CATEGORIA)[number];

/** Sem CHECK (a calibração do painel pode pedir outro valor, D29). */
export const CONVERSAO_PRODUCAO = ["saca_50kg", "unidade"] as const;
export type ConversaoProducao = (typeof CONVERSAO_PRODUCAO)[number];

export const NORMA_ACONDICIONAMENTO = ["batido", "paletizado", "big_bag", "maquina"] as const;
export type NormaAcondicionamento = (typeof NORMA_ACONDICIONAMENTO)[number];

export const NORMA_PERFIL = ["agrovia", "dossie"] as const;
export type NormaPerfil = (typeof NORMA_PERFIL)[number];

// Boletim (Tarefa 2)

export const TIPO_DIARIA = ["completa", "meia"] as const;
export type TipoDiaria = (typeof TIPO_DIARIA)[number];

export const BOLETIM_STATUS = ["rascunho", "fechado"] as const;
export type BoletimStatus = (typeof BOLETIM_STATUS)[number];

// Histórico (Tarefa 3)

export const PERIODO_SEM_DADO_TIPO = ["sem_dado", "parcial"] as const;
export type PeriodoSemDadoTipo = (typeof PERIODO_SEM_DADO_TIPO)[number];

/** Chaves da tabela `parametro` gravadas pelo seed fixo. */
export const PARAMETRO_CHAVE = [
  "piso_diaria",
  "fator_meia",
  "max_chapas_boletim",
  "tolerancia_min",
  "limite_peso_chapa_kg",
  "capacidade_unitizado",
  "jornada_h",
  "safra_meses",
  "perfil_norma",
  "dias_minimos_mes",
] as const;
export type ParametroChave = (typeof PARAMETRO_CHAVE)[number];

// Login, cadastro de fornecedor e aprovações (D49)

/** Sem CHECK. Adm Master é Compras com a gestão de usuários. */
/** `portaria` e `armazem` (gestor de armazém) entraram na D53: conferem a nota fiscal na chegada. */
export const USUARIO_PERFIL = ["adm_master", "compras", "fornecedor", "portaria", "armazem"] as const;
export type UsuarioPerfil = (typeof USUARIO_PERFIL)[number];

export const CADASTRO_STATUS = ["pendente", "aprovado", "recusado"] as const;
export type CadastroStatus = (typeof CADASTRO_STATUS)[number];

/** Sem CHECK. `aguardando` reserva a vaga; `recusado` e `rascunho` não ocupam horário. */
export const PEDIDO_APROVACAO = ["rascunho", "aguardando", "aprovado", "recusado"] as const;
export type PedidoAprovacao = (typeof PEDIDO_APROVACAO)[number];

export const APROVACAO_ALVO = ["cadastro", "pedido"] as const;
export type AprovacaoAlvo = (typeof APROVACAO_ALVO)[number];

export const APROVACAO_DECISAO = ["aprovado", "recusado"] as const;
export type AprovacaoDecisao = (typeof APROVACAO_DECISAO)[number];

/** Sem CHECK. */
export const EQUIPAMENTO_STATUS = ["operacional", "manutencao"] as const;
export type EquipamentoStatus = (typeof EQUIPAMENTO_STATUS)[number];
