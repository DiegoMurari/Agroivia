/**
 * Serviço do boletim (RF2-01 a RF2-10, D43). Recebe `db` e o instante por parâmetro.
 * O servidor sempre recalcula com calculo.ts e nunca confia em total vindo do cliente.
 */
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";
import { dec } from "@/lib/money";
import { calcularBoletim, ErroBoletim, type ResultadoBoletim } from "./calculo";
import { parametrosBoletim, type ParametrosBoletim } from "./params";
import type { BoletimParaSoma } from "./dia";

export interface LinhaDados {
  tipoItemId: number;
  descarga?: string;
  remocao?: string;
  transferencia?: string;
}

export interface EquipeDados {
  matricula: string;
  tipo: "completa" | "meia";
}

export interface DadosBoletim {
  armazemId: number;
  /** YYYY-MM-DD */
  data: string;
  linhas: LinhaDados[];
  equipe: EquipeDados[];
  responsavel?: string | null;
  observacao?: string | null;
}

export interface LinhaDetalhe {
  tipoItemId: number;
  nome: string;
  categoria: string;
  qtdDescarga: string;
  qtdRemocao: string;
  qtdTransferencia: string;
  quantidadeTotal: string;
  precoUsado: string;
  valor: string;
}

export interface ChapaDetalhe {
  chapaId: number;
  matricula: string;
  nome: string;
  tipo: "completa" | "meia";
}

export type BoletimResumo = typeof schema.boletim.$inferSelect & { armazemNome: string; abaixoDoPiso: boolean };

