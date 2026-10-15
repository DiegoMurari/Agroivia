import { sql } from "drizzle-orm";
import { blob, check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  ACONDICIONAMENTO_NF,
  APROVACAO_ALVO,
  APROVACAO_DECISAO,
  CADASTRO_STATUS,
  ACONDICIONAMENTO_OCUPACAO,
  AGENDAMENTO_STATUS,
  BOLETIM_STATUS,
  COMPRA_STATUS,
  NAO_RECEBIMENTO_MOTIVO,
  NORMA_ACONDICIONAMENTO,
  NORMA_PERFIL,
  ORIGEM,
  PENDENCIA_STATUS,
  PENDENCIA_TIPO,
  PERIODO_SEM_DADO_TIPO,
  TIPO_DIARIA,
  TIPO_ITEM_CATEGORIA,
  VALIDACAO_STATUS,
} from "./enums";

/**
 * Schema do banco: espelho de docs/DER.md (contrato congelado).
 * Dinheiro, peso e quantidade com casas: TEXT decimal. Datas e instantes: TEXT, gravados pelo código.
 * `text({ enum })` só tipa: cada CHECK é explícito (emLista). Chaves estrangeiras com ON DELETE RESTRICT.
 */

const id = () => integer("id").primaryKey({ autoIncrement: true });
const restrito = { onDelete: "restrict" } as const;

/** CHECK de enumeração: `coluna IN ('a', 'b')`. Coluna nula passa (o NOT NULL é à parte). */
function emLista(nome: string, coluna: string, valores: readonly string[]) {
  return check(nome, sql.raw(`"${coluna}" IN (${valores.map((v) => `'${v}'`).join(", ")})`));
}

// ───────────────────────── Diagrama 1: cadastros e configuração ─────────────────────────

