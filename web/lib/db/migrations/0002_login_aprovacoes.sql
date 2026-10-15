CREATE TABLE `convite_fornecedor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`email` text,
	`criado_por` integer,
	`criado_em` text NOT NULL,
	`usado_em` text,
	FOREIGN KEY (`criado_por`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `convite_fornecedor_token_uk` ON `convite_fornecedor` (`token`);--> statement-breakpoint
CREATE TABLE `fornecedor_cadastro` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`fornecedor_id` integer,
	`razao_social` text NOT NULL,
	`nome_fantasia` text,
	`cnpj` text NOT NULL,
	`inscricao_estadual` text,
	`email` text NOT NULL,
	`telefone` text,
	`responsavel` text,
	`endereco` text,
	`tipos_mercadoria` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`alteracao_pendente` text,
	`motivo_recusa` text,
	`decidido_por` integer,
	`decidido_em` text,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedor`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`decidido_por`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fornecedor_cadastro_status_ck" CHECK("status" IN ('pendente', 'aprovado', 'recusado'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fornecedor_cadastro_usuario_uk` ON `fornecedor_cadastro` (`usuario_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fornecedor_cadastro_cnpj_uk` ON `fornecedor_cadastro` (`cnpj`);--> statement-breakpoint
CREATE TABLE `log_aprovacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alvo` text NOT NULL,
	`alvo_id` integer NOT NULL,
	`decisao` text NOT NULL,
	`comentario` text,
	`usuario_id` integer NOT NULL,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "log_aprovacao_alvo_ck" CHECK("alvo" IN ('cadastro', 'pedido')),
	CONSTRAINT "log_aprovacao_decisao_ck" CHECK("decisao" IN ('aprovado', 'recusado'))
);
--> statement-breakpoint
CREATE INDEX `log_aprovacao_alvo_ix` ON `log_aprovacao` (`alvo`,`alvo_id`);--> statement-breakpoint
CREATE TABLE `notificacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`mensagem` text NOT NULL,
	`link` text,
	`lida` integer DEFAULT false NOT NULL,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `notificacao_usuario_ix` ON `notificacao` (`usuario_id`,`lida`);--> statement-breakpoint
ALTER TABLE `agendamento` ADD `aprovacao` text DEFAULT 'aprovado' NOT NULL;--> statement-breakpoint
ALTER TABLE `agendamento` ADD `recusa_comentario` text;--> statement-breakpoint
ALTER TABLE `agendamento` ADD `aprovacao_por` integer REFERENCES usuario(id);--> statement-breakpoint
ALTER TABLE `agendamento` ADD `aprovacao_em` text;--> statement-breakpoint
ALTER TABLE `agendamento` ADD `criado_por_usuario_id` integer REFERENCES usuario(id);--> statement-breakpoint
ALTER TABLE `equipamento` ADD `status` text DEFAULT 'operacional' NOT NULL;--> statement-breakpoint
ALTER TABLE `usuario` ADD `email` text;--> statement-breakpoint
ALTER TABLE `usuario` ADD `senha_hash` text;--> statement-breakpoint
ALTER TABLE `usuario` ADD `perfil` text;--> statement-breakpoint
ALTER TABLE `usuario` ADD `ativo` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `usuario` ADD `trocar_senha` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usuario` ADD `token_senha` text;--> statement-breakpoint
ALTER TABLE `usuario` ADD `token_senha_expira` text;--> statement-breakpoint
ALTER TABLE `usuario` ADD `criado_em` text;--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_email_uk` ON `usuario` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_token_senha_uk` ON `usuario` (`token_senha`);