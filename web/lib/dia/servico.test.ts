import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import type { AgendamentoStatus } from "@/lib/db/enums";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { situacaoDoDia } from "./servico";

let t: TestDb;
afterEach(() => t?.apagar());

const HOJE = "2026-10-05";
const em = (hhmm: string) => `${HOJE}T${hhmm}:00-03:00`;

function base() {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ razaoSocial: "Fornecedor Teste", origem: "teste" }).returning().get();
  const arm = t.db.select().from(schema.armazem).all();
  const adubo = arm.find((a) => a.nome === "Adubo")!;
  let n = 0;
  const novo = (horario: string, status: AgendamentoStatus, extra: Partial<typeof schema.agendamento.$inferInsert> = {}) =>
    t.db
      .insert(schema.agendamento)
      .values({ fornecedorId: f.id, data: HOJE, horario, acondicionamentoOcupacao: "unitizado", status, origem: "teste", criadoEm: em("06:00"), ...extra })
      .returning()
      .get();
  const nf = (agendamentoId: number, acond: "batido" | "paletizado" | "big_bag") => {
    const nota = t.db.insert(schema.notaFiscal).values({ chaveAcesso: `chave-${++n}`, origem: "teste", criadaEm: em("06:00") }).returning().get();
    t.db.insert(schema.agendamentoNf).values({ agendamentoId, notaFiscalId: nota.id, acondicionamento: acond }).run();
  };
  const porArmazem = (agendamentoId: number, entradaEm: string | null, saidaEm: string | null = null) =>
    t.db.insert(schema.agendamentoArmazem).values({ agendamentoId, armazemId: adubo.id, ordem: 1, entradaEm, saidaEm }).run();
  return { f, adubo, novo, nf, porArmazem };
}

describe("tela do dia", () => {
  it("atrasado: 30 min não é atraso, 31 é", () => {
    const { novo } = base();
    novo("08:00", "agendado");
    expect(situacaoDoDia(t.db, em("08:30")).atrasados).toHaveLength(0);
    const r = situacaoDoDia(t.db, em("08:31"));
    expect(r.atrasados).toHaveLength(1);
    expect(r.atrasados[0].atrasoMin).toBe(31);
  });

  it("em descarga: início, há quanto tempo e previsão pela norma (mista = a maior)", () => {
    const { novo, nf, porArmazem } = base();
    const a = novo("08:00", "em_descarga");
    nf(a.id, "batido"); // 45 min
    nf(a.id, "paletizado"); // 15 min
    porArmazem(a.id, em("08:10"));
    const r = situacaoDoDia(t.db, em("08:40"));
    expect(r.emDescarga).toHaveLength(1);
    expect(r.emDescarga[0]).toMatchObject({ agendamentoId: a.id, armazem: "Adubo", haMin: 30, previsaoFonte: "norma" });
    expect(r.emDescarga[0].previsaoFimEm).toBe("2026-10-05T08:55:00-03:00");
  });

  it("duracao_prevista_min do agendamento vale no lugar da norma; sem norma, sem previsão", () => {
    const { novo, nf, porArmazem } = base();
    const a = novo("08:00", "em_descarga", { duracaoPrevistaMin: 100 });
    nf(a.id, "batido");
    porArmazem(a.id, em("08:00"));
    const sem = novo("10:00", "em_descarga");
    porArmazem(sem.id, em("10:00"));
    const r = situacaoDoDia(t.db, em("10:20"));
    const comPrevisao = r.emDescarga.find((x) => x.agendamentoId === a.id)!;
    expect(comPrevisao).toMatchObject({ previsaoFonte: "agendamento", previsaoFimEm: "2026-10-05T09:40:00-03:00" });
    expect(r.emDescarga.find((x) => x.agendamentoId === sem.id)).toMatchObject({ previsaoFimEm: null, previsaoFonte: null });
  });

  it("concluído, cancelado e armazém já liberado não aparecem em descarga; pendência aberta aparece", () => {
    const { novo, porArmazem } = base();
    const concluido = novo("08:00", "concluido");
    porArmazem(concluido.id, em("08:00"), em("08:30"));
    const cancelado = novo("10:00", "cancelado");
    porArmazem(cancelado.id, em("10:00"));
    const p = novo("13:00", "chegou");
    t.db.insert(schema.pendencia).values({ agendamentoId: p.id, tipo: "divergencia_nf_pedido", descricao: "Peso diferente", abertaEm: em("09:00") }).run();
    t.db.insert(schema.pendencia).values({ agendamentoId: p.id, tipo: "outra", status: "resolvida", abertaEm: em("09:00") }).run();
    const r = situacaoDoDia(t.db, em("11:00"));
    expect(r.emDescarga).toHaveLength(0);
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({ agendamentoId: p.id, fornecedor: "Fornecedor Teste" });
    expect(r.agendamentos.map((x) => x.status)).toEqual(["concluido", "cancelado", "chegou"]);
    expect(r.atrasados).toHaveLength(0);
  });

  it("só mostra os agendamentos do dia do relógio", () => {
    const { novo } = base();
    novo("08:00", "agendado", { data: "2026-10-06" });
    expect(situacaoDoDia(t.db, em("07:00")).agendamentos).toHaveLength(0);
  });
});
