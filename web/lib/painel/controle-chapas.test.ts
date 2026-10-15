import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { dividir, igual } from "@/lib/money";
import { chapasEscaladasHoje, saldoDeChapas, ultimosBoletins } from "./controle-chapas";

let t: TestDb;
let contador = 0;
afterEach(() => t?.apagar());

type Origem = "historico" | "teste" | "operacao";
type Status = "rascunho" | "fechado";

const HOJE = "2025-10-02";
const PISO = "90.1731";

function iniciar() {
  t = createTestDb({ seed: true });
  return t.db;
}

function armazemId(db: TestDb["db"], nome: string) {
  return db.select().from(schema.armazem).all().find((a) => a.nome === nome)!.id;
}

function criarChapa(db: TestDb["db"]) {
  contador += 1;
  return db
    .insert(schema.chapa)
    .values({ matricula: `M${contador}`, nome: `Funcionário ${contador}` })
    .returning()
    .get().id;
}

function criarBoletim(
  db: TestDb["db"],
  o: {
    data?: string;
    armazem?: string;
    status?: Status;
    origem?: Origem;
    producao?: string;
    efetivo?: string;
    piso?: string;
    chapas?: number;
  } = {},
) {
  const id = db
    .insert(schema.boletim)
    .values({
      armazemId: armazemId(db, o.armazem ?? "Adubo"),
      data: o.data ?? HOJE,
      status: o.status ?? "fechado",
      producaoTotal: o.producao ?? "300",
      diariasEquivalentes: o.efetivo ?? "2",
      valorPorDiaria: o.piso ?? PISO,
      totalAPagar: "0",
      complemento: "0",
      pisoUsado: o.piso ?? PISO,
      fatorMeiaUsado: "0.5",
      origem: o.origem ?? "teste",
      criadoEm: "2025-10-02T10:00:00-03:00",
    })
    .returning()
    .get().id;
  for (let i = 0; i < (o.chapas ?? 0); i++) {
    db.insert(schema.boletimChapa)
      .values({ boletimId: id, chapaId: criarChapa(db), data: o.data ?? HOJE, tipoDiaria: "completa" })
      .run();
  }
  return id;
}

const nec = (minimo: number, maximo: number, agendamentos = 1) => ({
  minimo: { chapas: minimo },
  maximo: { chapas: maximo },
  agendamentos,
});

