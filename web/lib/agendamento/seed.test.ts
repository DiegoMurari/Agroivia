import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";

import { seed } from "./seed";

let t: TestDb;
afterEach(() => t?.apagar());

describe("seed do agendamento", () => {
  it("cria 3 pedidos aguardando, 1 recusado com comentário e a notificação, sem duplicar na segunda vez", () => {
    t = createTestDb({ seed: true });
    seed(t.db);
    seed(t.db);
    const porEstado = (a: string) => t.db.select().from(schema.agendamento).where(eq(schema.agendamento.aprovacao, a)).all().filter((x) => x.criadoPorUsuarioId !== null);
    expect(porEstado("aguardando")).toHaveLength(3);
    const recusados = porEstado("recusado");
    expect(recusados).toHaveLength(1);
    expect(recusados[0].recusaComentario).toMatch(/peso/);
    const notas = t.db.select().from(schema.notificacao).all();
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({ tipo: "pedido_recusado", lida: false });
  });
});
