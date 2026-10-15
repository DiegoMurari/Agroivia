/**
 * Escala de equipes (D55): o gestor monta as equipes do dia, escreve nome por nome e imprime.
 * Todo nome digitado vira uma chapa cadastrada e passa a ser sugerido nas próximas montagens
 * e no boletim. Nome igual (sem contar maiúscula, acento e espaço a mais) é a mesma pessoa.
 */
import { and, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "@/lib/db";
import { TIPO_DIARIA, type TipoDiaria } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";
import { chaveDoNome, nomeLimpo } from "./nomes";

export { chaveDoNome, nomeLimpo };

/** Horário opcional: "HH:MM", ou vazio para não usar. */
const HORA = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o horário no formato HH:MM."), z.literal("")]).nullish();

export const esquemaEquipe = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  nome: z.string().trim().min(1, "Dê um nome para a equipe.").max(60),
  armazemId: z.number().int().positive().nullish(),
  tarefa: z.string().trim().max(200).nullish(),
  horarioInicio: HORA,
  horarioFim: HORA,
});
export type DadosEquipe = z.infer<typeof esquemaEquipe>;

export const esquemaNomeChapa = z.object({ nome: z.string().trim().min(2, "Escreva o nome do funcionário.").max(80), tipo: z.enum(TIPO_DIARIA).default("completa") });
export const esquemaTipoChapa = z.object({ membroId: z.number().int().positive(), tipo: z.enum(TIPO_DIARIA) });

export interface MembroEscala {
  id: number;
  chapaId: number;
  matricula: string;
  nome: string;
  tipo: TipoDiaria;
}
export interface EquipeEscala {
  id: number;
  data: string;
  nome: string;
  armazemId: number | null;
  tarefa: string | null;
  horarioInicio: string | null;
  horarioFim: string | null;
  membros: MembroEscala[];
}
export interface SugestaoChapa {
  chapaId: number;
  matricula: string;
  nome: string;
  /** Em quantas escalas já apareceu. */
  vezes: number;
}

function proximaMatricula(db: Db): string {
  const usadas = new Set(db.select({ m: schema.chapa.matricula }).from(schema.chapa).all().map((c) => c.m));
  for (let n = usadas.size + 1; ; n++) {
    const m = `E${String(n).padStart(3, "0")}`;
    if (!usadas.has(m)) return m;
  }
}

/** Acha a chapa pelo nome ou cadastra uma nova (matrícula gerada). Reativa se estava inativa. */
export function chapaPorNome(db: Db, nomeDigitado: string) {
  const nome = nomeLimpo(nomeDigitado);
  const chave = chaveDoNome(nome);
  if (chave.length < 2) throw new ErroDeRegra("Escreva o nome do funcionário.", { status: 400, campos: { nome: "Nome obrigatório." } });
  const existente = db.select().from(schema.chapa).all().find((c) => chaveDoNome(c.nome) === chave);
  if (existente) {
    if (!existente.ativo) return db.update(schema.chapa).set({ ativo: true }).where(eq(schema.chapa.id, existente.id)).returning().get();
    return existente;
  }
  return db.insert(schema.chapa).values({ matricula: proximaMatricula(db), nome }).returning().get();
}

