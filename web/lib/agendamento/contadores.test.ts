import { afterEach, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/lib/db/testing";

import { contadoresAgendamento } from "./contadores";

let t: TestDb;
afterEach(() => t?.apagar());

describe("contadores da tela de agendamento", () => {
  it("banco vazio de movimento devolve números inteiros não negativos", () => {
    t = createTestDb({ seed: true });
    const c = contadoresAgendamento(t.db, "2026-10-05T07:00:00-03:00");
    for (const v of Object.values(c)) expect(Number.isInteger(v) && v >= 0).toBe(true);
  });
});
