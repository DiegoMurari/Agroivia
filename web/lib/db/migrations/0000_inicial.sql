CREATE TABLE `agendamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`compra_id` integer,
	`fornecedor_id` integer NOT NULL,
	`data` text NOT NULL,
	`horario` text NOT NULL,
	`placa` text,
	`transportadora` text,
	`motorista` text,
	`acondicionamento_ocupacao` text NOT NULL,
	`peso_declarado_kg` text,
	`peso_balanca_kg` text,
	`status` text DEFAULT 'agendado' NOT NULL,
	`agendado_na_hora` integer DEFAULT false NOT NULL,
	`validacao_status` text DEFAULT 'aguardando' NOT NULL,
	`validacao_obs` text,
	`validado_por` text,
	`validado_em` text,
	`autorizado_por` text,
	`autorizado_em` text,
	`chegada_em` text,
	`liberacao_em` text,
	`prioridade` integer DEFAULT false NOT NULL,
	`excecao_ocupacao` text,
	`excecao_motivo` text,
	`remarcacoes` integer DEFAULT 0 NOT NULL,
	`motivo_cancelamento` text,
	`cancelado_por` text,
	`cancelado_em` text,
	`chapas_previstas` integer,
	`empilhadeira_prevista` integer,
	`duracao_prevista_min` integer,
	`observacao` text,
	`extra` text,
	`origem` text NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text,
	FOREIGN KEY (`compra_id`) REFERENCES `compra`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedor`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "agendamento_status_ck" CHECK("status" IN ('agendado', 'chegou', 'em_descarga', 'concluido', 'cancelado', 'nao_recebido')),
	CONSTRAINT "agendamento_acond_ocupacao_ck" CHECK("acondicionamento_ocupacao" IN ('batido', 'unitizado')),
	CONSTRAINT "agendamento_validacao_status_ck" CHECK("validacao_status" IN ('aguardando', 'conforme', 'divergente')),
	CONSTRAINT "agendamento_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE INDEX `agendamento_data_horario_ix` ON `agendamento` (`data`,`horario`);--> statement-breakpoint