export const armazem = sqliteTable(
  "armazem",
  {
    id: id(),
    nome: text("nome").notNull(),
    localFisico: text("local_fisico"),
    fazBoletim: integer("faz_boletim", { mode: "boolean" }).notNull().default(true),
    // Destino possível de descarga (D47). "Todas as áreas" existe só para o boletim único
    recebeDescarga: integer("recebe_descarga", { mode: "boolean" }).notNull().default(true),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [uniqueIndex("armazem_nome_uk").on(t.nome)],
);

export const tipoItem = sqliteTable(
  "tipo_item",
  {
    id: id(),
    nome: text("nome").notNull(),
    precoUnitario: text("preco_unitario").notNull(),
    categoria: text("categoria", { enum: TIPO_ITEM_CATEGORIA }).notNull().default("item"),
    ordem: integer("ordem").notNull().default(0),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("tipo_item_nome_uk").on(t.nome), emLista("tipo_item_categoria_ck", "categoria", TIPO_ITEM_CATEGORIA)],
);

export const grupoProduto = sqliteTable("grupo_produto", {
  grupo: text("grupo").primaryKey(),
  descricao: text("descricao"),
  armazemId: integer("armazem_id").references(() => armazem.id, restrito),
  tipoItemId: integer("tipo_item_id").references(() => tipoItem.id, restrito),
  /** Sem CHECK: `saca_50kg`, `unidade` (enums.CONVERSAO_PRODUCAO). */
  conversaoProducao: text("conversao_producao"),
});

export const depositoArmazem = sqliteTable("deposito_armazem", {
  deposito: text("deposito").primaryKey(),
  armazemId: integer("armazem_id").references(() => armazem.id, restrito),
  recebeDireto: integer("recebe_direto", { mode: "boolean" }).notNull().default(true),
});

export const produto = sqliteTable(
  "produto",
  {
    id: id(),
    item: text("item").notNull(),
    descricao: text("descricao"),
    unidade: text("unidade"),
    pesoUnitarioKg: text("peso_unitario_kg"),
    subgrupo: text("subgrupo"),
    grupo: text("grupo"),
    /** Texto vazio quando faltar (NULL não entra em índice único). */
    deposito: text("deposito").notNull().default(""),
    armazemId: integer("armazem_id").references(() => armazem.id, restrito),
  },
  (t) => [uniqueIndex("produto_item_deposito_uk").on(t.item, t.deposito), index("produto_grupo_ix").on(t.grupo)],
);

export const fornecedor = sqliteTable(
  "fornecedor",
  {
    id: id(),
    codigo: text("codigo"),
    razaoSocial: text("razao_social").notNull(),
    cnpj: text("cnpj"),
    origem: text("origem", { enum: ORIGEM }).notNull(),
  },
  (t) => [
    uniqueIndex("fornecedor_codigo_uk").on(t.codigo),
    index("fornecedor_cnpj_ix").on(t.cnpj),
    emLista("fornecedor_origem_ck", "origem", ORIGEM),
  ],
);

export const equipamento = sqliteTable("equipamento", {
  id: id(),
  armazemId: integer("armazem_id")
    .notNull()
    .references(() => armazem.id, restrito),
  nome: text("nome"),
  finalidade: text("finalidade"),
  quantidade: integer("quantidade").notNull().default(1),
  /** Quantos estão disponíveis, de 0 a `quantidade`. */
  disponivel: integer("disponivel").notNull().default(1),
  indisponivelMotivo: text("indisponivel_motivo"),
  /** Sem CHECK (enums.EQUIPAMENTO_STATUS): operacional ou manutencao. */
  status: text("status").notNull().default("operacional"),
});

export const chapa = sqliteTable(
  "chapa",
  {
    id: id(),
    matricula: text("matricula").notNull(),
    nome: text("nome").notNull(),
    armazemId: integer("armazem_id").references(() => armazem.id, restrito),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("chapa_matricula_uk").on(t.matricula)],
);

export const horarioGrade = sqliteTable(
  "horario_grade",
  {
    id: id(),
    hora: text("hora").notNull(),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [uniqueIndex("horario_grade_hora_uk").on(t.hora)],
);

export const feriado = sqliteTable("feriado", {
  data: text("data").primaryKey(),
  nome: text("nome"),
});

export const parametro = sqliteTable("parametro", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull(),
  descricao: text("descricao"),
});

export const usuario = sqliteTable("usuario", {
  id: id(),
  nome: text("nome"),
  /** Sem CHECK (enums.USUARIO_PAPEL). */
  papel: text("papel").notNull(),
  armazemId: integer("armazem_id").references(() => armazem.id, restrito),
  fornecedorId: integer("fornecedor_id").references(() => fornecedor.id, restrito),
  // Login (D49). Linhas sem e-mail são os papéis antigos do seletor e não entram no sistema.
  email: text("email"),
  /** scrypt: `salt:hash`, em hexadecimal (lib/auth). */
  senhaHash: text("senha_hash"),
  /** Sem CHECK (enums.USUARIO_PERFIL): adm_master, compras, fornecedor. */
  perfil: text("perfil"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  /** Senha temporária ou convite: obriga a definir a senha no primeiro acesso. */
  trocarSenha: integer("trocar_senha", { mode: "boolean" }).notNull().default(false),
  /** Token de convite ou de recuperação de senha, de uso único. */
  tokenSenha: text("token_senha"),
  tokenSenhaExpira: text("token_senha_expira"),
  criadoEm: text("criado_em"),
}, (t) => [uniqueIndex("usuario_email_uk").on(t.email), uniqueIndex("usuario_token_senha_uk").on(t.tokenSenha)]);

/** Convite que Compras envia ao fornecedor: leva ao formulário de cadastro (D49). */
export const conviteFornecedor = sqliteTable(
  "convite_fornecedor",
  {
    id: id(),
    token: text("token").notNull(),
    email: text("email"),
    criadoPor: integer("criado_por").references(() => usuario.id, restrito),
    criadoEm: text("criado_em").notNull(),
    usadoEm: text("usado_em"),
  },
  (t) => [uniqueIndex("convite_fornecedor_token_uk").on(t.token)],
);

/** Cadastro B2B do fornecedor. Só `aprovado` acessa o portal; alteração fica em `alteracao_pendente` até Compras aprovar. */
export const fornecedorCadastro = sqliteTable(
  "fornecedor_cadastro",
  {
    id: id(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuario.id, restrito),
    /** Ligação com o cadastro de fornecedores do pacote, quando o CNPJ casa. */
    fornecedorId: integer("fornecedor_id").references(() => fornecedor.id, restrito),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia"),
    cnpj: text("cnpj").notNull(),
    inscricaoEstadual: text("inscricao_estadual"),
    email: text("email").notNull(),
    telefone: text("telefone"),
    responsavel: text("responsavel"),
    endereco: text("endereco"),
    /** JSON: lista de tipos de mercadoria. */
    tiposMercadoria: text("tipos_mercadoria"),
    status: text("status", { enum: CADASTRO_STATUS }).notNull().default("pendente"),
    /** JSON com os dados novos à espera de aprovação; os atuais continuam valendo. */
    alteracaoPendente: text("alteracao_pendente"),
    motivoRecusa: text("motivo_recusa"),
    decididoPor: integer("decidido_por").references(() => usuario.id, restrito),
    decididoEm: text("decidido_em"),
    criadoEm: text("criado_em").notNull(),
  },
  (t) => [
    uniqueIndex("fornecedor_cadastro_usuario_uk").on(t.usuarioId),
    uniqueIndex("fornecedor_cadastro_cnpj_uk").on(t.cnpj),
    emLista("fornecedor_cadastro_status_ck", "status", CADASTRO_STATUS),
  ],
);

export const notificacao = sqliteTable(
  "notificacao",
  {
    id: id(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuario.id, restrito),
    /** Sem CHECK: cadastro_aprovado, cadastro_recusado, pedido_aprovado, pedido_recusado, outra. */
    tipo: text("tipo").notNull(),
    mensagem: text("mensagem").notNull(),
    link: text("link"),
    lida: integer("lida", { mode: "boolean" }).notNull().default(false),
    criadoEm: text("criado_em").notNull(),
  },
  (t) => [index("notificacao_usuario_ix").on(t.usuarioId, t.lida)],
);

/** Quem aprovou ou recusou cada cadastro e cada pedido. Só inclusão. */
export const logAprovacao = sqliteTable(
  "log_aprovacao",
  {
    id: id(),
    alvo: text("alvo", { enum: APROVACAO_ALVO }).notNull(),
    alvoId: integer("alvo_id").notNull(),
    decisao: text("decisao", { enum: APROVACAO_DECISAO }).notNull(),
    comentario: text("comentario"),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuario.id, restrito),
    criadoEm: text("criado_em").notNull(),
  },
  (t) => [
    index("log_aprovacao_alvo_ix").on(t.alvo, t.alvoId),
    emLista("log_aprovacao_alvo_ck", "alvo", APROVACAO_ALVO),
    emLista("log_aprovacao_decisao_ck", "decisao", APROVACAO_DECISAO),
  ],
);

export const normaChapas = sqliteTable(
  "norma_chapas",
  {
    id: id(),
    perfil: text("perfil", { enum: NORMA_PERFIL }).notNull(),
    acondicionamento: text("acondicionamento", { enum: NORMA_ACONDICIONAMENTO }).notNull(),
    /** Vale acima deste peso (estritamente maior). */
    pesoMinKgExclusivo: text("peso_min_kg_exclusivo"),
    chapas: integer("chapas").notNull().default(0),
    empilhadeira: integer("empilhadeira", { mode: "boolean" }).notNull().default(false),
    duracaoMin: integer("duracao_min"),
  },
  () => [
    emLista("norma_chapas_perfil_ck", "perfil", NORMA_PERFIL),
    emLista("norma_chapas_acondicionamento_ck", "acondicionamento", NORMA_ACONDICIONAMENTO),
  ],
);

// ───────────────────────── Diagrama 2: agendamento (Tarefa 1) ─────────────────────────

export const compra = sqliteTable(
  "compra",
  {
    id: id(),
    fornecedorId: integer("fornecedor_id")
      .notNull()
      .references(() => fornecedor.id, restrito),
    numeroPedido: text("numero_pedido"),
    descricao: text("descricao"),
    token: text("token").notNull(),
    status: text("status", { enum: COMPRA_STATUS }).notNull().default("criada"),
    criadaPor: text("criada_por"),
    criadaEm: text("criada_em").notNull(),
    preenchidaEm: text("preenchida_em"),
    origem: text("origem", { enum: ORIGEM }).notNull(),
  },
  (t) => [
    uniqueIndex("compra_token_uk").on(t.token),
    emLista("compra_status_ck", "status", COMPRA_STATUS),
    emLista("compra_origem_ck", "origem", ORIGEM),
  ],
);

export const compraItem = sqliteTable(
  "compra_item",
  {
    id: id(),
    compraId: integer("compra_id")
      .notNull()
      .references(() => compra.id, restrito),
    produtoId: integer("produto_id").references(() => produto.id, restrito),
    descricao: text("descricao"),
    quantidade: text("quantidade"),
    unidade: text("unidade"),
    pesoKg: text("peso_kg"),
  },
  (t) => [index("compra_item_compra_ix").on(t.compraId)],
);

export const agendamento = sqliteTable(
  "agendamento",
  {
    id: id(),
    compraId: integer("compra_id").references(() => compra.id, restrito),
    fornecedorId: integer("fornecedor_id")
      .notNull()
      .references(() => fornecedor.id, restrito),
    data: text("data").notNull(),
    horario: text("horario").notNull(),
    placa: text("placa"),
    transportadora: text("transportadora"),
    motorista: text("motorista"),
    /** Derivada das NF, gravada junto com elas (batido se qualquer NF for batida). */
    acondicionamentoOcupacao: text("acondicionamento_ocupacao", { enum: ACONDICIONAMENTO_OCUPACAO }).notNull(),
    pesoDeclaradoKg: text("peso_declarado_kg"),
    pesoBalancaKg: text("peso_balanca_kg"),
    status: text("status", { enum: AGENDAMENTO_STATUS }).notNull().default("agendado"),
    agendadoNaHora: integer("agendado_na_hora", { mode: "boolean" }).notNull().default(false),
    validacaoStatus: text("validacao_status", { enum: VALIDACAO_STATUS }).notNull().default("aguardando"),
    validacaoObs: text("validacao_obs"),
    validadoPor: text("validado_por"),
    validadoEm: text("validado_em"),
    autorizadoPor: text("autorizado_por"),
    autorizadoEm: text("autorizado_em"),
    chegadaEm: text("chegada_em"),
    /** Derivada: a última saída dos armazéns. */
    liberacaoEm: text("liberacao_em"),
    prioridade: integer("prioridade", { mode: "boolean" }).notNull().default(false),
    /** Sem CHECK: nulo, `caso_fortuito`, `prioridade` (enums.EXCECAO_OCUPACAO). */
    excecaoOcupacao: text("excecao_ocupacao"),
    excecaoMotivo: text("excecao_motivo"),
    /** Aprovação de Compras (D49). Sem CHECK (enums.PEDIDO_APROVACAO). O link direto e a portaria já nascem `aprovado`. */
    aprovacao: text("aprovacao").notNull().default("aprovado"),
    recusaComentario: text("recusa_comentario"),
    aprovacaoPor: integer("aprovacao_por").references(() => usuario.id, restrito),
    aprovacaoEm: text("aprovacao_em"),
    /** Usuário fornecedor que criou o pedido pelo portal. */
    criadoPorUsuarioId: integer("criado_por_usuario_id").references(() => usuario.id, restrito),
    remarcacoes: integer("remarcacoes").notNull().default(0),
    motivoCancelamento: text("motivo_cancelamento"),
    canceladoPor: text("cancelado_por"),
    canceladoEm: text("cancelado_em"),
    chapasPrevistas: integer("chapas_previstas"),
    empilhadeiraPrevista: integer("empilhadeira_prevista", { mode: "boolean" }),
    duracaoPrevistaMin: integer("duracao_prevista_min"),
    observacao: text("observacao"),
    /** JSON, reserva dos grupos 4 e 6. */
    extra: text("extra"),
    origem: text("origem", { enum: ORIGEM }).notNull(),
    criadoEm: text("criado_em").notNull(),
    atualizadoEm: text("atualizado_em"),
  },
  (t) => [
    index("agendamento_data_horario_ix").on(t.data, t.horario),
    index("agendamento_status_ix").on(t.status),
    index("agendamento_compra_ix").on(t.compraId),
    emLista("agendamento_status_ck", "status", AGENDAMENTO_STATUS),
    emLista("agendamento_acond_ocupacao_ck", "acondicionamento_ocupacao", ACONDICIONAMENTO_OCUPACAO),
    emLista("agendamento_validacao_status_ck", "validacao_status", VALIDACAO_STATUS),
    emLista("agendamento_origem_ck", "origem", ORIGEM),
  ],
);

export const notaFiscal = sqliteTable(
  "nota_fiscal",
  {
    id: id(),
    chaveAcesso: text("chave_acesso").notNull(),
    numero: text("numero"),
    serie: text("serie"),
    emitenteCnpj: text("emitente_cnpj"),
    emitenteNome: text("emitente_nome"),
    fornecedorId: integer("fornecedor_id").references(() => fornecedor.id, restrito),
    emitidaEm: text("emitida_em"),
    valorTotal: text("valor_total"),
    pesoBrutoKg: text("peso_bruto_kg"),
    pesoLiquidoKg: text("peso_liquido_kg"),
    volumes: text("volumes"),
    especie: text("especie"),
    placa: text("placa"),
    transportadora: text("transportadora"),
    pedidoFornecedor: text("pedido_fornecedor"),
    /** Sem CHECK: `xml`, `manual` (enums.FORMA_ENTRADA_NF). */
    formaEntrada: text("forma_entrada").notNull().default("xml"),
    origem: text("origem", { enum: ORIGEM }).notNull(),
    criadaEm: text("criada_em").notNull(),
  },
  (t) => [uniqueIndex("nota_fiscal_chave_uk").on(t.chaveAcesso), emLista("nota_fiscal_origem_ck", "origem", ORIGEM)],
);

export const notaFiscalItem = sqliteTable(
  "nota_fiscal_item",
  {
    id: id(),
    notaFiscalId: integer("nota_fiscal_id")
      .notNull()
      .references(() => notaFiscal.id, restrito),
    codigoFornecedor: text("codigo_fornecedor"),
    descricao: text("descricao"),
    quantidade: text("quantidade"),
    unidade: text("unidade"),
    valorUnitario: text("valor_unitario"),
    produtoId: integer("produto_id").references(() => produto.id, restrito),
  },
  (t) => [index("nota_fiscal_item_nf_ix").on(t.notaFiscalId)],
);

export const notaFiscalArquivo = sqliteTable(
  "nota_fiscal_arquivo",
  {
    id: id(),
    notaFiscalId: integer("nota_fiscal_id")
      .notNull()
      .references(() => notaFiscal.id, restrito),
    nome: text("nome"),
    tipoMime: text("tipo_mime"),
    tamanhoBytes: integer("tamanho_bytes"),
    /** BLOB: fica fora das listagens, só é lido no download. */
    conteudo: blob("conteudo", { mode: "buffer" }),
    criadoEm: text("criado_em").notNull(),
  },
  (t) => [index("nota_fiscal_arquivo_nf_ix").on(t.notaFiscalId)],
);

export const agendamentoNf = sqliteTable(
  "agendamento_nf",
  {
    agendamentoId: integer("agendamento_id")
      .notNull()
      .references(() => agendamento.id, restrito),
    notaFiscalId: integer("nota_fiscal_id")
      .notNull()
      .references(() => notaFiscal.id, restrito),
    acondicionamento: text("acondicionamento", { enum: ACONDICIONAMENTO_NF }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.agendamentoId, t.notaFiscalId] }),
    index("agendamento_nf_nf_ix").on(t.notaFiscalId),
    emLista("agendamento_nf_acondicionamento_ck", "acondicionamento", ACONDICIONAMENTO_NF),
  ],
);