export interface BoletimDetalhe extends BoletimResumo {
  linhas: LinhaDetalhe[];
  equipe: ChapaDetalhe[];
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function lerParametros(db: Db): ParametrosBoletim {
  const tabela: Record<string, string> = {};
  for (const p of db.select().from(schema.parametro).all()) tabela[p.chave] = p.valor;
  return parametrosBoletim(tabela);
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Valida e calcula tudo; só lê. Lança ErroDeRegra com a causa e como corrigir. */
function preparar(db: Db | Tx, dados: DadosBoletim, ignorarId: number | null) {
  if (!dataValida(dados.data)) throw new ErroDeRegra("A data do boletim é inválida. Use uma data real, ex.: 2025-11-17.", { status: 400, campos: { data: "Data inválida." } });

  const armazem = db.select().from(schema.armazem).where(eq(schema.armazem.id, dados.armazemId)).get();
  if (!armazem) throw new ErroDeRegra("Armazém não encontrado. Escolha um armazém da lista.", { status: 400, campos: { armazemId: "Armazém não encontrado." } });
  // Corrigir um boletim já lançado não pode ser barrado por cadastro que mudou depois (armazém e chapas dele).
  const atual = ignorarId === null ? undefined : db.select().from(schema.boletim).where(eq(schema.boletim.id, ignorarId)).get();
  const mesmoArmazem = atual?.armazemId === armazem.id;
  const chapasDele = new Set(
    ignorarId === null ? [] : db.select().from(schema.boletimChapa).where(eq(schema.boletimChapa.boletimId, ignorarId)).all().map((x) => x.chapaId),
  );
  if (!armazem.fazBoletim && !mesmoArmazem) {
    throw new ErroDeRegra(`O armazém ${armazem.nome} não faz boletim de produção. Escolha um armazém que faz boletim ou ajuste o cadastro.`, { campos: { armazemId: "Armazém não faz boletim." } });
  }
  if (!armazem.ativo && !mesmoArmazem) throw new ErroDeRegra(`O armazém ${armazem.nome} está inativo. Reative-o em Cadastros ou escolha outro.`, { campos: { armazemId: "Armazém inativo." } });

  const mesmoDia = db
    .select()
    .from(schema.boletim)
    .where(and(eq(schema.boletim.armazemId, armazem.id), eq(schema.boletim.data, dados.data)))
    .all()
    .find((b) => b.id !== ignorarId);
  if (mesmoDia) {
    throw new ErroDeRegra(`Já existe um boletim do ${armazem.nome} em ${dataBR(dados.data)}. Abra o boletim existente para corrigir, em vez de criar outro.`, { detalhe: { boletimId: mesmoDia.id } });
  }

  // Linhas: tipo_item existente, sem repetir, preço lido do cadastro.
  const ids = dados.linhas.map((l) => l.tipoItemId);
  if (new Set(ids).size !== ids.length) throw new ErroDeRegra("Há dois lançamentos para a mesma linha do formulário. Junte as quantidades em um só.", { status: 400 });
  const tipos = ids.length ? db.select().from(schema.tipoItem).where(inArray(schema.tipoItem.id, ids)).all() : [];
  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  for (const l of dados.linhas) {
    if (!tipoPorId.has(l.tipoItemId)) throw new ErroDeRegra(`A linha do formulário ${l.tipoItemId} não existe. Recarregue a página e tente de novo.`, { status: 400 });
  }

  // Equipe: matrículas existentes e ativas.
  const matriculas = dados.equipe.map((e) => e.matricula);
  const chapas = matriculas.length ? db.select().from(schema.chapa).where(inArray(schema.chapa.matricula, matriculas)).all() : [];
  const chapaPorMatricula = new Map(chapas.map((c) => [c.matricula, c]));
  for (const m of matriculas) {
    const c = chapaPorMatricula.get(m);
    if (!c) throw new ErroDeRegra(`A matrícula ${m} não está no cadastro de funcionários. Confira o número ou cadastre o funcionário em Cadastros.`, { status: 400, campos: { equipe: `Matrícula ${m} desconhecida.` } });
    if (!c.ativo && !chapasDele.has(c.id)) throw new ErroDeRegra(`O funcionário ${m} (${c.nome}) está inativa. Reative-a em Cadastros ou tire-a da equipe.`, { campos: { equipe: `Funcionário ${m} inativa.` } });
  }

  const parametros = lerParametros(db as Db);
  let resultado: ResultadoBoletim;
  try {
    resultado = calcularBoletim({
      linhas: dados.linhas.map((l) => ({ preco: tipoPorId.get(l.tipoItemId)!.precoUnitario, descarga: l.descarga, remocao: l.remocao, transferencia: l.transferencia })),
      equipe: dados.equipe,
      parametros,
    });
  } catch (e) {
    if (e instanceof ErroBoletim) throw new ErroDeRegra(e.message, { status: 422 });
    throw e;
  }

  // Chapa em um só boletim por dia (T8).
  for (const m of matriculas) {
    const c = chapaPorMatricula.get(m)!;
    const ocupada = db
      .select()
      .from(schema.boletimChapa)
      .where(and(eq(schema.boletimChapa.chapaId, c.id), eq(schema.boletimChapa.data, dados.data), ignorarId === null ? undefined : ne(schema.boletimChapa.boletimId, ignorarId)))
      .get();
    if (ocupada) {
      const outro = db.select().from(schema.boletim).where(eq(schema.boletim.id, ocupada.boletimId)).get()!;
      const nomeOutro = db.select().from(schema.armazem).where(eq(schema.armazem.id, outro.armazemId)).get()?.nome ?? "outro armazém";
      throw new ErroDeRegra(`O funcionário ${m} já está no boletim do ${nomeOutro} em ${dataBR(dados.data)}. Tire-o de um dos dois.`, { campos: { equipe: `Funcionário ${m} já está em outro boletim.` } });
    }
  }

  return { armazem, tipoPorId, chapaPorMatricula, resultado, parametros };
}

function gravar(tx: Tx, id: number, dados: DadosBoletim, p: ReturnType<typeof preparar>) {
  tx.delete(schema.boletimLinha).where(eq(schema.boletimLinha.boletimId, id)).run();
  tx.delete(schema.boletimChapa).where(eq(schema.boletimChapa.boletimId, id)).run();
  dados.linhas.forEach((l, i) => {
    const calc = p.resultado.linhas[i];
    tx.insert(schema.boletimLinha)
      .values({
        boletimId: id,
        tipoItemId: l.tipoItemId,
        qtdDescarga: dec(l.descarga?.trim() || "0").toFixed(),
        qtdRemocao: dec(l.remocao?.trim() || "0").toFixed(),
        qtdTransferencia: dec(l.transferencia?.trim() || "0").toFixed(),
        quantidadeTotal: calc.quantidade,
        precoUsado: p.tipoPorId.get(l.tipoItemId)!.precoUnitario,
        valor: calc.valor,
      })
      .run();
  });
  for (const e of dados.equipe) {
    tx.insert(schema.boletimChapa)
      .values({ boletimId: id, chapaId: p.chapaPorMatricula.get(e.matricula)!.id, data: dados.data, tipoDiaria: e.tipo })
      .run();
  }
}

function valoresCalculados(dados: DadosBoletim, p: ReturnType<typeof preparar>) {
  return {
    armazemId: p.armazem.id,
    data: dados.data,
    producaoTotal: p.resultado.producaoTotal,
    diariasEquivalentes: p.resultado.diariasEquivalentes,
    valorPorDiaria: p.resultado.valorPorDiaria,
    totalAPagar: p.resultado.totalAPagar,
    complemento: p.resultado.complemento,
    pisoUsado: p.parametros.piso,
    fatorMeiaUsado: p.parametros.fatorMeia,
    responsavel: dados.responsavel ?? null,
    observacao: dados.observacao ?? null,
  };
}

export function criarBoletim(db: Db, dados: DadosBoletim, agoraISO: string): BoletimDetalhe {
  const id = db.transaction(
    (tx) => {
      const p = preparar(tx, dados, null);
      const novo = tx
        .insert(schema.boletim)
        .values({ ...valoresCalculados(dados, p), status: "rascunho", origem: origemPadrao(), criadoEm: agoraISO })
        .returning({ id: schema.boletim.id })
        .get();
      gravar(tx, novo.id, dados, p);
      return novo.id;
    },
    { behavior: "immediate" },
  );
  return lerBoletim(db, id)!;
}

/** Salvar: regrava linhas e equipe e recalcula, na mesma transação. Boletim fechado só depois de reaberto (RF2-10). */
export function salvarBoletim(db: Db, id: number, dados: DadosBoletim, agoraISO: string): BoletimDetalhe {
  db.transaction(
    (tx) => {
      const atual = tx.select().from(schema.boletim).where(eq(schema.boletim.id, id)).get();
      if (!atual) throw new ErroDeRegra("Boletim não encontrado. Volte à lista e abra de novo.", { status: 404 });
      if (atual.status === "fechado") throw new ErroDeRegra("Este boletim está fechado. Reabra o boletim para corrigir e salve de novo.");
      const p = preparar(tx, dados, id);
      tx.update(schema.boletim).set({ ...valoresCalculados(dados, p), atualizadoEm: agoraISO }).where(eq(schema.boletim.id, id)).run();
      gravar(tx, id, dados, p);
    },
    { behavior: "immediate" },
  );
  return lerBoletim(db, id)!;
}

export function fecharBoletim(db: Db, id: number, agoraISO: string): BoletimDetalhe {
  db.transaction(
    (tx) => {
      const atual = tx.select().from(schema.boletim).where(eq(schema.boletim.id, id)).get();
      if (!atual) throw new ErroDeRegra("Boletim não encontrado. Volte à lista e abra de novo.", { status: 404 });
      if (atual.status === "fechado") return;
      tx.update(schema.boletim).set({ status: "fechado", fechadoEm: agoraISO, atualizadoEm: agoraISO }).where(eq(schema.boletim.id, id)).run();
    },
    { behavior: "immediate" },
  );
  return lerBoletim(db, id)!;
}

export function reabrirBoletim(db: Db, id: number, agoraISO: string): BoletimDetalhe {
  db.transaction(
    (tx) => {
      const atual = tx.select().from(schema.boletim).where(eq(schema.boletim.id, id)).get();
      if (!atual) throw new ErroDeRegra("Boletim não encontrado. Volte à lista e abra de novo.", { status: 404 });
      if (atual.status === "rascunho") return;
      tx.update(schema.boletim).set({ status: "rascunho", fechadoEm: null, atualizadoEm: agoraISO }).where(eq(schema.boletim.id, id)).run();
    },
    { behavior: "immediate" },
  );
  return lerBoletim(db, id)!;
}

function resumo(b: typeof schema.boletim.$inferSelect, armazemNome: string): BoletimResumo {
  return { ...b, armazemNome, abaixoDoPiso: dec(b.complemento).gt(0) };
}

export function lerBoletim(db: Db, id: number): BoletimDetalhe | null {
  const b = db.select().from(schema.boletim).where(eq(schema.boletim.id, id)).get();
  if (!b) return null;
  const armazemNome = db.select().from(schema.armazem).where(eq(schema.armazem.id, b.armazemId)).get()?.nome ?? "";
  const tipos = new Map(db.select().from(schema.tipoItem).all().map((t) => [t.id, t]));
  const linhas = db
    .select()
    .from(schema.boletimLinha)
    .where(eq(schema.boletimLinha.boletimId, id))
    .all()
    .map((l): LinhaDetalhe => ({
      tipoItemId: l.tipoItemId,
      nome: tipos.get(l.tipoItemId)?.nome ?? "",
      categoria: tipos.get(l.tipoItemId)?.categoria ?? "item",
      qtdDescarga: l.qtdDescarga,
      qtdRemocao: l.qtdRemocao,
      qtdTransferencia: l.qtdTransferencia,
      quantidadeTotal: l.quantidadeTotal,
      precoUsado: l.precoUsado,
      valor: l.valor,
    }))
    .sort((a, b2) => (tipos.get(a.tipoItemId)?.ordem ?? 0) - (tipos.get(b2.tipoItemId)?.ordem ?? 0));
  const chapas = new Map(db.select().from(schema.chapa).all().map((c) => [c.id, c]));
  const equipe = db
    .select()
    .from(schema.boletimChapa)
    .where(eq(schema.boletimChapa.boletimId, id))
    .all()
    .map((e): ChapaDetalhe => ({ chapaId: e.chapaId, matricula: chapas.get(e.chapaId)?.matricula ?? "", nome: chapas.get(e.chapaId)?.nome ?? "", tipo: e.tipoDiaria }))
    .sort((a, b2) => a.matricula.localeCompare(b2.matricula, "pt-BR", { numeric: true }));
  return { ...resumo(b, armazemNome), linhas, equipe };
}

export function listarBoletins(db: Db, filtro: { data?: string; armazemId?: number } = {}): BoletimResumo[] {
  const condicoes = [filtro.data ? eq(schema.boletim.data, filtro.data) : undefined, filtro.armazemId ? eq(schema.boletim.armazemId, filtro.armazemId) : undefined];
  const nomes = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a.nome]));
  return db
    .select()
    .from(schema.boletim)
    .where(and(...condicoes))
    .all()
    .map((b) => resumo(b, nomes.get(b.armazemId) ?? ""))
    .sort((a, b) => b.data.localeCompare(a.data) || a.armazemNome.localeCompare(b.armazemNome, "pt-BR"));
}

