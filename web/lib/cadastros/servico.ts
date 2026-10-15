/**
 * Cadastros (RF1-25, D40): armazéns, equipamentos e chapas. Nada se apaga: usa-se `ativo`.
 * Grade de horários, feriados e parâmetros são só consulta.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "@/lib/db";
import { EQUIPAMENTO_STATUS } from "@/lib/db/enums";
import { ErroDeRegra } from "@/lib/http";

const nome = z.string().trim().min(1, "Informe o nome.");
const opcional = z.string().trim().nullish().transform((v) => (v ? v : null));
const idOpcional = z.number().int().positive().nullish().transform((v) => v ?? null);

export const esquemaArmazem = z.object({
  nome,
  localFisico: opcional,
  fazBoletim: z.boolean(),
  recebeDescarga: z.boolean().default(true),
  ativo: z.boolean().default(true),
});

export const esquemaEquipamento = z
  .object({
    armazemId: z.number().int().positive("Escolha o armazém."),
    nome,
    finalidade: opcional,
    quantidade: z.number().int().min(0, "A quantidade não pode ser negativa."),
    disponivel: z.number().int().min(0, "O disponível não pode ser negativo."),
    indisponivelMotivo: opcional,
    status: z.enum(EQUIPAMENTO_STATUS, { error: "Escolha Operacional ou Manutenção." }).default("operacional"),
  })
  .refine((e) => e.disponivel <= e.quantidade, { path: ["disponivel"], message: "O disponível não pode passar da quantidade. Ajuste um dos dois." });

export const esquemaChapa = z.object({
  matricula: z.string().trim().min(1, "Informe a matrícula."),
  nome,
  armazemId: idOpcional,
  ativo: z.boolean().default(true),
});

export type DadosArmazem = z.infer<typeof esquemaArmazem>;
export type DadosEquipamento = z.infer<typeof esquemaEquipamento>;
export type DadosChapa = z.infer<typeof esquemaChapa>;

const igualTexto = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const naoEncontrado = (o: string) => new ErroDeRegra(`${o} não encontrado. Recarregue a página e tente de novo.`, { status: 404 });

export function listarArmazens(db: Db) {
  return db.select().from(schema.armazem).all().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function listarEquipamentos(db: Db) {
  const nomes = new Map(listarArmazens(db).map((a) => [a.id, a.nome]));
  return db
    .select()
    .from(schema.equipamento)
    .all()
    .map((e) => ({ ...e, armazemNome: nomes.get(e.armazemId) ?? "" }))
    .sort((a, b) => Number(b.status === "manutencao") - Number(a.status === "manutencao") || a.armazemNome.localeCompare(b.armazemNome, "pt-BR") || (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"));
}

/** Quantos equipamentos estão em manutenção (para o alerta no alto de Cadastros). */
export function contarManutencao(db: Db): number {
  return db.select().from(schema.equipamento).all().filter((e) => e.status === "manutencao").length;
}

export function listarChapas(db: Db) {
  return db.select().from(schema.chapa).all().sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true }));
}

export function consultas(db: Db) {
  return {
    horarios: db.select().from(schema.horarioGrade).all().sort((a, b) => a.ordem - b.ordem),
    feriados: db.select().from(schema.feriado).all().sort((a, b) => a.data.localeCompare(b.data)),
    parametros: db.select().from(schema.parametro).all().sort((a, b) => a.chave.localeCompare(b.chave)),
  };
}

function checarNomeArmazem(db: Db, nomeNovo: string, ignorarId: number | null) {
  const outro = db.select().from(schema.armazem).all().find((a) => a.id !== ignorarId && igualTexto(a.nome, nomeNovo));
  if (outro) throw new ErroDeRegra(`Já existe um armazém chamado ${outro.nome}. Use outro nome ou edite o existente.`, { campos: { nome: "Nome já usado." } });
}

export function criarArmazem(db: Db, d: DadosArmazem) {
  return db.transaction(
    (tx) => {
      checarNomeArmazem(tx as unknown as Db, d.nome, null);
      const ordem = tx.select().from(schema.armazem).all().reduce((m, a) => Math.max(m, a.ordem), 0) + 1;
      return tx.insert(schema.armazem).values({ nome: d.nome, localFisico: d.localFisico, fazBoletim: d.fazBoletim, recebeDescarga: d.recebeDescarga, ativo: d.ativo, ordem }).returning().get();
    },
    { behavior: "immediate" },
  );
}

export function editarArmazem(db: Db, id: number, d: DadosArmazem) {
  return db.transaction(
    (tx) => {
      if (!tx.select().from(schema.armazem).where(eq(schema.armazem.id, id)).get()) throw naoEncontrado("Armazém");
      checarNomeArmazem(tx as unknown as Db, d.nome, id);
      return tx.update(schema.armazem).set({ nome: d.nome, localFisico: d.localFisico, fazBoletim: d.fazBoletim, recebeDescarga: d.recebeDescarga, ativo: d.ativo }).where(eq(schema.armazem.id, id)).returning().get();
    },
    { behavior: "immediate" },
  );
}

export function criarEquipamento(db: Db, d: DadosEquipamento) {
  return db.transaction(
    (tx) => {
      if (!tx.select().from(schema.armazem).where(eq(schema.armazem.id, d.armazemId)).get()) throw new ErroDeRegra("Armazém não encontrado. Escolha um da lista.", { status: 400 });
      if (!nomeDeEquipamentoLivre(tx as unknown as Db, d.armazemId, d.nome, null)) throw new ErroDeRegra("Já existe um equipamento com este nome neste armazém. Cada equipamento é único: use outro nome.", { campos: { nome: "Nome já usado neste armazém." } });
      return tx.insert(schema.equipamento).values({ armazemId: d.armazemId, nome: d.nome, finalidade: d.finalidade, quantidade: d.quantidade, disponivel: d.disponivel, indisponivelMotivo: d.indisponivelMotivo, status: d.status }).returning().get();
    },
    { behavior: "immediate" },
  );
}