export const agendamentoArmazem = sqliteTable(
  "agendamento_armazem",
  {
    id: id(),
    agendamentoId: integer("agendamento_id")
      .notNull()
      .references(() => agendamento.id, restrito),
    armazemId: integer("armazem_id")
      .notNull()
      .references(() => armazem.id, restrito),
    ordem: integer("ordem").notNull().default(0),
    entradaEm: text("entrada_em"),
    saidaEm: text("saida_em"),
    /** Chapas neste armazém. Não soma no dia (o efetivo do dia vem do boletim). */
    chapasQtd: integer("chapas_qtd"),
    pesoKg: text("peso_kg"),
    responsavel: text("responsavel"),
    observacao: text("observacao"),
  },
  (t) => [uniqueIndex("agendamento_armazem_uk").on(t.agendamentoId, t.armazemId)],
);

export const descargaEquipamento = sqliteTable(
  "descarga_equipamento",
  {
    agendamentoArmazemId: integer("agendamento_armazem_id")
      .notNull()
      .references(() => agendamentoArmazem.id, restrito),
    equipamentoId: integer("equipamento_id")
      .notNull()
      .references(() => equipamento.id, restrito),
  },
  (t) => [primaryKey({ columns: [t.agendamentoArmazemId, t.equipamentoId] })],
);