/** Armazéns que aceitam boletim (ativos e com faz_boletim). */
export function armazensDoBoletim(db: Db) {
  return db
    .select()
    .from(schema.armazem)
    .where(and(eq(schema.armazem.fazBoletim, true), eq(schema.armazem.ativo, true)))
    .all()
    .sort((a, b) => a.ordem - b.ordem);
}

/** As 16 linhas do formulário, na ordem do cadastro. */
export function tiposDoFormulario(db: Db) {
  return db.select().from(schema.tipoItem).where(eq(schema.tipoItem.ativo, true)).all().sort((a, b) => a.ordem - b.ordem);
}

export function chapasAtivas(db: Db) {
  return db.select().from(schema.chapa).where(eq(schema.chapa.ativo, true)).all().sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true }));
}

/** Boletins de um intervalo de datas (inclusive), com o número de chapas de cada um, prontos para somar por dia. */
export function boletinsParaSoma(db: Db, de: string, ate: string): BoletimParaSoma[] {
  const chapasPorBoletim = new Map<number, number>();
  for (const e of db.select().from(schema.boletimChapa).all()) chapasPorBoletim.set(e.boletimId, (chapasPorBoletim.get(e.boletimId) ?? 0) + 1);
  return db
    .select()
    .from(schema.boletim)
    .where(and(gte(schema.boletim.data, de), lte(schema.boletim.data, ate)))
    .all()
    .map((b) => ({ id: b.id, data: b.data, producaoTotal: b.producaoTotal, totalAPagar: b.totalAPagar, complemento: b.complemento, chapas: chapasPorBoletim.get(b.id) ?? 0 }));
}