export function editarEquipamento(db: Db, id: number, d: DadosEquipamento) {
  return db.transaction(
    (tx) => {
      if (!tx.select().from(schema.equipamento).where(eq(schema.equipamento.id, id)).get()) throw naoEncontrado("Equipamento");
      if (!tx.select().from(schema.armazem).where(eq(schema.armazem.id, d.armazemId)).get()) throw new ErroDeRegra("Armazém não encontrado. Escolha um da lista.", { status: 400 });
      if (!nomeDeEquipamentoLivre(tx as unknown as Db, d.armazemId, d.nome, id)) throw new ErroDeRegra("Já existe um equipamento com este nome neste armazém. Cada equipamento é único: use outro nome.", { campos: { nome: "Nome já usado neste armazém." } });
      return tx.update(schema.equipamento).set({ armazemId: d.armazemId, nome: d.nome, finalidade: d.finalidade, quantidade: d.quantidade, disponivel: d.disponivel, indisponivelMotivo: d.indisponivelMotivo, status: d.status }).where(eq(schema.equipamento.id, id)).returning().get();
    },
    { behavior: "immediate" },
  );
}

function checarChapa(tx: Db, d: DadosChapa, ignorarId: number | null) {
  const outra = tx.select().from(schema.chapa).all().find((c) => c.id !== ignorarId && c.matricula === d.matricula);
  if (outra) throw new ErroDeRegra(`A matrícula ${d.matricula} já é do funcionário ${outra.nome}. Confira o número ou edite o funcionário existente.`, { campos: { matricula: "Matrícula já usada." } });
  if (d.armazemId !== null && !tx.select().from(schema.armazem).where(eq(schema.armazem.id, d.armazemId)).get()) {
    throw new ErroDeRegra("Armazém de lotação não encontrado. Escolha um da lista.", { status: 400 });
  }
}

export function criarChapa(db: Db, d: DadosChapa) {
  return db.transaction(
    (tx) => {
      checarChapa(tx as unknown as Db, d, null);
      return tx.insert(schema.chapa).values({ matricula: d.matricula, nome: d.nome, armazemId: d.armazemId, ativo: d.ativo }).returning().get();
    },
    { behavior: "immediate" },
  );
}

export function editarChapa(db: Db, id: number, d: DadosChapa) {
  return db.transaction(
    (tx) => {
      if (!tx.select().from(schema.chapa).where(eq(schema.chapa.id, id)).get()) throw naoEncontrado("Funcionário");
      checarChapa(tx as unknown as Db, d, id);
      return tx.update(schema.chapa).set({ matricula: d.matricula, nome: d.nome, armazemId: d.armazemId, ativo: d.ativo }).where(eq(schema.chapa.id, id)).returning().get();
    },
    { behavior: "immediate" },
  );
}

// ───────────────────────── equipamentos únicos ─────────────────────────

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Cada equipamento é uma unidade só (quantidade 1). Linhas antigas com quantidade maior viram uma linha por unidade,
 * numeradas ("Trator 01", "Trator 02"). Quem está em manutenção mantém a situação; as unidades novas herdam o que
 * estava disponível. Idempotente: sem linha com quantidade maior que 1, não grava nada.
 */
export function garantirEquipamentosUnicos(db: Db): number {
  const multiplos = db.select().from(schema.equipamento).all().filter((e) => e.quantidade > 1);
  if (multiplos.length === 0) return 0;
  let criados = 0;
  db.transaction(
    (tx) => {
      for (const e of multiplos) {
        const base = (e.nome ?? "Equipamento").trim();
        const total = e.quantidade;
        const livres = e.status === "manutencao" ? 0 : Math.min(e.disponivel, total);
        for (let i = 1; i <= total; i++) {
          const operacional = i <= livres;
          const valores = {
            nome: `${base} ${doisDigitos(i)}`,
            quantidade: 1,
            disponivel: operacional ? 1 : 0,
            status: operacional ? "operacional" : "manutencao",
            indisponivelMotivo: operacional ? null : e.indisponivelMotivo,
          };
          if (i === 1) tx.update(schema.equipamento).set(valores).where(eq(schema.equipamento.id, e.id)).run();
          else {
            tx.insert(schema.equipamento).values({ armazemId: e.armazemId, finalidade: e.finalidade, ...valores }).run();
            criados++;
          }
        }
      }
    },
    { behavior: "immediate" },
  );
  return criados;
}

export function obterEquipamento(db: Db, id: number) {
  const e = db.select().from(schema.equipamento).where(eq(schema.equipamento.id, id)).get();
  if (!e) return null;
  const armazem = db.select().from(schema.armazem).where(eq(schema.armazem.id, e.armazemId)).get();
  const usos = db.select().from(schema.descargaEquipamento).where(eq(schema.descargaEquipamento.equipamentoId, id)).all();
  return { ...e, armazemNome: armazem?.nome ?? "", usos: usos.length };
}

/** O nome do equipamento é único dentro do armazém (sem diferenciar maiúscula). */
export function nomeDeEquipamentoLivre(db: Db, armazemId: number, nomeNovo: string, ignorarId: number | null): boolean {
  return !db
    .select()
    .from(schema.equipamento)
    .all()
    .some((e) => e.id !== ignorarId && e.armazemId === armazemId && igualTexto(e.nome ?? "", nomeNovo));
}
