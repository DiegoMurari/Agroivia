import fs from "node:fs";
import { getTableName, is, sql } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";

import { createDb, type Db } from "@/lib/db";
import { migrar } from "@/lib/db/migrar";
import * as schema from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed/demo";
import { seedFixo } from "@/lib/db/seed/fixo";
import { seedRetroativo } from "@/lib/db/seed/retroativo";
import { arquivoAncoraDe } from "@/lib/relogio";

import { gravarCadastros, lerCadastros } from "./importar-cadastros";

/**
 * Recria a matriz data/base.db: migração, seed fixo, cadastros do pacote, dados de demonstração,
 * seeds dos módulos e, se o importador da janela A existir, o histórico.
 * Não depende de DB_PATH. Depois dele: npm run db:clone (com os servidores parados).
 */

const BASE = "data/base.db";
const MODULOS_COM_SEED = ["agendamento", "boletim", "painel"] as const;
const DIA_D_PADRAO = "2026-08-31";
/** DEMO_MODO=sintetico volta aos dados inventados; o padrão é o uso retroativo sobre o histórico real (D54). */
const RETROATIVO = (process.env.DEMO_MODO ?? "retroativo") !== "sintetico";

let falhas = 0;

function apagar(caminho: string): void {
  for (const arquivo of [caminho, `${caminho}-wal`, `${caminho}-shm`, arquivoAncoraDe(caminho)]) {
    try {
      fs.rmSync(arquivo, { force: true });
    } catch {
      throw new Error(`Não consegui apagar ${arquivo}: está em uso. Feche o que estiver com a matriz aberta e repita.`);
    }
  }
}

function contagens(db: Db): void {
  console.log("\nLinhas por tabela:");
  for (const tabela of Object.values(schema)) {
    if (!is(tabela, SQLiteTable)) continue;
    const { n } = db.get<{ n: number }>(sql`select count(*) as n from ${tabela}`);
    if (n > 0) console.log(`  ${getTableName(tabela).padEnd(24)} ${n}`);
  }
}

async function main(): Promise<void> {
  apagar(BASE);
  const db = createDb(BASE);
  migrar(db);
  console.log("Migrações aplicadas.");

  seedFixo(db);
  console.log("Seed fixo aplicado.");

  const pacote = process.env.PACOTE_DIR?.trim();
  const temPacote = Boolean(pacote && fs.existsSync(pacote));
  if (temPacote) {
    const c = gravarCadastros(db, await lerCadastros(pacote!));
    console.log(
      `Cadastros: ${c.produtos} produtos (${c.produtosSemArmazem} sem armazém, ${c.ruins.produtos} linhas recusadas), ` +
        `${c.fornecedores} fornecedores (${c.ruins.fornecedores} recusadas), ${c.chapas} funcionários. ` +
        `Grupos fora do mapa: ${c.gruposNovos.join(", ") || "nenhum"}.`,
    );
  } else {
    falhas++;
    console.error(`ATENÇÃO: PACOTE_DIR não existe ("${pacote ?? ""}"). A matriz ficou SEM produtos, fornecedores e funcionários.`);
  }

  const diaD = process.env.DEMO_AGORA?.slice(0, 10) || DIA_D_PADRAO;
  if (!RETROATIVO || !temPacote) {
    try {
      const resumo = seedDemo(db, diaD);
      console.log(`Demonstração sintética (dia D = ${diaD}): ${resumo}`);
    } catch (erro) {
      falhas++;
      console.error("FALHOU o seed de demonstração:", erro);
    }
  }

  for (const modulo of MODULOS_COM_SEED) {
    try {
      const { seed } = (await import(`../lib/${modulo}/seed`)) as { seed: (db: Db) => void };
      seed(db);
      console.log(`Seed do módulo ${modulo} aplicado.`);
    } catch (erro) {
      falhas++;
      console.error(`FALHOU o seed do módulo ${modulo}:`, erro);
    }
  }

  if (temPacote) {
    try {
      const importador = (await import("../lib/painel/importar/run")) as {
        importarHistorico?: (db: Db, pacoteDir: string) => void | Promise<void>;
      };
      if (importador.importarHistorico) {
        await importador.importarHistorico(db, pacote!);
        console.log("Histórico importado.");
        if (RETROATIVO) {
          const resumo = seedRetroativo(db, diaD);
          console.log(`Uso retroativo (dia D = ${diaD}): ${resumo}`);
        }
      } else {
        console.log("Histórico: o importador da janela A ainda não exporta importarHistorico (pulado).");
      }
    } catch (erro) {
      falhas++;
      console.error("FALHOU o importador do histórico:", erro);
    }
  }

  contagens(db);
  db.$client.pragma("wal_checkpoint(TRUNCATE)");
  db.$client.close();
  console.log(`\nMatriz pronta em ${BASE}${falhas ? `, com ${falhas} falha(s) acima` : ""}. Próximo passo: npm run db:clone.`);
  if (falhas) process.exitCode = 1;
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