export const descargaChapa = sqliteTable(
  "descarga_chapa",
  {
    agendamentoArmazemId: integer("agendamento_armazem_id")
      .notNull()
      .references(() => agendamentoArmazem.id, restrito),
    chapaId: integer("chapa_id")
      .notNull()
      .references(() => chapa.id, restrito),
  },
  (t) => [primaryKey({ columns: [t.agendamentoArmazemId, t.chapaId] })],
);

export const pendencia = sqliteTable(
  "pendencia",
  {
    id: id(),
    agendamentoId: integer("agendamento_id")
      .notNull()
      .references(() => agendamento.id, restrito),
    tipo: text("tipo", { enum: PENDENCIA_TIPO }).notNull(),
    descricao: text("descricao"),
    status: text("status", { enum: PENDENCIA_STATUS }).notNull().default("aberta"),
    abertaPor: text("aberta_por"),
    abertaEm: text("aberta_em").notNull(),
    resolvidaPor: text("resolvida_por"),
    resolvidaEm: text("resolvida_em"),
    resolucao: text("resolucao"),
  },
  (t) => [
    index("pendencia_agendamento_ix").on(t.agendamentoId),
    index("pendencia_status_ix").on(t.status),
    emLista("pendencia_tipo_ck", "tipo", PENDENCIA_TIPO),
    emLista("pendencia_status_ck", "status", PENDENCIA_STATUS),
  ],
);