describe("saldoDeChapas", () => {
  it("equipe não lançada: sem_equipe, sem diferença", () => {
    expect(saldoDeChapas(nec(5, 5), null)).toEqual({
      tipo: "sem_equipe",
      diferenca: null,
      texto: "equipe ainda não lançada",
    });
  });

  it("equipe não lançada vale também sem agendamento", () => {
    const r = saldoDeChapas(nec(0, 0, 0), null);
    expect(r.tipo).toBe("sem_equipe");
    expect(r.diferenca).toBeNull();
  });

  it("sem agendamento e com funcionários escalados: sobram todas", () => {
    expect(saldoDeChapas(nec(0, 0, 0), 4)).toEqual({ tipo: "sobram", diferenca: 4, texto: "sobram 4" });
  });

  it("sem agendamento e com um funcionário escalado: singular", () => {
    expect(saldoDeChapas(nec(0, 0, 0), 1)).toEqual({ tipo: "sobram", diferenca: 1, texto: "sobra 1" });
  });

  it("sem agendamento e sem funcionário escalado: equilíbrio", () => {
    expect(saldoDeChapas(nec(0, 0, 0), 0)).toEqual({
      tipo: "equilibrio",
      diferenca: 0,
      texto: "equipe de acordo com a agenda",
    });
  });

  describe("necessidade exata (mínimo igual ao máximo)", () => {
    it("faltam funcionários", () => {
      expect(saldoDeChapas(nec(5, 5), 3)).toEqual({ tipo: "faltam", diferenca: 2, texto: "faltam 2" });
    });

    it("falta um funcionário: singular", () => {
      expect(saldoDeChapas(nec(5, 5), 4)).toEqual({ tipo: "faltam", diferenca: 1, texto: "falta 1" });
    });

    it("ninguém escalado com necessidade: faltam todas", () => {
      expect(saldoDeChapas(nec(5, 5), 0)).toEqual({ tipo: "faltam", diferenca: 5, texto: "faltam 5" });
    });

    it("sobram funcionários", () => {
      expect(saldoDeChapas(nec(5, 5), 8)).toEqual({ tipo: "sobram", diferenca: 3, texto: "sobram 3" });
    });

    it("sobra um funcionário: singular", () => {
      expect(saldoDeChapas(nec(5, 5), 6)).toEqual({ tipo: "sobram", diferenca: 1, texto: "sobra 1" });
    });

    it("igual à necessidade: equilíbrio", () => {
      const r = saldoDeChapas(nec(5, 5), 5);
      expect(r.tipo).toBe("equilibrio");
      expect(r.diferenca).toBe(0);
    });
  });

  describe("necessidade em faixa (mínimo menor que o máximo)", () => {
    it("abaixo do mínimo: faltam pelo menos X", () => {
      expect(saldoDeChapas(nec(3, 5), 1)).toEqual({ tipo: "faltam", diferenca: 2, texto: "faltam pelo menos 2" });
    });

    it("abaixo do mínimo em um funcionário: o texto de faixa mantém o plural", () => {
      const r = saldoDeChapas(nec(3, 5), 2);
      expect(r.tipo).toBe("faltam");
      expect(r.diferenca).toBe(1);
      expect(r.texto).toMatch(/^falt(a|am) pelo menos 1$/);
    });

    it("exatamente no mínimo: dentro da faixa", () => {
      expect(saldoDeChapas(nec(3, 5), 3)).toEqual({
        tipo: "faixa",
        diferenca: 0,
        texto: "dentro da faixa de 3 a 5 funcionários",
      });
    });

    it("entre o mínimo e o máximo: dentro da faixa", () => {
      expect(saldoDeChapas(nec(3, 5), 4)).toEqual({
        tipo: "faixa",
        diferenca: 0,
        texto: "dentro da faixa de 3 a 5 funcionários",
      });
    });

    it("exatamente no máximo: dentro da faixa", () => {
      expect(saldoDeChapas(nec(3, 5), 5).tipo).toBe("faixa");
    });

    it("acima do máximo: sobram pelo menos escalados menos máximo", () => {
      expect(saldoDeChapas(nec(3, 5), 9)).toEqual({ tipo: "sobram", diferenca: 4, texto: "sobram pelo menos 4" });
    });

    it("faixa de 0 a 5 com 0 escalados: dentro da faixa", () => {
      expect(saldoDeChapas(nec(0, 5), 0)).toEqual({
        tipo: "faixa",
        diferenca: 0,
        texto: "dentro da faixa de 0 a 5 funcionários",
      });
    });
  });

  it("nenhum texto traz travessão", () => {
    const casos = [
      saldoDeChapas(nec(5, 5), null),
      saldoDeChapas(nec(5, 5), 3),
      saldoDeChapas(nec(3, 5), 4),
      saldoDeChapas(nec(3, 5), 9),
      saldoDeChapas(nec(0, 0, 0), 2),
    ];
    for (const c of casos) expect(c.texto).not.toMatch(/[—–]/);
  });
});