/** Chapas ativas, as mais escaladas primeiro: é a lista de sugestões do campo de nome. */
export function sugestoesDeChapas(db: Db): SugestaoChapa[] {
  const vezes = new Map<number, number>();
  for (const r of db.select({ chapaId: schema.equipeChapa.chapaId, n: sql<number>`count(*)` }).from(schema.equipeChapa).groupBy(schema.equipeChapa.chapaId).all()) vezes.set(r.chapaId, r.n);
  return db
    .select()
    .from(schema.chapa)
    .where(eq(schema.chapa.ativo, true))
    .all()
    .map((c) => ({ chapaId: c.id, matricula: c.matricula, nome: c.nome, vezes: vezes.get(c.id) ?? 0 }))
    .sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function lerEscala(db: Db, data: string): EquipeEscala[] {
  const equipes = db.select().from(schema.equipe).where(eq(schema.equipe.data, data)).all().sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  if (equipes.length === 0) return [];
  const membros = db
    .select({ id: schema.equipeChapa.id, equipeId: schema.equipeChapa.equipeId, ordem: schema.equipeChapa.ordem, tipo: schema.equipeChapa.tipoDiaria, chapaId: schema.chapa.id, matricula: schema.chapa.matricula, nome: schema.chapa.nome })
    .from(schema.equipeChapa)
    .innerJoin(schema.chapa, eq(schema.chapa.id, schema.equipeChapa.chapaId))
    .where(inArray(schema.equipeChapa.equipeId, equipes.map((e) => e.id)))
    .all()
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  return equipes.map((e) => ({
    id: e.id,
    data: e.data,
    nome: e.nome,
    armazemId: e.armazemId,
    tarefa: e.tarefa,
    horarioInicio: e.horarioInicio,
    horarioFim: e.horarioFim,
    membros: membros.filter((m) => m.equipeId === e.id).map(({ id, chapaId, matricula, nome, tipo }) => ({ id, chapaId, matricula, nome, tipo })),
  }));
}

/** Último dia antes de `data` que tem escala (para "montar a partir da última"). */
export function ultimaEscalaAntes(db: Db, data: string): string | null {
  const r = db.select({ d: sql<string | null>`max(${schema.equipe.data})` }).from(schema.equipe).where(lt(schema.equipe.data, data)).get();
  return r?.d ?? null;
}

export function criarEquipe(db: Db, d: DadosEquipe, agora: string) {
  const nome = d.nome.trim();
  const repetida = db.select().from(schema.equipe).where(and(eq(schema.equipe.data, d.data), eq(schema.equipe.nome, nome))).get();
  if (repetida) throw new ErroDeRegra(`Já existe a equipe "${nome}" neste dia. Escolha outro nome.`, { campos: { nome: "Nome já usado neste dia." } });
  const ordem = db.select().from(schema.equipe).where(eq(schema.equipe.data, d.data)).all().length;
  return db.insert(schema.equipe).values({ data: d.data, nome, armazemId: d.armazemId ?? null, tarefa: d.tarefa?.trim() || null, horarioInicio: d.horarioInicio || null, horarioFim: d.horarioFim || null, ordem, criadoEm: agora, origem: origemPadrao() }).returning().get();
}

export function editarEquipe(db: Db, id: number, d: Pick<DadosEquipe, "nome" | "armazemId" | "tarefa" | "horarioInicio" | "horarioFim">) {
  const atual = db.select().from(schema.equipe).where(eq(schema.equipe.id, id)).get();
  if (!atual) throw new ErroDeRegra("Equipe não encontrada.", { status: 404 });
  const nome = d.nome.trim();
  const outra = db.select().from(schema.equipe).where(and(eq(schema.equipe.data, atual.data), eq(schema.equipe.nome, nome))).get();
  if (outra && outra.id !== id) throw new ErroDeRegra(`Já existe a equipe "${nome}" neste dia.`, { campos: { nome: "Nome já usado neste dia." } });
  return db.update(schema.equipe).set({ nome, armazemId: d.armazemId ?? null, tarefa: d.tarefa?.trim() || null, horarioInicio: d.horarioInicio || null, horarioFim: d.horarioFim || null }).where(eq(schema.equipe.id, id)).returning().get();
}

export function removerEquipe(db: Db, id: number) {
  db.transaction((tx) => {
    tx.delete(schema.equipeChapa).where(eq(schema.equipeChapa.equipeId, id)).run();
    tx.delete(schema.equipe).where(eq(schema.equipe.id, id)).run();
  });
}

/** Escreve o nome na equipe: a chapa é cadastrada na hora se for nova. Uma chapa só em uma equipe por dia. */
export function adicionarChapaNaEquipe(db: Db, equipeId: number, nomeDigitado: string, tipo: TipoDiaria = "completa") {
  return db.transaction((tx) => {
    const eq_ = tx.select().from(schema.equipe).where(eq(schema.equipe.id, equipeId)).get();
    if (!eq_) throw new ErroDeRegra("Equipe não encontrada.", { status: 404 });
    const chapa = chapaPorNome(tx as unknown as Db, nomeDigitado);
    const ja = tx.select().from(schema.equipeChapa).where(and(eq(schema.equipeChapa.chapaId, chapa.id), eq(schema.equipeChapa.data, eq_.data))).get();
    if (ja) {
      const onde = tx.select().from(schema.equipe).where(eq(schema.equipe.id, ja.equipeId)).get();
      throw new ErroDeRegra(ja.equipeId === equipeId ? `${chapa.nome} já está nesta equipe.` : `${chapa.nome} já está na equipe ${onde?.nome} neste dia. Tire de lá antes.`, { campos: { nome: "Funcionário já escalada." } });
    }
    const ordem = tx.select().from(schema.equipeChapa).where(eq(schema.equipeChapa.equipeId, equipeId)).all().length;
    tx.insert(schema.equipeChapa).values({ equipeId, chapaId: chapa.id, data: eq_.data, ordem, tipoDiaria: tipo }).run();
    return { chapa };
  });
}

/** Troca entre meia e diária inteira de quem já está na equipe. */
export function mudarTipoDaChapa(db: Db, equipeId: number, membroId: number, tipo: TipoDiaria) {
  db.update(schema.equipeChapa).set({ tipoDiaria: tipo }).where(and(eq(schema.equipeChapa.id, membroId), eq(schema.equipeChapa.equipeId, equipeId))).run();
}

export function removerChapaDaEquipe(db: Db, equipeId: number, membroId: number) {
  db.delete(schema.equipeChapa).where(and(eq(schema.equipeChapa.id, membroId), eq(schema.equipeChapa.equipeId, equipeId))).run();
}

/** Copia equipes e chapas de um dia para outro vazio (a escala de ontem é o ponto de partida de hoje). */
export function copiarEscala(db: Db, de: string, para: string, agora: string): number {
  if (de === para) throw new ErroDeRegra("Escolha um dia diferente para copiar.", { status: 400 });
  if (db.select().from(schema.equipe).where(eq(schema.equipe.data, para)).all().length > 0) throw new ErroDeRegra("Este dia já tem equipes. Apague as equipes antes de copiar outra escala.");
  const origem = lerEscala(db, de);
  if (origem.length === 0) throw new ErroDeRegra("Não há escala nesse dia para copiar.", { status: 404 });
  db.transaction((tx) => {
    for (const e of origem) {
      const nova = criarEquipe(tx as unknown as Db, { data: para, nome: e.nome, armazemId: e.armazemId, tarefa: e.tarefa, horarioInicio: e.horarioInicio, horarioFim: e.horarioFim }, agora);
      e.membros.forEach((m, ordem) => tx.insert(schema.equipeChapa).values({ equipeId: nova.id, chapaId: m.chapaId, data: para, ordem, tipoDiaria: m.tipo }).run());
    }
  });
  return origem.length;
}

/** Quantas equipes e chapas cada dia do mês tem (para o calendário). `mes` é AAAA-MM. */
export function resumoDoMes(db: Db, mes: string): Record<string, { equipes: number; chapas: number }> {
  const de = `${mes}-01`;
  const ate = `${mes}-31`;
  const resumo: Record<string, { equipes: number; chapas: number }> = {};
  for (const e of db.select({ data: schema.equipe.data }).from(schema.equipe).where(and(gte(schema.equipe.data, de), lte(schema.equipe.data, ate))).all()) {
    resumo[e.data] = { equipes: (resumo[e.data]?.equipes ?? 0) + 1, chapas: resumo[e.data]?.chapas ?? 0 };
  }
  for (const m of db.select({ data: schema.equipeChapa.data }).from(schema.equipeChapa).where(and(gte(schema.equipeChapa.data, de), lte(schema.equipeChapa.data, ate))).all()) {
    if (resumo[m.data]) resumo[m.data].chapas += 1;
  }
  return resumo;
}
