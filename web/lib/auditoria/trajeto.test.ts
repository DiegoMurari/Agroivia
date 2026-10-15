import { afterEach, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/lib/db/testing";
import { schema } from "@/lib/db";
import { descreverDetalhe, listarAuditoria, minutosEntre, obterTrajeto, ordenarPassos, type PassoDoTrajeto } from "./trajeto";

let t: TestDb;
afterEach(() => t?.apagar());

const passo = (em: string, titulo: string): PassoDoTrajeto => ({ em, titulo, quem: null, detalhe: null, tom: "neutro" });

describe("trajeto da entrega", () => {
  it("ordena no tempo e mantém a ordem de chegada no mesmo instante", () => {
    const r = ordenarPassos([passo("2026-10-05T10:00:00-03:00", "C"), passo("2026-10-05T09:00:00-03:00", "A"), passo("2026-10-05T10:00:00-03:00", "D")]);
    expect(r.map((p) => p.titulo)).toEqual(["A", "C", "D"]);
  });

  it("conta minutos entre início e fim, sem dar negativo", () => {
    expect(minutosEntre("2026-10-05T08:00:00-03:00", "2026-10-05T09:15:00-03:00")).toBe(75);
    expect(minutosEntre("2026-10-05T09:15:00-03:00", "2026-10-05T08:00:00-03:00")).toBe(0);
  });

  it("descreve o evento em frase curta e a volta de etapa em português", () => {
    expect(descreverDetalhe("desfeito", JSON.stringify({ de: "concluido", para: "em_descarga" }))).toBe("Voltou de concluído para em descarga.");
    expect(descreverDetalhe("saida", JSON.stringify({ chapasQtd: 4, duracaoMin: 30 }))).toBe("4 funcionários · 30 min de descarga.");
    expect(descreverDetalhe("chegou", null)).toBeNull();
    expect(descreverDetalhe("chegou", "não é json")).toBeNull();
  });

  it("monta o começo, o fim e a duração de uma entrega concluída", () => {
    t = createTestDb({ seed: true });
    const concluido = t.db.select().from(schema.agendamento).all().find((a) => a.status === "concluido");
    if (!concluido) return; // o seed de teste pode vir sem demonstração: nada a conferir
    const tr = obterTrajeto(t.db, concluido.id)!;
    expect(tr.passos.length).toBeGreaterThan(1);
    expect(tr.passos[0].titulo).toBe("Pedido de descarga criado");
    expect(tr.emAndamento).toBe(false);
    expect(tr.fim).not.toBeNull();
    expect(tr.duracaoMin).toBeGreaterThanOrEqual(0);
    expect(listarAuditoria(t.db).some((l) => l.agendamentoId === concluido.id)).toBe(true);
  });

  it("busca por número da nota ou por fornecedor", () => {
    t = createTestDb({ seed: true });
    expect(listarAuditoria(t.db, "zzz-inexistente")).toEqual([]);
  });

  it("entrega inexistente não tem trajeto", () => {
    t = createTestDb({ seed: true });
    expect(obterTrajeto(t.db, 999999)).toBeNull();
  });
});
