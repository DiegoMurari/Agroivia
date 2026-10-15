/**
 * Relatório de chegadas (grupo 6): pontualidade do dia e da semana por armazém. Só LEITURA.
 * Refaz a conta do atraso aqui (sem importar lib/agendamento): chegada até horário + tolerância é
 * "no horário" (30 min não é atraso, 31 é, D27). Chegada = agendamento.chegada_em ou o evento `chegou`.
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { deInteiro, dividir, formatNumero, multiplicar } from "@/lib/money";

export interface BlocoChegadas {
  armazem: string;
  noHorario: number;
  atrasado: number;
  naoVeio: number;
  semAgendamento: number;
  /** no horário + atrasado + não veio (sem agendamento e a vir ficam de fora). */
  contados: number;
  /** Inteiro em texto, ou nulo sem dados. */
  pontualidadePct: string | null;
  /** Quantas chegadas de cada origem entraram no bloco. */
  origens: Record<string, number>;
}

export interface RelatorioChegadas {
  hoje: string;
  semanaInicio: string;
  semanaFim: string;
  dia: BlocoChegadas[];
  semana: BlocoChegadas[];
}

export const TODOS = "Todos os armazéns";
const SEM_DESTINO = "Sem destino definido";
const MIN = 60000;

/** Segunda a domingo da semana que contém a data (aritmética de calendário, sem hora atual). */
function semanaDe(data: string): [string, string] {
  const [a, m, d] = data.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  const deslocar = (n: number) => new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
  const volta = dow === 0 ? 6 : dow - 1;
  return [deslocar(-volta), deslocar(-volta + 6)];
}

type Classe = "noHorario" | "atrasado" | "naoVeio" | "semAgendamento" | null;

export function relatorioChegadas(db: Db, hoje: string, agoraISO: string): RelatorioChegadas {
  const [ini, fim] = semanaDe(hoje);
  const tolRow = db.select().from(schema.parametro).where(eq(schema.parametro.chave, "tolerancia_min")).get();
  const tol = Number.parseInt(tolRow?.valor ?? "", 10);
  const tolerancia = Number.isFinite(tol) ? tol : 30;

  const agendamentos = db.select().from(schema.agendamento).where(and(gte(schema.agendamento.data, ini), lte(schema.agendamento.data, fim))).all().filter((a) => a.status !== "cancelado" && a.aprovacao === "aprovado");
  const ids = agendamentos.map((a) => a.id);
  const armazens = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a.nome]));
  const destinos = ids.length ? db.select().from(schema.agendamentoArmazem).where(inArray(schema.agendamentoArmazem.agendamentoId, ids)).all() : [];
  const eventosChegou = new Map<number, string>();
  if (ids.length) {
    for (const e of db.select().from(schema.evento).where(inArray(schema.evento.agendamentoId, ids)).all()) {
      if (e.tipo !== "chegou") continue;
      const antes = eventosChegou.get(e.agendamentoId);
      if (!antes || e.criadoEm < antes) eventosChegou.set(e.agendamentoId, e.criadoEm);
    }
  }

  const agoraMs = new Date(agoraISO).getTime();
  const classificar = (a: (typeof agendamentos)[number]): Classe => {
    const chegada = a.chegadaEm ?? eventosChegou.get(a.id) ?? null;
    if (a.agendadoNaHora && chegada) return "semAgendamento";
    const limite = new Date(`${a.data}T${a.horario}:00-03:00`).getTime() + tolerancia * MIN;
    if (chegada) return new Date(chegada).getTime() <= limite ? "noHorario" : "atrasado";
    // Já entrou (status avançado) mas sem registro de chegada, como dado importado: sem dado, não distorce.
    if (a.status === "chegou" || a.status === "em_descarga" || a.status === "concluido") return null;
    if (a.status === "nao_recebido") return "naoVeio";
    if (a.data < hoje) return "naoVeio";
    return agoraMs > limite ? "atrasado" : null; // ainda dentro da tolerância ou no futuro: a vir
  };

  const classes = new Map(agendamentos.map((a) => [a.id, classificar(a)]));
  const destinosDe = (id: number): string[] => {
    const nomes = destinos.filter((d) => d.agendamentoId === id).map((d) => armazens.get(d.armazemId) ?? SEM_DESTINO);
    return nomes.length ? nomes : [SEM_DESTINO];
  };

  const montar = (de: string, ate: string): BlocoChegadas[] => {
    const blocos = new Map<string, BlocoChegadas>();
    const bloco = (nome: string): BlocoChegadas => {
      let b = blocos.get(nome);
      if (!b) {
        b = { armazem: nome, noHorario: 0, atrasado: 0, naoVeio: 0, semAgendamento: 0, contados: 0, pontualidadePct: null, origens: {} };
        blocos.set(nome, b);
      }
      return b;
    };
    bloco(TODOS);
    for (const a of db.select().from(schema.armazem).all()) if (a.ativo) bloco(a.nome);
    for (const a of agendamentos) {
      if (a.data < de || a.data > ate) continue;
      const c = classes.get(a.id);
      if (!c) continue;
      for (const nome of [TODOS, ...destinosDe(a.id)]) {
        const b = bloco(nome);
        b[c]++;
        b.origens[a.origem] = (b.origens[a.origem] ?? 0) + 1;
      }
    }
    for (const b of blocos.values()) {
      b.contados = b.noHorario + b.atrasado + b.naoVeio;
      b.pontualidadePct = b.contados === 0 ? null : formatNumero(dividir(multiplicar(deInteiro(b.noHorario), "100"), deInteiro(b.contados)), 0);
    }
    const lista = [...blocos.values()];
    return [lista.find((b) => b.armazem === TODOS)!, ...lista.filter((b) => b.armazem !== TODOS)];
  };

  return { hoje, semanaInicio: ini, semanaFim: fim, dia: montar(hoje, hoje), semana: montar(ini, fim) };
}