export const naoRecebimento = sqliteTable(
  "nao_recebimento",
  {
    id: id(),
    /** Nulo se nunca agendou. Único: um agendamento termina em no máximo um não recebimento. */
    agendamentoId: integer("agendamento_id").references(() => agendamento.id, restrito),
    fornecedorId: integer("fornecedor_id").references(() => fornecedor.id, restrito),
    placa: text("placa"),
    motivo: text("motivo", { enum: NAO_RECEBIMENTO_MOTIVO }),
    /** Obrigatória no motivo `outro` (regra no código). */
    descricao: text("descricao"),
    registradoPor: text("registrado_por"),
    registradoEm: text("registrado_em").notNull(),
    origem: text("origem", { enum: ORIGEM }).notNull(),
  },
  (t) => [
    uniqueIndex("nao_recebimento_agendamento_uk").on(t.agendamentoId),
    emLista("nao_recebimento_motivo_ck", "motivo", NAO_RECEBIMENTO_MOTIVO),
    emLista("nao_recebimento_origem_ck", "origem", ORIGEM),
  ],
);

export const vagaLiberada = sqliteTable(
  "vaga_liberada",
  {
    id: id(),
    data: text("data"),
    horario: text("horario"),
    origemAgendamentoId: integer("origem_agendamento_id")
      .notNull()
      .references(() => agendamento.id, restrito),
    ocupadaPorAgendamentoId: integer("ocupada_por_agendamento_id").references(() => agendamento.id, restrito),
    definidoPor: text("definido_por"),
    definidoEm: text("definido_em"),
  },
  (t) => [index("vaga_liberada_data_horario_ix").on(t.data, t.horario)],
);

