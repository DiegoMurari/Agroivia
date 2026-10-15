CREATE TABLE `equipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data` text NOT NULL,
	`nome` text NOT NULL,
	`armazem_id` integer,
	`tarefa` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`criado_em` text NOT NULL,
	`origem` text NOT NULL,
	FOREIGN KEY (`armazem_id`) REFERENCES `armazem`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "equipe_origem_ck" CHECK("origem" IN ('historico', 'teste', 'operacao'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipe_data_nome_uk` ON `equipe` (`data`,`nome`);--> statement-breakpoint
CREATE TABLE `equipe_chapa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipe_id` integer NOT NULL,
	`chapa_id` integer NOT NULL,
	`data` text NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`equipe_id`) REFERENCES `equipe`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`chapa_id`) REFERENCES `chapa`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipe_chapa_chapa_data_uk` ON `equipe_chapa` (`chapa_id`,`data`);--> statement-breakpoint
CREATE INDEX `equipe_chapa_equipe_ix` ON `equipe_chapa` (`equipe_id`);