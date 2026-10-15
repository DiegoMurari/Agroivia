ALTER TABLE `equipe_chapa` ADD `tipo_diaria` text DEFAULT 'completa' NOT NULL CONSTRAINT "equipe_chapa_tipo_diaria_ck" CHECK("tipo_diaria" IN ('completa', 'meia'));