export const evento = sqliteTable(
  "evento",
  {
    id: id(),
    agendamentoId: integer("agendamento_id")
      .notNull()
      .references(() => agendamento.id, restrito),
    /** Sem CHECK (enums.EVENTO_TIPO). */
    tipo: text("tipo").notNull(),
    /** JSON com de e para, motivo. */
    detalhe: text("detalhe"),
    autor: text("autor"),
    criadoEm: text("criado_em").notNull(),
  },
  (t) => [index("evento_agendamento_ix").on(t.agendamentoId)],
);

export const aviso = sqliteTable(
  "aviso",
  {
    id: id(),
    agendamentoId: integer("agendamento_id").references(() => agendamento.id, restrito),
    armazemId: integer("armazem_id").references(() => armazem.id, restrito),
    /** Sem CHECK (enums.AVISO_DESTINATARIO). */
    destinatario: text("destinatario").notNull(),
    /** Sem CHECK. */
    tipo: text("tipo").notNull(),
    mensagem: text("mensagem"),
    /** JSON. */
    detalhe: text("detalhe"),
    dataReferencia: text("data_referencia"),
    criadoEm: text("criado_em").notNull(),
    lidoEm: text("lido_em"),
  },
  (t) => [index("aviso_agendamento_ix").on(t.agendamentoId)],
);

export const previsaoTempo = sqliteTable("previsao_tempo", {
  data: text("data").primaryKey(),
  resumo: text("resumo"),
  chuvaProb: text("chuva_prob"),
  fonte: text("fonte"),
  atualizadoEm: text("atualizado_em"),
});

// ───────────────────────── Diagrama 3: boletim (Tarefa 2) ─────────────────────────

export const boletim = sqliteTable(
  "boletim",
  {
    id: id(),
    armazemId: integer("armazem_id")
      .notNull()
      .references(() => armazem.id, restrito),
    data: text("data").notNull(),
    status: text("status", { enum: BOLETIM_STATUS }).notNull().default("rascunho"),
    producaoTotal: text("producao_total").notNull(),
    diariasEquivalentes: text("diarias_equivalentes").notNull(),
    /** 10 casas, só para exibir. */
    valorPorDiaria: text("valor_por_diaria").notNull(),
    totalAPagar: text("total_a_pagar").notNull(),
    complemento: text("complemento").notNull(),
    pisoUsado: text("piso_usado").notNull(),
    fatorMeiaUsado: text("fator_meia_usado").notNull(),
    responsavel: text("responsavel"),
    observacao: text("observacao"),
    origem: text("origem", { enum: ORIGEM }).notNull(),
    criadoEm: text("criado_em").notNull(),
    atualizadoEm: text("atualizado_em"),
    fechadoEm: text("fechado_em"),
  },
  (t) => [
    uniqueIndex("boletim_armazem_data_uk").on(t.armazemId, t.data),
    index("boletim_data_ix").on(t.data),
    emLista("boletim_status_ck", "status", BOLETIM_STATUS),
    emLista("boletim_origem_ck", "origem", ORIGEM),
  ],
);

