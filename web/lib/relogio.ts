import fs from "node:fs";

/**
 * Relógio do sistema (D37). Todo "agora" e "hoje" sai daqui, nunca de `new Date()`.
 *
 * Com DEMO_AGORA definida, o relógio parte daquele instante e continua correndo:
 *   agora = DEMO_AGORA + (tempo real - âncora)
 * A âncora (instante real da primeira chamada) fica em `<DB_PATH>.relogio`, ao lado do banco:
 * reiniciar o servidor não volta o relógio. `db:rebuild` e `db:clone` apagam o arquivo.
 * Sem DB_PATH a âncora fica só em memória. Sem DEMO_AGORA, é a hora real.
 *
 * Os textos saem sempre em horário de Brasília (-03:00), sem depender do fuso da máquina.
 */

const FUSO_MIN = -180;
const FUSO_TEXTO = "-03:00";
const SUFIXO_ANCORA = ".relogio";

export interface Relogio {
  agora(): Date;
  agoraISO(): string;
  hojeISO(): string;
}

export interface OpcoesRelogio {
  /** Instante ISO de partida do relógio da demo. Sem ele, hora real. */
  demoAgora?: string;
  /** Arquivo da âncora. Sem ele, a âncora fica só em memória. */
  arquivoAncora?: string;
  /** Fonte do tempo real em ms (para teste). */
  tempoReal?: () => number;
}

interface Ancora {
  demoAgora: string;
  realMs: number;
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** Instante → `2026-10-05T07:45:00-03:00`. */
export function paraISO(instante: Date): string {
  const local = new Date(instante.getTime() + FUSO_MIN * 60_000);
  const data = `${local.getUTCFullYear()}-${doisDigitos(local.getUTCMonth() + 1)}-${doisDigitos(local.getUTCDate())}`;
  const hora = `${doisDigitos(local.getUTCHours())}:${doisDigitos(local.getUTCMinutes())}:${doisDigitos(local.getUTCSeconds())}`;
  return `${data}T${hora}${FUSO_TEXTO}`;
}

/** Instante → `2026-10-05` (data em Brasília). */
export function paraDataISO(instante: Date): string {
  return paraISO(instante).slice(0, 10);
}

/** Caminho da âncora para um banco: `data/demo.db` → `data/demo.db.relogio`. */
export function arquivoAncoraDe(caminhoBanco: string): string {
  return `${caminhoBanco}${SUFIXO_ANCORA}`;
}

function lerAncora(arquivo: string, demoAgora: string): Ancora | null {
  try {
    const lida = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Partial<Ancora>;
    if (lida.demoAgora === demoAgora && typeof lida.realMs === "number") {
      return { demoAgora, realMs: lida.realMs };
    }
  } catch {
    // não existe ou está ilegível: quem chamou cria outra
  }
  return null;
}

function resolverAncora(arquivo: string | undefined, demoAgora: string, realMs: number): Ancora {
  const nova: Ancora = { demoAgora, realMs };
  if (!arquivo) return nova;

  const existente = lerAncora(arquivo, demoAgora);
  if (existente) return existente;

  // Publica o arquivo já completo (temporário + link): outro processo nunca lê pela metade.
  // O link só cria se não existir: se outro processo gravou primeiro, vale a dele.
  const temporario = `${arquivo}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporario, JSON.stringify(nova));
  } catch {
    return nova; // pasta inexistente ou sem permissão: segue em memória
  }
  try {
    fs.linkSync(temporario, arquivo);
    return nova;
  } catch {
    const deOutro = lerAncora(arquivo, demoAgora);
    if (deOutro) return deOutro;
    try {
      // arquivo de outra DEMO_AGORA ou ilegível: substitui
      fs.renameSync(temporario, arquivo);
    } catch {
      // segue em memória
    }
    return nova;
  } finally {
    fs.rmSync(temporario, { force: true });
  }
}

export function criarRelogio(opcoes: OpcoesRelogio = {}): Relogio {
  const tempoReal = opcoes.tempoReal ?? (() => Date.now());
  const demoAgora = opcoes.demoAgora?.trim() || undefined;

  let demoMs = 0;
  if (demoAgora) {
    // Exige o fuso: sem ele o Date.parse usaria o fuso da máquina (ou UTC, se vier só a data).
    const comFuso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(demoAgora);
    demoMs = comFuso ? Date.parse(demoAgora) : Number.NaN;
    if (Number.isNaN(demoMs)) {
      throw new Error(`DEMO_AGORA inválida: "${demoAgora}". Use ISO com fuso, ex.: 2026-10-05T07:45:00-03:00.`);
    }
  }

  let ancora: Ancora | null = null;

  function agora(): Date {
    const real = tempoReal();
    if (!demoAgora) return new Date(real);
    if (!ancora) ancora = resolverAncora(opcoes.arquivoAncora, demoAgora, real);
    return new Date(demoMs + (real - ancora.realMs));
  }

  return {
    agora,
    agoraISO: () => paraISO(agora()),
    hojeISO: () => paraDataISO(agora()),
  };
}

let padrao: Relogio | null = null;

function relogioPadrao(): Relogio {
  if (!padrao) {
    const banco = process.env.DB_PATH?.trim();
    padrao = criarRelogio({
      demoAgora: process.env.DEMO_AGORA,
      arquivoAncora: banco ? arquivoAncoraDe(banco) : undefined,
    });
  }
  return padrao;
}

/** Instante atual (relógio da demo, se DEMO_AGORA estiver definida). */
export function agora(): Date {
  return relogioPadrao().agora();
}

/** Instante atual em ISO com `-03:00`, do jeito que vai para o banco. */
export function agoraISO(): string {
  return relogioPadrao().agoraISO();
}

/** Data de hoje (`YYYY-MM-DD`) em Brasília. */
export function hojeISO(): string {
  return relogioPadrao().hojeISO();
}
