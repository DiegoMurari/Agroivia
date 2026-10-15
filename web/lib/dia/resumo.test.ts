import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@/lib/db";
import type { AgendamentoStatus } from "@/lib/db/enums";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { resumoDoDia } from "./resumo";
import { situacaoDoDia } from "./servico";

let t: TestDb;
afterEach(() => t?.apagar());
const HOJE = "2026-10-05"; // segunda
const em = (data: string, hhmm: string) => `${data}T${hhmm}:00-03:00`;

function base() {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ razaoSocial: "Fornecedor A", origem: "teste" }).returning().get();
  const arm = (n: string) => t.db.select().from(schema.armazem).all().find((a) => a.nome === n)!;
  const novo = (data: string, horario: string, status: AgendamentoStatus, extra: Partial<typeof schema.agendamento.$inferInsert> = {}) =>
    t.db.insert(schema.agendamento).values({ fornecedorId: f.id, data, horario, acondicionamentoOcupacao: "unitizado", status, origem: "teste", criadoEm: em(data, "06:00"), ...extra }).returning().get();
  const destino = (agendamentoId: number, armazem: string, entrada: string | null, saida: string | null, chapas: number | null = null) =>
    t.db.insert(schema.agendamentoArmazem).values({ agendamentoId, armazemId: arm(armazem).id, ordem: 1, entradaEm: entrada, saidaEm: saida, chapasQtd: chapas }).returning().get();
  return { f, arm, novo, destino };
}

describe("resumo do dia", () => {
  it("conta hoje por estado e só considera pedidos aprovados", () => {
    const { novo } = base();
    novo(HOJE, "08:00", "agendado");
    novo(HOJE, "09:00", "em_descarga");
    novo(HOJE, "10:00", "concluido");
    novo(HOJE, "11:00", "cancelado");
    novo(HOJE, "13:00", "agendado", { aprovacao: "aguardando" });
    novo(HOJE, "15:00", "agendado", { aprovacao: "rascunho" });
    const r = resumoDoDia(t.db, HOJE);
    expect(r.hoje).toEqual({ total: 3, agendados: 1, emDescarga: 1, concluidos: 1 });
    expect(situacaoDoDia(t.db, em(HOJE, "09:30")).agendamentos).toHaveLength(4); // 3 + cancelado; os não aprovados ficam fora
  });

  it("resumo do dia anterior com movimento: caminhões recebidos e funcionários pelo boletim; domingo pula para sexta", () => {
    const { novo, destino, arm } = base();
    const a = novo("2026-10-02", "08:00", "concluido");
    destino(a.id, "Adubo", em("2026-10-02", "08:10"), em("2026-10-02", "08:50"), 3);
    novo("2026-10-02", "10:00", "concluido");
    novo("2026-10-02", "13:00", "nao_recebido");
    const b = t.db.insert(schema.boletim).values({ armazemId: arm("Adubo").id, data: "2026-10-02", status: "fechado", producaoTotal: "0", diariasEquivalentes: "2", valorPorDiaria: "0", totalAPagar: "0", complemento: "0", pisoUsado: "90.1731", fatorMeiaUsado: "0.5", origem: "teste", criadoEm: em("2026-10-02", "18:00") }).returning().get();
    const c1 = t.db.insert(schema.chapa).values({ matricula: "1", nome: "C1" }).returning().get();
    const c2 = t.db.insert(schema.chapa).values({ matricula: "2", nome: "C2" }).returning().get();
    for (const c of [c1, c2]) t.db.insert(schema.boletimChapa).values({ boletimId: b.id, chapaId: c.id, data: "2026-10-02" }).run();
    const r = resumoDoDia(t.db, HOJE);
    expect(r.anterior).toEqual({ data: "2026-10-02", caminhoes: 2, chapas: 2 });
  });

  it("sem boletim, funcionários do dia anterior vêm das descargas (distintas); sem nada, zero", () => {
    const { novo, destino } = base();
    expect(resumoDoDia(t.db, HOJE).anterior).toBeNull();
    const a = novo("2026-10-02", "08:00", "concluido");
    const aa = destino(a.id, "Adubo", em("2026-10-02", "08:10"), em("2026-10-02", "08:50"));
    const ch = t.db.insert(schema.chapa).values({ matricula: "9", nome: "C9" }).returning().get();
    t.db.insert(schema.descargaChapa).values({ agendamentoArmazemId: aa.id, chapaId: ch.id }).run();
    expect(resumoDoDia(t.db, HOJE).anterior).toEqual({ data: "2026-10-02", caminhoes: 1, chapas: 1 });
  });

  it("duração média das descargas concluídas, em minutos inteiros; nula sem histórico", () => {
    const { novo, destino } = base();
    expect(resumoDoDia(t.db, HOJE).duracaoMediaMin).toBeNull();
    const d1 = novo("2026-10-01", "08:00", "concluido");
    destino(d1.id, "Adubo", em("2026-10-01", "08:00"), em("2026-10-01", "08:30"));
    const d2 = novo("2026-10-01", "10:00", "concluido");
    destino(d2.id, "Adubo", em("2026-10-01", "10:00"), em("2026-10-01", "11:00"));
    expect(resumoDoDia(t.db, HOJE).duracaoMediaMin).toBe(45);
  });

  it("recursos em uso agora: funcionários e empilhadeiras das descargas em andamento", () => {
    const { novo, destino, arm } = base();
    const a = novo(HOJE, "08:00", "em_descarga");
    const aa = destino(a.id, "Adubo", em(HOJE, "08:05"), null, 4);
    const emp = t.db.select().from(schema.equipamento).all().find((e) => e.armazemId === arm("Adubo").id && (e.nome ?? "").includes("Empilhadeira"))!;
    t.db.insert(schema.descargaEquipamento).values({ agendamentoArmazemId: aa.id, equipamentoId: emp.id }).run();
    const fim = novo(HOJE, "07:00", "concluido");
    destino(fim.id, "Insumos", em(HOJE, "07:00"), em(HOJE, "07:30"), 5);
    const r = resumoDoDia(t.db, HOJE);
    expect(r.recursos).toMatchObject({ chapasEmUso: 4, empilhadeirasEmUso: 1 });
    expect(r.recursos.empilhadeirasTotal).toBeGreaterThanOrEqual(1);
  });

  it("em descarga: sem duracao_prevista_min nem norma, previsão usa a duração média", () => {
    const { novo, destino, f } = base();
    const h = novo("2026-10-01", "08:00", "concluido");
    destino(h.id, "Adubo", em("2026-10-01", "08:00"), em("2026-10-01", "09:00"));
    const a = novo(HOJE, "08:00", "em_descarga");
    destino(a.id, "Adubo", em(HOJE, "08:00"), null);
    const s = situacaoDoDia(t.db, em(HOJE, "08:20"));
    expect(s.emDescarga[0]).toMatchObject({ previsaoFonte: "media", previsaoFimEm: em(HOJE, "09:00"), fornecedor: "Fornecedor A" });
    expect(f.id).toBeGreaterThan(0);
  });
});