export const boletimLinha = sqliteTable(
  "boletim_linha",
  {
    id: id(),
    boletimId: integer("boletim_id")
      .notNull()
      .references(() => boletim.id, restrito),
    tipoItemId: integer("tipo_item_id")
      .notNull()
      .references(() => tipoItem.id, restrito),
    qtdDescarga: text("qtd_descarga").notNull().default("0"),
    qtdRemocao: text("qtd_remocao").notNull().default("0"),
    qtdTransferencia: text("qtd_transferencia").notNull().default("0"),
    quantidadeTotal: text("quantidade_total").notNull(),
    precoUsado: text("preco_usado").notNull(),
    valor: text("valor").notNull(),
  },
  (t) => [uniqueIndex("boletim_linha_uk").on(t.boletimId, t.tipoItemId)],
);

export const boletimChapa = sqliteTable(
  "boletim_chapa",
  {
    id: id(),
    boletimId: integer("boletim_id")
      .notNull()
      .references(() => boletim.id, restrito),
    chapaId: integer("chapa_id")
      .notNull()
      .references(() => chapa.id, restrito),
    /** Repete boletim.data: existe para o único "um funcionário, um boletim por dia". */
    data: text("data").notNull(),
    tipoDiaria: text("tipo_diaria", { enum: TIPO_DIARIA }).notNull().default("completa"),
  },
  (t) => [
    uniqueIndex("boletim_chapa_chapa_data_uk").on(t.chapaId, t.data),
    index("boletim_chapa_boletim_ix").on(t.boletimId),
    emLista("boletim_chapa_tipo_diaria_ck", "tipo_diaria", TIPO_DIARIA),
  ],
);

// ───────────────────────── Diagrama 4: histórico e painel (Tarefa 3) ─────────────────────────

export const histMovimentacao = sqliteTable(
  "hist_movimentacao",
  {
    id: id(),
    linhaPlanilha: integer("linha_planilha").notNull(),
    pedidoCompra: text("pedido_compra"),
    dataLancamento: text("data_lancamento"),
    dataDocumento: text("data_documento"),
    codPn: text("cod_pn"),
    nomePn: text("nome_pn"),
    codItem: text("cod_item"),
    descItem: text("desc_item"),
    qtd: text("qtd"),
    peso: text("peso"),
    deposito: text("deposito"),
    nRecebimento: text("n_recebimento"),
    dataRecebimento: text("data_recebimento"),
    nfNumero: text("nf_numero"),
    chaveAcesso: text("chave_acesso"),
    fornecedorCnpj: text("fornecedor_cnpj"),
    unidade: text("unidade"),
    grupo: text("grupo"),
    armazemId: integer("armazem_id").references(() => armazem.id, restrito),
    pesoKg: text("peso_kg"),
    /** Marcas separadas por vírgula; vazio se ok. */
    qualidade: text("qualidade"),
    considerada: integer("considerada", { mode: "boolean" }).notNull().default(true),
    /** JSON com colunas sem destino. */
    extra: text("extra"),
  },
  (t) => [
    uniqueIndex("hist_mov_linha_uk").on(t.linhaPlanilha),
    index("hist_mov_data_receb_ix").on(t.dataRecebimento),
    index("hist_mov_chave_ix").on(t.chaveAcesso),
    index("hist_mov_cod_item_ix").on(t.codItem),
    index("hist_mov_pn_data_ix").on(t.codPn, t.dataRecebimento),
  ],
);

