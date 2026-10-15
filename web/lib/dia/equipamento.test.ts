import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import type { AgendamentoStatus } from "@/lib/db/enums";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { alertasEquipamento } from "./equipamento";

let t: TestDb;
afterEach(() => t?.apagar());
const HOJE = "2026-10-05";
const em = (hhmm: string) => `${HOJE}T${hhmm}:00-03:00`;

function base() {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ razaoSocial: "F", origem: "teste" }).returning().get();
  const arm = (n: string) => t.db.select().from(schema.armazem).all().find((a) => a.nome === n)!;
  const equip = (n: string, nome: string) => t.db.select().from(schema.equipamento).all().find((e) => e.armazemId === arm(n).id && e.nome === nome)!;
  let k = 0;
  const carga = (armazem: string, status: AgendamentoStatus, acond: "batido" | "paletizado" | "big_bag", entrada: string | null, saida: string | null = null, extra: Partial<typeof schema.agendamento.$inferInsert> = {}) => {
    const a = t.db.insert(schema.agendamento).values({ fornecedorId: f.id, data: HOJE, horario: "08:00", acondicionamentoOcupacao: acond === "batido" ? "batido" : "unitizado", status, origem: "teste", criadoEm: em("06:00"), ...extra }).returning().get();
    const nota = t.db.insert(schema.notaFiscal).values({ chaveAcesso: `c${++k}`, origem: "teste", criadaEm: em("06:00") }).returning().get();
    t.db.insert(schema.agendamentoNf).values({ agendamentoId: a.id, notaFiscalId: nota.id, acondicionamento: acond }).run();
    const aa = t.db.insert(schema.agendamentoArmazem).values({ agendamentoId: a.id, armazemId: arm(armazem).id, ordem: 1, entradaEm: entrada, saidaEm: saida }).returning().get();
    return { a, aa };
  };
  return { arm, equip, carga };
}

describe("alerta de equipamento", () => {
  it("sem demanda e tudo disponível: nenhum alerta", () => {
    base();
    expect(alertasEquipamento(t.db, HOJE)).toEqual([]);
  });

  it("cargas paletizadas pendentes sem nenhuma empilhadeira disponível no armazém", () => {
    const { equip, carga } = base();
    t.db.update(schema.equipamento).set({ disponivel: 0, indisponivelMotivo: "Em manutenção" }).where(eq(schema.equipamento.id, equip("Adubo", "Empilhadeira a gás").id)).run();
    carga("Adubo", "agendado", "paletizado", null);
    carga("Adubo", "agendado", "big_bag", null);
    const r = alertasEquipamento(t.db, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ armazem: "Adubo", tipo: "sem_empilhadeira", cargas: 2 });
    expect(r[0].mensagem).toMatch(/Adubo.*2 cargas.*empilhadeira/i);
    expect(r[0].mensagem).toMatch(/Em manutenção/);
  });

  it("carga batida não pede empilhadeira; armazém com empilhadeira disponível não alerta", () => {
    const { equip, carga } = base();
    t.db.update(schema.equipamento).set({ disponivel: 0 }).where(eq(schema.equipamento.id, equip("Adubo", "Empilhadeira a gás").id)).run();
    carga("Adubo", "agendado", "batido", null);
    expect(alertasEquipamento(t.db, HOJE)).toEqual([]);
    carga("Insumos", "agendado", "paletizado", null);
    expect(alertasEquipamento(t.db, HOJE)).toEqual([]);
  });

  it("equipamento em uso agora acima do disponível: faltam N", () => {
    const { equip, carga } = base();
    const e = equip("Insumos", "Empilhadeira a gás");
    t.db.update(schema.equipamento).set({ disponivel: 1 }).where(eq(schema.equipamento.id, e.id)).run();
    for (const h of ["08:10", "08:20"]) {
      const { aa } = carga("Insumos", "em_descarga", "paletizado", em(h));
      t.db.insert(schema.descargaEquipamento).values({ agendamentoArmazemId: aa.id, equipamentoId: e.id }).run();
    }
    const r = alertasEquipamento(t.db, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: "em_uso", armazem: "Insumos", equipamento: "Empilhadeira a gás", faltam: 1 });
  });

  it("uso já encerrado, carga cancelada ou de outro dia não contam", () => {
    const { equip, carga } = base();
    const e = equip("Insumos", "Empilhadeira a gás");
    t.db.update(schema.equipamento).set({ disponivel: 0 }).where(eq(schema.equipamento.id, e.id)).run();
    const fim = carga("Insumos", "concluido", "paletizado", em("08:00"), em("08:30"));
    t.db.insert(schema.descargaEquipamento).values({ agendamentoArmazemId: fim.aa.id, equipamentoId: e.id }).run();
    carga("Insumos", "cancelado", "paletizado", null);
    carga("Insumos", "agendado", "paletizado", null, null, { data: "2026-10-06" });
    expect(alertasEquipamento(t.db, HOJE)).toEqual([]);
  });

  it("empilhadeira_prevista do agendamento vale como demanda", () => {
    const { equip, carga } = base();
    t.db.update(schema.equipamento).set({ disponivel: 0 }).where(eq(schema.equipamento.id, equip("Adubo", "Empilhadeira a gás").id)).run();
    carga("Adubo", "agendado", "batido", null, null, { empilhadeiraPrevista: true });
    expect(alertasEquipamento(t.db, HOJE)).toHaveLength(1);
  });

  it("carga sem destino que pede empilhadeira: alerta geral só se nenhum armazém tem empilhadeira disponível", () => {
    const { carga } = base();
    const a = carga("Adubo", "agendado", "paletizado", null);
    t.db.delete(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.agendamentoId, a.a.id)).run();
    expect(alertasEquipamento(t.db, HOJE)).toEqual([]);
    t.db.update(schema.equipamento).set({ disponivel: 0 }).run();
    const r = alertasEquipamento(t.db, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ armazem: "Todos os armazéns", cargas: 1 });
  });

  it("equipamento em manutenção conta como indisponível, mesmo com disponivel preenchido", () => {
    const { equip, carga } = base();
    t.db.update(schema.equipamento).set({ status: "manutencao" }).where(eq(schema.equipamento.id, equip("Adubo", "Empilhadeira a gás").id)).run();
    carga("Adubo", "agendado", "paletizado", null);
    const r = alertasEquipamento(t.db, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: "sem_empilhadeira", armazem: "Adubo" });
    expect(r[0].mensagem).toMatch(/manutenção/i);
  });
});