describe("resumo do dia: correções da revisão", () => {
  it("carga em dois armazéns conta uma vez na média; não recebido fora do total; empilhadeira conta por uso", () => {
    const { novo, destino, arm } = base();
    const c = novo("2026-10-01", "08:00", "concluido");
    destino(c.id, "Adubo", em("2026-10-01", "08:00"), em("2026-10-01", "08:30"));
    destino(c.id, "Insumos", em("2026-10-01", "08:30"), em("2026-10-01", "09:00"));
    const d = novo("2026-10-01", "10:00", "concluido");
    destino(d.id, "Adubo", em("2026-10-01", "10:00"), em("2026-10-01", "10:30"));
    expect(resumoDoDia(t.db, HOJE).duracaoMediaMin).toBe(45); // (60 + 30) / 2
    novo(HOJE, "08:00", "nao_recebido");
    novo(HOJE, "09:00", "agendado");
    expect(resumoDoDia(t.db, HOJE).hoje).toEqual({ total: 1, agendados: 1, emDescarga: 0, concluidos: 0 });
    const emp = t.db.select().from(schema.equipamento).all().find((e) => e.armazemId === arm("Adubo").id && (e.nome ?? "").includes("Empilhadeira"))!;
    for (const h of ["08:00", "08:10"]) {
      const a = novo(HOJE, h, "em_descarga");
      const aa = destino(a.id, "Adubo", em(HOJE, h), null, 1);
      t.db.insert(schema.descargaEquipamento).values({ agendamentoArmazemId: aa.id, equipamentoId: emp.id }).run();
    }
    expect(resumoDoDia(t.db, HOJE).recursos.empilhadeirasEmUso).toBe(2);
  });
});