export const histNfXml = sqliteTable(
  "hist_nf_xml",
  {
    id: id(),
    arquivo: text("arquivo"),
    chaveAcesso: text("chave_acesso"),
    numero: text("numero"),
    emitenteCnpj: text("emitente_cnpj"),
    emitenteNome: text("emitente_nome"),
    emitidaEm: text("emitida_em"),
    saidaEm: text("saida_em"),
    valorTotal: text("valor_total"),
    pesoLiquidoKg: text("peso_liquido_kg"),
    pesoBrutoKg: text("peso_bruto_kg"),
    volumes: text("volumes"),
    especie: text("especie"),
    placa: text("placa"),
    transportadora: text("transportadora"),
    modalidadeFrete: text("modalidade_frete"),
    pedidoFornecedor: text("pedido_fornecedor"),
    itensQtd: integer("itens_qtd"),
    qualidade: text("qualidade"),
    considerada: integer("considerada", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("hist_nf_xml_chave_ix").on(t.chaveAcesso)],
);

export const histChapasDia = sqliteTable(
  "hist_chapas_dia",
  {
    id: id(),
    data: text("data"),
    diaSemana: text("dia_semana"),
    /** Inclui o café. */
    presentes: integer("presentes"),
    cafe: integer("cafe"),
    /** Folha, não é boletim (D31). */
    valorPago: text("valor_pago"),
    qualidade: text("qualidade"),
    considerada: integer("considerada", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("hist_chapas_dia_data_ix").on(t.data)],
);

export const histPeriodoSemDado = sqliteTable(
  "hist_periodo_sem_dado",
  {
    anoMes: text("ano_mes").primaryKey(),
    tipo: text("tipo", { enum: PERIODO_SEM_DADO_TIPO }).notNull(),
    motivo: text("motivo"),
  },
  () => [emLista("hist_periodo_sem_dado_tipo_ck", "tipo", PERIODO_SEM_DADO_TIPO)],
);

export const histCarga = sqliteTable(
  "hist_carga",
  {
    id: id(),
    codPn: text("cod_pn"),
    data: text("data"),
    notasQtd: integer("notas_qtd").notNull().default(0),
    itensQtd: integer("itens_qtd").notNull().default(0),
    pesoTotalKg: text("peso_total_kg"),
    especieXml: text("especie_xml"),
    acondicionamentoXml: text("acondicionamento_xml"),
  },
  (t) => [index("hist_carga_data_ix").on(t.data), index("hist_carga_pn_data_ix").on(t.codPn, t.data)],
);

export const histCargaArmazem = sqliteTable(
  "hist_carga_armazem",
  {
    histCargaId: integer("hist_carga_id")
      .notNull()
      .references(() => histCarga.id, restrito),
    armazemId: integer("armazem_id")
      .notNull()
      .references(() => armazem.id, restrito),
    itensQtd: integer("itens_qtd").notNull().default(0),
    pesoKg: text("peso_kg"),
    /** Unidades do boletim estimadas (D29). */
    quantidadeBoletim: text("quantidade_boletim"),
    producaoEstimada: text("producao_estimada"),
  },
  (t) => [primaryKey({ columns: [t.histCargaId, t.armazemId] }), index("hist_carga_armazem_armazem_ix").on(t.armazemId)],
);

export const histImportacaoLog = sqliteTable("hist_importacao_log", {
  id: id(),
  arquivo: text("arquivo"),
  linhasLidas: integer("linhas_lidas").notNull().default(0),
  linhasOk: integer("linhas_ok").notNull().default(0),
  linhasMarcadas: integer("linhas_marcadas").notNull().default(0),
  /** JSON com a contagem por motivo. */
  motivos: text("motivos"),
  executadoEm: text("executado_em").notNull(),
});

// ───────────────────────── Escala de equipes (D55) ─────────────────────────

/** Equipe de chapas de um dia: o gestor monta, imprime e cola na parede. */
export const equipe = sqliteTable(
  "equipe",
  {
    id: id(),
    data: text("data").notNull(),
    nome: text("nome").notNull(),
    /** Onde a equipe vai trabalhar; o boletim do armazém puxa a equipe por aqui. */
    armazemId: integer("armazem_id").references(() => armazem.id, restrito),
    /** O que a equipe faz no dia (aparece na impressão). */
    tarefa: text("tarefa"),
    /** Horário opcional (HH:MM) de quem monta a escala; aparece na impressão. */
    horarioInicio: text("horario_inicio"),
    horarioFim: text("horario_fim"),
    ordem: integer("ordem").notNull().default(0),
    criadoEm: text("criado_em").notNull(),
    origem: text("origem", { enum: ORIGEM }).notNull(),
  },
  (t) => [uniqueIndex("equipe_data_nome_uk").on(t.data, t.nome), emLista("equipe_origem_ck", "origem", ORIGEM)],
);

export const equipeChapa = sqliteTable(
  "equipe_chapa",
  {
    id: id(),
    equipeId: integer("equipe_id")
      .notNull()
      .references(() => equipe.id, restrito),
    chapaId: integer("chapa_id")
      .notNull()
      .references(() => chapa.id, restrito),
    /** Repete equipe.data: existe para o único "um funcionário, uma equipe por dia". */
    data: text("data").notNull(),
    ordem: integer("ordem").notNull().default(0),
    /** Meia ou diária inteira: segue para o boletim quando a equipe é trazida. */
    tipoDiaria: text("tipo_diaria", { enum: TIPO_DIARIA }).notNull().default("completa"),
  },
  (t) => [uniqueIndex("equipe_chapa_chapa_data_uk").on(t.chapaId, t.data), index("equipe_chapa_equipe_ix").on(t.equipeId), emLista("equipe_chapa_tipo_diaria_ck", "tipo_diaria", TIPO_DIARIA)],
);