CREATE INDEX `agendamento_status_ix` ON `agendamento` (`status`);--> statement-breakpoint
CREATE INDEX `agendamento_compra_ix` ON `agendamento` (`compra_id`);--> statement-breakpoint
CREATE TABLE `agendamento_armazem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agendamento_id` integer NOT NULL,
	`armazem_id` integer NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`entrada_em` text,
	`saida_em` text,
	`chapas_qtd` integer,
	`peso_kg` text,
	`responsavel` text,
	`observacao` text,
	FOREIGN KEY (`agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agendamento_armazem_uk` ON `agendamento_armazem` (`agendamento_id`,`armazem_id`);--> statement-breakpoint
CREATE TABLE `agendamento_nf` (
	`agendamento_id` integer NOT NULL,
	`nota_fiscal_id` integer NOT NULL,
	`acondicionamento` text NOT NULL,
	PRIMARY KEY(`agendamento_id`, `nota_fiscal_id`),
	FOREIGN KEY (`agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`nota_fiscal_id`) REFERENCES `nota_fiscal`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "agendamento_nf_acondicionamento_ck" CHECK("acondicionamento" IN ('batido', 'paletizado', 'big_bag'))
);
--> statement-breakpoint
CREATE INDEX `agendamento_nf_nf_ix` ON `agendamento_nf` (`nota_fiscal_id`);--> statement-breakpoint
CREATE TABLE `armazem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`local_fisico` text,
	`faz_boletim` integer DEFAULT true NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `armazem_nome_uk` ON `armazem` (`nome`);--> statement-breakpoint
CREATE TABLE `aviso` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agendamento_id` integer,
	`armazem_id` integer,
	`destinatario` text NOT NULL,
	`tipo` text NOT NULL,
	`mensagem` text,
	`detalhe` text,
	`data_referencia` text,
	`criado_em` text NOT NULL,
	`lido_em` text,
	FOREIGN KEY (`agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `aviso_agendamento_ix` ON `aviso` (`agendamento_id`);--> statement-breakpoint
CREATE TABLE `boletim` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`armazem_id` integer NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`producao_total` text NOT NULL,
	`diarias_equivalentes` text NOT NULL,
	`valor_por_diaria` text NOT NULL,
	`total_a_pagar` text NOT NULL,
	`complemento` text NOT NULL,
	`piso_usado` text NOT NULL,
	`fator_meia_usado` text NOT NULL,
	`responsavel` text,
	`observacao` text,
	`origem` text NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text,
	`fechado_em` text,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "boletim_status_ck" CHECK("status" IN ('rascunho', 'fechado')),
	CONSTRAINT "boletim_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boletim_armazem_data_uk` ON `boletim` (`armazem_id`,`data`);--> statement-breakpoint
CREATE INDEX `boletim_data_ix` ON `boletim` (`data`);--> statement-breakpoint
CREATE TABLE `boletim_chapa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`boletim_id` integer NOT NULL,
	`chapa_id` integer NOT NULL,
	`data` text NOT NULL,
	`tipo_diaria` text DEFAULT 'completa' NOT NULL,
	FOREIGN KEY (`boletim_id`) REFERENCES `boletim`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`chapa_id`) REFERENCES `chapa`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "boletim_chapa_tipo_diaria_ck" CHECK("tipo_diaria" IN ('completa', 'meia'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boletim_chapa_chapa_data_uk` ON `boletim_chapa` (`chapa_id`,`data`);--> statement-breakpoint
CREATE INDEX `boletim_chapa_boletim_ix` ON `boletim_chapa` (`boletim_id`);--> statement-breakpoint
CREATE TABLE `boletim_linha` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`boletim_id` integer NOT NULL,
	`tipo_item_id` integer NOT NULL,
	`qtd_descarga` text DEFAULT '0' NOT NULL,
	`qtd_remocao` text DEFAULT '0' NOT NULL,
	`qtd_transferencia` text DEFAULT '0' NOT NULL,
	`quantidade_total` text NOT NULL,
	`preco_usado` text NOT NULL,
	`valor` text NOT NULL,
	FOREIGN KEY (`boletim_id`) REFERENCES `boletim`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tipo_item_id`) REFERENCES `tipo_item`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boletim_linha_uk` ON `boletim_linha` (`boletim_id`,`tipo_item_id`);--> statement-breakpoint
CREATE TABLE `chapa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`matricula` text NOT NULL,
	`nome` text NOT NULL,
	`armazem_id` integer,
	`ativo` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapa_matricula_uk` ON `chapa` (`matricula`);--> statement-breakpoint
CREATE TABLE `compra` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fornecedor_id` integer NOT NULL,
	`numero_pedido` text,
	`descricao` text,
	`token` text NOT NULL,
	`status` text DEFAULT 'criada' NOT NULL,
	`criada_por` text,
	`criada_em` text NOT NULL,
	`preenchida_em` text,
	`origem` text NOT NULL,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedor`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "compra_status_ck" CHECK("status" IN ('criada', 'confirmada', 'cancelada')),
	CONSTRAINT "compra_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compra_token_uk` ON `compra` (`token`);--> statement-breakpoint
CREATE TABLE `compra_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`compra_id` integer NOT NULL,
	`produto_id` integer,
	`descricao` text,
	`quantidade` text,
	`unidade` text,
	`peso_kg` text,
	FOREIGN KEY (`compra_id`) REFERENCES `compra`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`produto_id`) REFERENCES `produto`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `compra_item_compra_ix` ON `compra_item` (`compra_id`);--> statement-breakpoint
CREATE TABLE `deposito_armazem` (
	`deposito` text PRIMARY KEY NOT NULL,
	`armazem_id` integer,
	`recebe_direto` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `descarga_chapa` (
	`agendamento_armazem_id` integer NOT NULL,
	`chapa_id` integer NOT NULL,
	PRIMARY KEY(`agendamento_armazem_id`, `chapa_id`),
	FOREIGN KEY (`agendamento_armazem_id`) REFERENCES `agendamento_armazem`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`chapa_id`) REFERENCES `chapa`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `descarga_equipamento` (
	`agendamento_armazem_id` integer NOT NULL,
	`equipamento_id` integer NOT NULL,
	PRIMARY KEY(`agendamento_armazem_id`, `equipamento_id`),
	FOREIGN KEY (`agendamento_armazem_id`) REFERENCES `agendamento_armazem`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipamento_id`) REFERENCES `equipamento`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `equipamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`armazem_id` integer NOT NULL,
	`nome` text,
	`finalidade` text,
	`quantidade` integer DEFAULT 1 NOT NULL,
	`disponivel` integer DEFAULT 1 NOT NULL,
	`indisponivel_motivo` text,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `evento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agendamento_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`detalhe` text,
	`autor` text,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `evento_agendamento_ix` ON `evento` (`agendamento_id`);--> statement-breakpoint
CREATE TABLE `feriado` (
	`data` text PRIMARY KEY NOT NULL,
	`nome` text
);
--> statement-breakpoint
CREATE TABLE `fornecedor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo` text,
	`razao_social` text NOT NULL,
	`cnpj` text,
	`origem` text NOT NULL,
	CONSTRAINT "fornecedor_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fornecedor_codigo_uk` ON `fornecedor` (`codigo`);--> statement-breakpoint
CREATE INDEX `fornecedor_cnpj_ix` ON `fornecedor` (`cnpj`);--> statement-breakpoint
CREATE TABLE `grupo_produto` (
	`grupo` text PRIMARY KEY NOT NULL,
	`descricao` text,
	`armazem_id` integer,
	`tipo_item_id` integer,
	`conversao_producao` text,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tipo_item_id`) REFERENCES `tipo_item`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `hist_carga` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cod_pn` text,
	`data` text,
	`notas_qtd` integer DEFAULT 0 NOT NULL,
	`itens_qtd` integer DEFAULT 0 NOT NULL,
	`peso_total_kg` text,
	`especie_xml` text,
	`acondicionamento_xml` text
);
--> statement-breakpoint
CREATE INDEX `hist_carga_data_ix` ON `hist_carga` (`data`);--> statement-breakpoint
CREATE INDEX `hist_carga_pn_data_ix` ON `hist_carga` (`cod_pn`,`data`);--> statement-breakpoint
CREATE TABLE `hist_carga_armazem` (
	`hist_carga_id` integer NOT NULL,
	`armazem_id` integer NOT NULL,
	`itens_qtd` integer DEFAULT 0 NOT NULL,
	`peso_kg` text,
	`quantidade_boletim` text,
	`producao_estimada` text,
	PRIMARY KEY(`hist_carga_id`, `armazem_id`),
	FOREIGN KEY (`hist_carga_id`) REFERENCES `hist_carga`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `hist_carga_armazem_armazem_ix` ON `hist_carga_armazem` (`armazem_id`);--> statement-breakpoint
CREATE TABLE `hist_chapas_dia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data` text,
	`dia_semana` text,
	`presentes` integer,
	`cafe` integer,
	`valor_pago` text,
	`qualidade` text,
	`considerada` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hist_chapas_dia_data_ix` ON `hist_chapas_dia` (`data`);--> statement-breakpoint
CREATE TABLE `hist_importacao_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`arquivo` text,
	`linhas_lidas` integer DEFAULT 0 NOT NULL,
	`linhas_ok` integer DEFAULT 0 NOT NULL,
	`linhas_marcadas` integer DEFAULT 0 NOT NULL,
	`motivos` text,
	`executado_em` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hist_movimentacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`linha_planilha` integer NOT NULL,
	`pedido_compra` text,
	`data_lancamento` text,
	`data_documento` text,
	`cod_pn` text,
	`nome_pn` text,
	`cod_item` text,
	`desc_item` text,
	`qtd` text,
	`peso` text,
	`deposito` text,
	`n_recebimento` text,
	`data_recebimento` text,
	`nf_numero` text,
	`chave_acesso` text,
	`fornecedor_cnpj` text,
	`unidade` text,
	`grupo` text,
	`armazem_id` integer,
	`peso_kg` text,
	`qualidade` text,
	`considerada` integer DEFAULT true NOT NULL,
	`extra` text,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hist_mov_linha_uk` ON `hist_movimentacao` (`linha_planilha`);--> statement-breakpoint
CREATE INDEX `hist_mov_data_receb_ix` ON `hist_movimentacao` (`data_recebimento`);--> statement-breakpoint
CREATE INDEX `hist_mov_chave_ix` ON `hist_movimentacao` (`chave_acesso`);--> statement-breakpoint
CREATE INDEX `hist_mov_cod_item_ix` ON `hist_movimentacao` (`cod_item`);--> statement-breakpoint
CREATE INDEX `hist_mov_pn_data_ix` ON `hist_movimentacao` (`cod_pn`,`data_recebimento`);--> statement-breakpoint
CREATE TABLE `hist_nf_xml` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`arquivo` text,
	`chave_acesso` text,
	`numero` text,
	`emitente_cnpj` text,
	`emitente_nome` text,
	`emitida_em` text,
	`saida_em` text,
	`valor_total` text,
	`peso_liquido_kg` text,
	`peso_bruto_kg` text,
	`volumes` text,
	`especie` text,
	`placa` text,
	`transportadora` text,
	`modalidade_frete` text,
	`pedido_fornecedor` text,
	`itens_qtd` integer,
	`qualidade` text,
	`considerada` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hist_nf_xml_chave_ix` ON `hist_nf_xml` (`chave_acesso`);--> statement-breakpoint
CREATE TABLE `hist_periodo_sem_dado` (
	`ano_mes` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`motivo` text,
	CONSTRAINT "hist_periodo_sem_dado_tipo_ck" CHECK("tipo" IN ('sem_dado', 'parcial'))
);
--> statement-breakpoint
CREATE TABLE `horario_grade` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hora` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `horario_grade_hora_uk` ON `horario_grade` (`hora`);--> statement-breakpoint
CREATE TABLE `nao_recebimento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agendamento_id` integer,
	`fornecedor_id` integer,
	`placa` text,
	`motivo` text,
	`descricao` text,
	`registrado_por` text,
	`registrado_em` text NOT NULL,
	`origem` text NOT NULL,
	FOREIGN KEY (`agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedor`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "nao_recebimento_motivo_ck" CHECK("motivo" IN ('divergencia_nota_pedido', 'sem_agendamento_sem_vaga', 'caso_fortuito', 'outro')),
	CONSTRAINT "nao_recebimento_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nao_recebimento_agendamento_uk` ON `nao_recebimento` (`agendamento_id`);--> statement-breakpoint
CREATE TABLE `norma_chapas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`perfil` text NOT NULL,
	`acondicionamento` text NOT NULL,
	`peso_min_kg_exclusivo` text,
	`chapas` integer DEFAULT 0 NOT NULL,
	`empilhadeira` integer DEFAULT false NOT NULL,
	`duracao_min` integer,
	CONSTRAINT "norma_chapas_perfil_ck" CHECK("perfil" IN ('agrovia', 'dossie')),
	CONSTRAINT "norma_chapas_acondicionamento_ck" CHECK("acondicionamento" IN ('batido', 'paletizado', 'big_bag', 'maquina'))
);
--> statement-breakpoint
CREATE TABLE `nota_fiscal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chave_acesso` text NOT NULL,
	`numero` text,
	`serie` text,
	`emitente_cnpj` text,
	`emitente_nome` text,
	`fornecedor_id` integer,
	`emitida_em` text,
	`valor_total` text,
	`peso_bruto_kg` text,
	`peso_liquido_kg` text,
	`volumes` text,
	`especie` text,
	`placa` text,
	`transportadora` text,
	`pedido_fornecedor` text,
	`forma_entrada` text DEFAULT 'xml' NOT NULL,
	`origem` text NOT NULL,
	`criada_em` text NOT NULL,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedor`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "nota_fiscal_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nota_fiscal_chave_uk` ON `nota_fiscal` (`chave_acesso`);--> statement-breakpoint
CREATE TABLE `nota_fiscal_arquivo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nota_fiscal_id` integer NOT NULL,
	`nome` text,
	`tipo_mime` text,
	`tamanho_bytes` integer,
	`conteudo` blob,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`nota_fiscal_id`) REFERENCES `nota_fiscal`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `nota_fiscal_arquivo_nf_ix` ON `nota_fiscal_arquivo` (`nota_fiscal_id`);--> statement-breakpoint
CREATE TABLE `nota_fiscal_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nota_fiscal_id` integer NOT NULL,
	`codigo_fornecedor` text,
	`descricao` text,
	`quantidade` text,
	`unidade` text,
	`valor_unitario` text,
	`produto_id` integer,
	FOREIGN KEY (`nota_fiscal_id`) REFERENCES `nota_fiscal`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`produto_id`) REFERENCES `produto`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `nota_fiscal_item_nf_ix` ON `nota_fiscal_item` (`nota_fiscal_id`);--> statement-breakpoint
CREATE TABLE `parametro` (
	`chave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`descricao` text
);
--> statement-breakpoint
CREATE TABLE `pendencia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agendamento_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`descricao` text,
	`status` text DEFAULT 'aberta' NOT NULL,
	`aberta_por` text,
	`aberta_em` text NOT NULL,
	`resolvida_por` text,
	`resolvida_em` text,
	`resolucao` text,
	FOREIGN KEY (`agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "pendencia_tipo_ck" CHECK("tipo" IN ('divergencia_nf_pedido', 'outra')),
	CONSTRAINT "pendencia_status_ck" CHECK("status" IN ('aberta', 'resolvida'))
);
--> statement-breakpoint
CREATE INDEX `pendencia_agendamento_ix` ON `pendencia` (`agendamento_id`);--> statement-breakpoint
CREATE INDEX `pendencia_status_ix` ON `pendencia` (`status`);--> statement-breakpoint
CREATE TABLE `previsao_tempo` (
	`data` text PRIMARY KEY NOT NULL,
	`resumo` text,
	`chuva_prob` text,
	`fonte` text,
	`atualizado_em` text
);
--> statement-breakpoint
CREATE TABLE `produto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item` text NOT NULL,
	`descricao` text,
	`unidade` text,
	`peso_unitario_kg` text,
	`subgrupo` text,
	`grupo` text,
	`deposito` text DEFAULT '' NOT NULL,
	`armazem_id` integer,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `produto_item_deposito_uk` ON `produto` (`item`,`deposito`);--> statement-breakpoint
CREATE INDEX `produto_grupo_ix` ON `produto` (`grupo`);--> statement-breakpoint
CREATE TABLE `tipo_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`preco_unitario` text NOT NULL,
	`categoria` text DEFAULT 'item' NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	CONSTRAINT "tipo_item_categoria_ck" CHECK("categoria" IN ('item', 'diaria'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tipo_item_nome_uk` ON `tipo_item` (`nome`);--> statement-breakpoint
CREATE TABLE `usuario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text,
	`papel` text NOT NULL,
	`armazem_id` integer,
	`fornecedor_id` integer,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedor`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `vaga_liberada` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data` text,
	`horario` text,
	`origem_agendamento_id` integer NOT NULL,
	`ocupada_por_agendamento_id` integer,
	`definido_por` text,
	`definido_em` text,
	FOREIGN KEY (`origem_agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ocupada_por_agendamento_id`) REFERENCES `agendamento`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `vaga_liberada_data_horario_ix` ON `vaga_liberada` (`data`,`horario`);