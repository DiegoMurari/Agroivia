import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
  const f = t.db.insert(schema.fornecedor).values({ razaoSocial: "Fornecedor A", origem: "teste" }).returning().get();
  const arm = (n: string) => t.db.select().from(schema.armazem).all().find((a) => a.nome === n)!;
  let k = 0;
  const carga = (status: AgendamentoStatus, acond: "batido" | "paletizado" | "big_bag", extra: Partial<typeof schema.agendamento.$inferInsert> = {}) => {
    const a = t.db.insert(schema.agendamento).values({ fornecedorId: f.id, data: HOJE, horario: "08:00", placa: "ABC1D23", acondicionamentoOcupacao: acond === "batido" ? "batido" : "unitizado", status, origem: "teste", criadoEm: em("06:00"), ...extra }).returning().get();
    const nota = t.db.insert(schema.notaFiscal).values({ chaveAcesso: `c${++k}`, origem: "teste", criadaEm: em("06:00") }).returning().get();
    t.db.insert(schema.agendamentoNf).values({ agendamentoId: a.id, notaFiscalId: nota.id, acondicionamento: acond }).run();
    return a;
  };
  const destino = (agendamentoId: number, armazem: string, entrada: string | null = null) =>
    t.db.insert(schema.agendamentoArmazem).values({ agendamentoId, armazemId: arm(armazem).id, ordem: 1, entradaEm: entrada }).returning().get();
  return { arm, carga, destino };
}

describe("AGROVIA Hoje: pátio, galpões e dados para encerrar", () => {
  it("galpões para escolher: só os que recebem descarga e estão ativos", () => {
    base();
    const nomes = situacaoDoDia(t.db, em("08:00")).galpoes.map((g) => g.nome);
    expect(nomes).toEqual(expect.arrayContaining(["Adubo", "Insumos", "Pátio de Máquinas", "Loja"]));
    expect(nomes).not.toContain("Todas as áreas");
  });

  it("No pátio: caminhão que chegou e ainda não começou, com ou sem galpão definido", () => {
    const { carga, destino, arm } = base();
    const semGalpao = carga("chegou", "paletizado", { chegadaEm: em("08:05") });
    const comGalpao = carga("chegou", "batido", { chegadaEm: em("08:10") });
    destino(comGalpao.id, "Adubo");
    carga("agendado", "batido");
    carga("em_descarga", "batido");
    const r = situacaoDoDia(t.db, em("08:20"));
    expect(r.noPatio.map((p) => p.agendamentoId)).toEqual([semGalpao.id, comGalpao.id]);
    expect(r.noPatio[0]).toMatchObject({ placa: "ABC1D23", fornecedor: "Fornecedor A", galpoes: [], chegadaEm: em("08:05") });
    expect(r.noPatio[1].galpoes).toEqual([{ id: arm("Adubo").id, nome: "Adubo" }]);
    expect(r.agendamentos.find((a) => a.id === comGalpao.id)!.armazemIds).toEqual([arm("Adubo").id]);
  });

  it("Descarregando agora traz os funcionários previstos (do agendamento ou da norma) e os equipamentos do galpão", () => {
    const { carga, destino, arm } = base();
    const a = carga("em_descarga", "paletizado");
    destino(a.id, "Adubo", em("08:05"));
    const b = carga("em_descarga", "batido", { chapasPrevistas: 4 });
    destino(b.id, "Insumos", em("08:06"));
    const r = situacaoDoDia(t.db, em("08:20"));
    const da = r.emDescarga.find((e) => e.agendamentoId === a.id)!;
    const db_ = r.emDescarga.find((e) => e.agendamentoId === b.id)!;
    expect(da).toMatchObject({ armazemId: arm("Adubo").id, chapasPrevistas: 1 });
    expect(db_.chapasPrevistas).toBe(4);
    const empAdubo = da.equipamentos.map((e) => e.nome);
    expect(empAdubo).toEqual(expect.arrayContaining(["Empilhadeira a gás", "Paleteira manual"]));
    // paletizado pede empilhadeira: a disponível vem sugerida; carga batida não sugere nada
    expect(da.equipamentos.find((e) => e.nome === "Empilhadeira a gás")!.sugerido).toBe(true);
    expect(da.equipamentos.find((e) => e.nome === "Paleteira manual")!.sugerido).toBe(false);
    expect(db_.equipamentos.every((e) => !e.sugerido)).toBe(true);
  });

  it("equipamento em manutenção aparece como indisponível e não é sugerido; o já registrado vem marcado", () => {
    const { carga, destino, arm } = base();
    const emp = t.db.select().from(schema.equipamento).all().filter((e) => e.armazemId === arm("Adubo").id && e.nome === "Empilhadeira a gás");
    t.db.update(schema.equipamento).set({ status: "manutencao" }).where(eq(schema.equipamento.id, emp[0].id)).run();
    const a = carga("em_descarga", "paletizado");
    const aa = destino(a.id, "Adubo", em("08:05"));
    const paleteira = t.db.select().from(schema.equipamento).all().find((e) => e.armazemId === arm("Adubo").id && e.nome === "Paleteira manual")!;
    t.db.insert(schema.descargaEquipamento).values({ agendamentoArmazemId: aa.id, equipamentoId: paleteira.id }).run();
    const e = situacaoDoDia(t.db, em("08:20")).emDescarga[0];
    expect(e.equipamentos.find((x) => x.nome === "Empilhadeira a gás")).toMatchObject({ disponivel: false, sugerido: false });
    expect(e.equipamentos.find((x) => x.nome === "Paleteira manual")).toMatchObject({ disponivel: true, sugerido: true });
  });

  it("funcionários pedidos de cada agendamento: o informado ou o da norma", () => {
    const { carga } = base();
    const a = carga("agendado", "paletizado");
    const b = carga("agendado", "batido", { chapasPrevistas: 6 });
    const r = situacaoDoDia(t.db, em("08:00")).agendamentos;
    expect(r.find((x) => x.id === a.id)!.chapasPedidas).toBe(1);
    expect(r.find((x) => x.id === b.id)!.chapasPedidas).toBe(6);
  });

  it("funcionários pela norma e pelo peso: batido até 500 kg não pede funcionário; acima pede", () => {
    const { carga } = base();
    const leve = carga("agendado", "batido");
    const pesada = carga("agendado", "batido");
    const pesoDe = (agId: number, kg: string) => {
      const nf = t.db.select().from(schema.agendamentoNf).all().find((x) => x.agendamentoId === agId)!;
      t.db.update(schema.notaFiscal).set({ pesoLiquidoKg: kg }).where(eq(schema.notaFiscal.id, nf.notaFiscalId)).run();
    };
    pesoDe(leve.id, "500");
    pesoDe(pesada.id, "500.001");
    const r = situacaoDoDia(t.db, em("08:00")).agendamentos;
    expect(r.find((x) => x.id === leve.id)!.chapasPedidas).toBe(0);
    expect(r.find((x) => x.id === pesada.id)!.chapasPedidas).toBeGreaterThan(0);
  });
});