describe("chapasEscaladasHoje", () => {
  it("null quando não há nenhum boletim na data", () => {
    expect(chapasEscaladasHoje(iniciar(), HOJE)).toBeNull();
  });

  it("boletim sem funcionários conta 0, nunca null", () => {
    const db = iniciar();
    criarBoletim(db, { chapas: 0 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(0);
  });

  it("conta os funcionários de um boletim", () => {
    const db = iniciar();
    criarBoletim(db, { chapas: 3 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(3);
  });

  it("soma funcionários de armazéns diferentes", () => {
    const db = iniciar();
    criarBoletim(db, { armazem: "Adubo", chapas: 2 });
    criarBoletim(db, { armazem: "Insumos", chapas: 3 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(5);
  });

  it("conta rascunho e fechado", () => {
    const db = iniciar();
    criarBoletim(db, { armazem: "Adubo", status: "rascunho", chapas: 2 });
    criarBoletim(db, { armazem: "Insumos", status: "fechado", chapas: 1 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(3);
  });

  it("inclui o boletim único de Todas as áreas", () => {
    const db = iniciar();
    criarBoletim(db, { armazem: "Todas as áreas", chapas: 4 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(4);
  });

  it("ignora boletim de outra data", () => {
    const db = iniciar();
    criarBoletim(db, { data: "2025-10-01", chapas: 6 });
    criarBoletim(db, { data: "2025-10-03", chapas: 7 });
    expect(chapasEscaladasHoje(db, HOJE)).toBeNull();
    criarBoletim(db, { data: HOJE, armazem: "Loja", chapas: 1 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(1);
  });

  it("considera só as origens teste e operacao", () => {
    const db = iniciar();
    criarBoletim(db, { armazem: "Adubo", origem: "historico", chapas: 9 });
    criarBoletim(db, { armazem: "Insumos", origem: "teste", chapas: 2 });
    criarBoletim(db, { armazem: "Loja", origem: "operacao", chapas: 3 });
    expect(chapasEscaladasHoje(db, HOJE)).toBe(5);
  });

  it("só boletim histórico na data: null", () => {
    const db = iniciar();
    criarBoletim(db, { origem: "historico", chapas: 2 });
    expect(chapasEscaladasHoje(db, HOJE)).toBeNull();
  });

  it("a mesma funcionário em dois boletins do dia não conta duas vezes", () => {
    const db = iniciar();
    const a = criarBoletim(db, { armazem: "Adubo", chapas: 0 });
    const b = criarBoletim(db, { armazem: "Insumos", chapas: 0 });
    const c1 = criarChapa(db);
    const c2 = criarChapa(db);
    db.insert(schema.boletimChapa).values({ boletimId: a, chapaId: c1, data: HOJE }).run();
    db.insert(schema.boletimChapa).values({ boletimId: a, chapaId: c2, data: HOJE }).run();
    // o único (chapa, data) já impede a repetição no banco; o resultado precisa ser 2 de qualquer forma
    expect(() => db.insert(schema.boletimChapa).values({ boletimId: b, chapaId: c1, data: HOJE }).run()).toThrow();
    expect(chapasEscaladasHoje(db, HOJE)).toBe(2);
  });
});

describe("ultimosBoletins", () => {
  it("lista vazia quando não há boletim", () => {
    expect(ultimosBoletins(iniciar())).toEqual([]);
  });

  it("excesso: piso 90,1731, efetivo 11, produção 918,1952", () => {
    const db = iniciar();
    const id = criarBoletim(db, { producao: "918.1952", efetivo: "11", piso: PISO, origem: "operacao" });
    const r = ultimosBoletins(db);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id, data: HOJE, armazem: "Adubo", origem: "operacao", rotulo: "excesso" });
    expect(igual(r[0].reais, "73.7089")).toBe(true);
    expect(igual(r[0].chapas, dividir("73.7089", PISO))).toBe(true);
  });

  it("falta: produção acima do que o efetivo paga", () => {
    const db = iniciar();
    criarBoletim(db, { producao: "300", efetivo: "2", piso: PISO });
    const [b] = ultimosBoletins(db);
    expect(b.rotulo).toBe("falta");
    // piso x efetivo = 180,3462; produção 300 => falta de 119,6538 (valor positivo, sem sinal)
    expect(igual(b.reais, "119.6538")).toBe(true);
    expect(igual(b.chapas, dividir("119.6538", PISO))).toBe(true);
  });

  it("equilíbrio: reais e funcionários zerados", () => {
    const db = iniciar();
    criarBoletim(db, { producao: "180.3462", efetivo: "2", piso: PISO });
    const [b] = ultimosBoletins(db);
    expect(b.rotulo).toBe("equilibrio");
    expect(igual(b.reais, "0")).toBe(true);
    expect(igual(b.chapas, "0")).toBe(true);
  });

  it("usa o piso gravado no boletim, não o piso atual", () => {
    const db = iniciar();
    criarBoletim(db, { producao: "100", efetivo: "2", piso: "60" });
    const [b] = ultimosBoletins(db);
    expect(b.rotulo).toBe("excesso");
    expect(igual(b.reais, "20")).toBe(true);
    expect(igual(b.chapas, dividir("20", "60"))).toBe(true);
  });

  it("usa diárias equivalentes fracionadas como efetivo", () => {
    const db = iniciar();
    criarBoletim(db, { producao: "100", efetivo: "2.5", piso: "60" });
    const [b] = ultimosBoletins(db);
    expect(b.rotulo).toBe("excesso");
    expect(igual(b.reais, "50")).toBe(true);
    expect(igual(b.chapas, dividir("50", "60"))).toBe(true);
  });

  it("deixa o rascunho de fora", () => {
    const db = iniciar();
    criarBoletim(db, { armazem: "Adubo", status: "rascunho" });
    const fechado = criarBoletim(db, { armazem: "Insumos", status: "fechado" });
    expect(ultimosBoletins(db).map((b) => b.id)).toEqual([fechado]);
  });

  it("nunca traz a origem historico", () => {
    const db = iniciar();
    criarBoletim(db, { armazem: "Adubo", origem: "historico" });
    const teste = criarBoletim(db, { armazem: "Insumos", origem: "teste" });
    const operacao = criarBoletim(db, { armazem: "Loja", origem: "operacao" });
    const ids = ultimosBoletins(db).map((b) => b.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([teste, operacao]));
  });

  it("ordena pela data mais recente e desempata pelo id maior", () => {
    const db = iniciar();
    const antigo = criarBoletim(db, { data: "2025-09-30", armazem: "Adubo" });
    const doDiaA = criarBoletim(db, { data: "2025-10-02", armazem: "Adubo" });
    const doDiaB = criarBoletim(db, { data: "2025-10-02", armazem: "Insumos" });
    const meio = criarBoletim(db, { data: "2025-10-01", armazem: "Adubo" });
    expect(ultimosBoletins(db).map((b) => b.id)).toEqual([doDiaB, doDiaA, meio, antigo]);
  });

  it("limite padrão de 5", () => {
    const db = iniciar();
    for (let dia = 1; dia <= 7; dia++) {
      criarBoletim(db, { data: `2025-09-${String(dia).padStart(2, "0")}` });
    }
    const r = ultimosBoletins(db);
    expect(r).toHaveLength(5);
    expect(r.map((b) => b.data)).toEqual(["2025-09-07", "2025-09-06", "2025-09-05", "2025-09-04", "2025-09-03"]);
  });

  it("respeita o limite informado", () => {
    const db = iniciar();
    for (let dia = 1; dia <= 4; dia++) {
      criarBoletim(db, { data: `2025-09-${String(dia).padStart(2, "0")}` });
    }
    expect(ultimosBoletins(db, 2).map((b) => b.data)).toEqual(["2025-09-04", "2025-09-03"]);
  });

  it("o limite não conta rascunho nem histórico", () => {
    const db = iniciar();
    criarBoletim(db, { data: "2025-10-05", armazem: "Adubo", status: "rascunho" });
    criarBoletim(db, { data: "2025-10-04", armazem: "Insumos", origem: "historico" });
    const a = criarBoletim(db, { data: "2025-10-03", armazem: "Adubo" });
    const b = criarBoletim(db, { data: "2025-10-02", armazem: "Adubo" });
    expect(ultimosBoletins(db, 2).map((x) => x.id)).toEqual([a, b]);
  });

  it("inclui o boletim único de Todas as áreas com esse nome", () => {
    const db = iniciar();
    const id = criarBoletim(db, { armazem: "Todas as áreas", producao: "918.1952", efetivo: "11", piso: PISO });
    const r = ultimosBoletins(db);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(id);
    expect(r[0].armazem).toBe("Todas as áreas");
    expect(r[0].rotulo).toBe("excesso");
  });
});
