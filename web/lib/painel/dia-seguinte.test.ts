import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { dataSeguinte, necessidadeDoDia, textoAvisoPrestador, type NecessidadeDoDia } from "./dia-seguinte";

let t: TestDb;
let fornecedorId: number;
let contador = 0;
afterEach(() => t?.apagar());

type Ac = "batido" | "paletizado" | "big_bag";
interface NfEntrada {
  ac: Ac;
  liquido?: string | null;
  bruto?: string | null;
}
type Status = "agendado" | "chegou" | "em_descarga" | "concluido" | "cancelado" | "nao_recebido";
type Origem = "historico" | "teste" | "operacao";

function iniciar() {
  t = createTestDb({ seed: true });
  fornecedorId = t.db
    .insert(schema.fornecedor)
    .values({ codigo: "T1", razaoSocial: "Fornecedor de teste", origem: "teste" })
    .returning()
    .get().id;
  return t.db;
}

function agendar(
  db: TestDb["db"],
  o: { data: string; horario?: string; origem?: Origem; status?: Status; nfs: NfEntrada[]; destinos?: string[] },
) {
  const ag = db
    .insert(schema.agendamento)
    .values({
      fornecedorId,
      data: o.data,
      horario: o.horario ?? "08:00",
      acondicionamentoOcupacao: "batido",
      origem: o.origem ?? "teste",
      status: o.status ?? "agendado",
      criadoEm: "2025-10-01T10:00:00-03:00",
    })
    .returning()
    .get().id;
  for (const nf of o.nfs) {
    contador += 1;
    const nfId = db
      .insert(schema.notaFiscal)
      .values({
        chaveAcesso: `CHAVE-${contador}`,
        fornecedorId,
        pesoLiquidoKg: nf.liquido ?? null,
        pesoBrutoKg: nf.bruto ?? null,
        origem: o.origem ?? "teste",
        criadaEm: "2025-10-01T10:00:00-03:00",
      })
      .returning()
      .get().id;
    db.insert(schema.agendamentoNf).values({ agendamentoId: ag, notaFiscalId: nfId, acondicionamento: nf.ac }).run();
  }
  for (const nome of o.destinos ?? []) {
    const armazemId = db.select().from(schema.armazem).all().find((a) => a.nome === nome)!.id;
    db.insert(schema.agendamentoArmazem).values({ agendamentoId: ag, armazemId }).run();
  }
  return ag;
}

const DIA = "2025-10-02";

describe("dataSeguinte", () => {
  it("soma um dia dentro do mês", () => {
    expect(dataSeguinte("2025-10-02")).toBe("2025-10-03");
  });

  it("vira o mês", () => {
    expect(dataSeguinte("2025-10-31")).toBe("2025-11-01");
    expect(dataSeguinte("2025-02-28")).toBe("2025-03-01");
  });

  it("vira o ano", () => {
    expect(dataSeguinte("2025-12-31")).toBe("2026-01-01");
  });

  it("respeita o ano bissexto", () => {
    expect(dataSeguinte("2024-02-28")).toBe("2024-02-29");
    expect(dataSeguinte("2024-02-29")).toBe("2024-03-01");
  });
});

describe("necessidadeDoDia", () => {
  it("dia sem agendamento: tudo zerado, sem empilhadeira", () => {
    const r = necessidadeDoDia(iniciar(), DIA);
    expect(r.data).toBe(DIA);
    expect(r.agendamentos).toBe(0);
    expect(r.origens).toEqual([]);
    expect(r.minimo).toEqual({ chapas: 0, empilhadeira: false });
    expect(r.maximo).toEqual({ chapas: 0, empilhadeira: false });
    expect(r.semPeso).toBe(0);
    expect(r.porAgendamento).toEqual([]);
  });

  it("ignora cancelado e nao_recebido", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", status: "cancelado", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "10:00", status: "nao_recebido", nfs: [{ ac: "batido", liquido: "900" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.agendamentos).toBe(0);
    expect(r.maximo.chapas).toBe(0);
    expect(r.porAgendamento).toEqual([]);
  });

  it("ignora agendamento de outra data", () => {
    const db = iniciar();
    agendar(db, { data: "2025-10-03", nfs: [{ ac: "batido", liquido: "900" }] });
    expect(necessidadeDoDia(db, DIA).agendamentos).toBe(0);
  });

  it("ignora a origem historico e informa as origens consideradas", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", origem: "historico", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "10:00", origem: "teste", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "13:00", origem: "operacao", nfs: [{ ac: "paletizado", liquido: "900" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.agendamentos).toBe(2);
    expect([...r.origens].sort()).toEqual(["operacao", "teste"]);
  });

  it("400 kg não pede funcionário", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "400" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.agendamentos).toBe(1);
    expect(r.minimo).toEqual({ chapas: 0, empilhadeira: false });
    expect(r.maximo).toEqual({ chapas: 0, empilhadeira: false });
    expect(r.semPeso).toBe(0);
  });

  it("500 kg exatos ainda não pede funcionário (estritamente acima)", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "500" }] });
    expect(necessidadeDoDia(db, DIA).maximo.chapas).toBe(0);
  });

  it("501 kg de batido pede 5 funcionários, sem empilhadeira", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "501" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.minimo).toEqual({ chapas: 5, empilhadeira: false });
    expect(r.maximo).toEqual({ chapas: 5, empilhadeira: false });
  });

  it("paletizado acima de 500 kg pede 1 funcionário com empilhadeira", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "paletizado", liquido: "1200.5" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.minimo).toEqual({ chapas: 1, empilhadeira: true });
    expect(r.maximo).toEqual({ chapas: 1, empilhadeira: true });
  });

  it("big bag acima de 500 kg pede 1 funcionário com empilhadeira", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "big_bag", liquido: "800" }] });
    expect(necessidadeDoDia(db, DIA).maximo).toEqual({ chapas: 1, empilhadeira: true });
  });

  it("usa o peso bruto quando o líquido não existe", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: null, bruto: "700" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.semPeso).toBe(0);
    expect(r.maximo.chapas).toBe(5);
  });

  it("prefere o peso líquido ao bruto", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "400", bruto: "700" }] });
    expect(necessidadeDoDia(db, DIA).maximo.chapas).toBe(0);
  });

  it("carga mista pega o maior entre as NF, com empilhadeira se alguma pedir", () => {
    const db = iniciar();
    const id = agendar(db, {
      data: DIA,
      nfs: [
        { ac: "batido", liquido: "900" },
        { ac: "paletizado", liquido: "900" },
      ],
    });
    const r = necessidadeDoDia(db, DIA);
    expect(r.agendamentos).toBe(1);
    expect(r.maximo).toEqual({ chapas: 5, empilhadeira: true });
    expect(r.minimo).toEqual({ chapas: 5, empilhadeira: true });
    expect(r.porAgendamento).toHaveLength(1);
    expect(r.porAgendamento[0]).toMatchObject({ id, horario: "08:00", origem: "teste" });
    expect(r.porAgendamento[0].maximo).toEqual({ chapas: 5, empilhadeira: true });
  });

  it("dois agendamentos no dia: pega o maior, não a soma", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "10:00", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "13:00", nfs: [{ ac: "paletizado", liquido: "900" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.agendamentos).toBe(3);
    expect(r.maximo.chapas).toBe(5);
    expect(r.minimo.chapas).toBe(5);
    expect(r.maximo.empilhadeira).toBe(true);
    expect(r.porAgendamento).toHaveLength(3);
    expect(r.porAgendamento.map((p) => p.horario)).toEqual(["08:00", "10:00", "13:00"]);
  });

  it("agendamentos do MESMO horário somam (duas equipes) e o dia pega o maior horário", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "08:00", nfs: [{ ac: "batido", liquido: "900" }] });
    agendar(db, { data: DIA, horario: "10:00", nfs: [{ ac: "batido", liquido: "900" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.maximo.chapas).toBe(10);
    expect(r.minimo.chapas).toBe(10);
    expect(r.porHorario.map((h) => [h.horario, h.agendamentos, h.maximo.chapas])).toEqual([
      ["08:00", 2, 10],
      ["10:00", 1, 5],
    ]);
  });

  it("por armazém: soma no mesmo horário, maior entre horários; empilhadeira se alguém pedir", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", nfs: [{ ac: "batido", liquido: "900" }], destinos: ["Adubo"] });
    agendar(db, { data: DIA, horario: "08:00", nfs: [{ ac: "paletizado", liquido: "900" }], destinos: ["Insumos"] });
    agendar(db, { data: DIA, horario: "10:00", nfs: [{ ac: "batido", liquido: "900" }], destinos: ["Adubo"] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.maximo).toEqual({ chapas: 6, empilhadeira: true });
    const adubo = r.porArmazem.find((a) => a.nome === "Adubo")!;
    const insumos = r.porArmazem.find((a) => a.nome === "Insumos")!;
    expect(adubo.maximo).toEqual({ chapas: 5, empilhadeira: false });
    expect(insumos.maximo).toEqual({ chapas: 1, empilhadeira: true });
    expect(r.picoHorario).toBe("08:00");
  });

  it("sem destino gravado, o armazém é sugerido pelos itens da NF", () => {
    const db = iniciar();
    const adubo = db.select().from(schema.armazem).all().find((x) => x.nome === "Adubo")!.id;
    const produtoId = db.insert(schema.produto).values({ item: "P1", deposito: "MATFerti", armazemId: adubo }).returning().get().id;
    const ag = agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "900" }] });
    const nfId = db.select().from(schema.agendamentoNf).all().find((l) => l.agendamentoId === ag)!.notaFiscalId;
    db.insert(schema.notaFiscalItem).values({ notaFiscalId: nfId, produtoId }).run();
    const r = necessidadeDoDia(db, DIA);
    expect(r.porArmazem.map((x) => x.nome)).toEqual(["Adubo"]);
  });

  it("agendamento sem destino definido vai para o grupo Sem destino definido", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "900" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.porArmazem).toHaveLength(1);
    expect(r.porArmazem[0]).toMatchObject({ armazemId: null, nome: "Sem destino definido" });
  });

  it("peso desconhecido vira faixa (mínimo 0, máximo da norma cheia) e conta em semPeso", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: null, bruto: null }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.semPeso).toBe(1);
    expect(r.minimo).toEqual({ chapas: 0, empilhadeira: false });
    expect(r.maximo).toEqual({ chapas: 5, empilhadeira: false });
    expect(r.porAgendamento[0].minimo.chapas).toBe(0);
    expect(r.porAgendamento[0].maximo.chapas).toBe(5);
  });

  it("semPeso conta uma vez por NF sem peso, em todos os agendamentos", () => {
    const db = iniciar();
    agendar(db, {
      data: DIA,
      horario: "08:00",
      nfs: [
        { ac: "paletizado" },
        { ac: "batido" },
        { ac: "batido", liquido: "900" },
      ],
    });
    agendar(db, { data: DIA, horario: "10:00", nfs: [{ ac: "big_bag" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.semPeso).toBe(3);
    expect(r.minimo.chapas).toBe(5);
    expect(r.maximo.chapas).toBe(5);
  });

  it("peso desconhecido de paletizado: faixa de 0 a 1 funcionário com empilhadeira no máximo", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "paletizado" }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.minimo).toEqual({ chapas: 0, empilhadeira: false });
    expect(r.maximo).toEqual({ chapas: 1, empilhadeira: true });
    expect(r.semPeso).toBe(1);
  });

  it("perfil dossie usa a norma do dossie (paletizado com 2 funcionários)", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "paletizado", liquido: "900" }] });
    const padrao = necessidadeDoDia(db, DIA);
    const dossie = necessidadeDoDia(db, DIA, "dossie");
    expect(padrao.maximo.chapas).toBe(1);
    expect(dossie.maximo.chapas).toBe(2);
    expect(dossie.maximo.empilhadeira).toBe(true);
  });

  it("peso decimal é comparado como decimal, não como float", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "500.0001" }] });
    expect(necessidadeDoDia(db, DIA).maximo.chapas).toBe(5);
  });

  it("agendamento sem NF ligada vira faixa cheia e conta em semNf, nunca 0 funcionários", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.semNf).toBe(1);
    expect(r.minimo.chapas).toBe(0);
    expect(r.maximo.chapas).toBe(5);
  });

  it("peso vazio ou ilegível não derruba: cai no bruto ou conta como sem peso", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", nfs: [{ ac: "batido", liquido: "", bruto: "700" }] });
    agendar(db, { data: DIA, horario: "10:00", nfs: [{ ac: "batido", liquido: "abc", bruto: null }] });
    const r = necessidadeDoDia(db, DIA);
    expect(r.porAgendamento[0].maximo.chapas).toBe(5);
    expect(r.porAgendamento[0].minimo.chapas).toBe(5);
    expect(r.semPeso).toBe(1);
  });
});

function nec(p: Partial<NecessidadeDoDia>): NecessidadeDoDia {
  return {
    data: "2025-10-02",
    agendamentos: 1,
    origens: ["teste"],
    minimo: { chapas: 5, empilhadeira: false },
    maximo: { chapas: 5, empilhadeira: false },
    semPeso: 0,
    semNf: 0,
    porAgendamento: [],
    porHorario: [],
    porArmazem: [],
    picoHorario: null,
    ...p,
  };
}

describe("textoAvisoPrestador", () => {
  it("sem agendamento: avisa que não há recebimentos e traz a data dd/mm/aaaa", () => {
    const txt = textoAvisoPrestador(
      nec({ agendamentos: 0, origens: [], minimo: { chapas: 0, empilhadeira: false }, maximo: { chapas: 0, empilhadeira: false } }),
    );
    expect(txt).toContain("não há recebimentos agendados");
    expect(txt).toContain("02/10/2025");
    expect(txt).not.toMatch(/[—–]/);
  });

  it("mínimo igual ao máximo, sem empilhadeira", () => {
    const txt = textoAvisoPrestador(nec({ agendamentos: 2 }));
    expect(txt).toContain("precisamos de 5 funcionários");
    expect(txt).toContain("sem empilhadeira");
    expect(txt).not.toContain("com empilhadeira");
    expect(txt).toContain("02/10/2025");
    expect(txt).toMatch(/\b2\b/);
    expect(txt).not.toMatch(/[—–]/);
  });

  it("mínimo igual ao máximo, com empilhadeira", () => {
    const txt = textoAvisoPrestador(
      nec({ minimo: { chapas: 3, empilhadeira: true }, maximo: { chapas: 3, empilhadeira: true } }),
    );
    expect(txt).toContain("precisamos de 3 funcionários");
    expect(txt).toContain("com empilhadeira");
    expect(txt).not.toContain("sem empilhadeira");
  });

  it("singular para um funcionário", () => {
    const txt = textoAvisoPrestador(
      nec({ minimo: { chapas: 1, empilhadeira: true }, maximo: { chapas: 1, empilhadeira: true } }),
    );
    expect(txt).toContain("1 funcionário");
    expect(txt).not.toContain("1 funcionários");
    expect(txt).toContain("com empilhadeira");
  });

  it("faixa: mostra de X a Y funcionários e avisa que peso ou acondicionamento não está confirmado", () => {
    const txt = textoAvisoPrestador(
      nec({ agendamentos: 3, minimo: { chapas: 0, empilhadeira: false }, maximo: { chapas: 5, empilhadeira: false }, semPeso: 1 }),
    );
    expect(txt).toContain("de 0 a 5 funcionários");
    expect(txt).toMatch(/não está confirmado/);
    expect(txt).toMatch(/peso/);
    expect(txt).toMatch(/acondicionamento/);
    expect(txt).toContain("02/10/2025");
    expect(txt).toMatch(/\b3\b/);
    expect(txt).not.toMatch(/[—–]/);
  });

  it("formata a data com zero à esquerda e vira de ano", () => {
    const txt = textoAvisoPrestador(nec({ data: "2026-01-05" }));
    expect(txt).toContain("05/01/2026");
  });

  it("texto gerado a partir do banco nunca traz travessão", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ ac: "batido" }] });
    const txt = textoAvisoPrestador(necessidadeDoDia(db, DIA));
    expect(txt).toContain("de 0 a 5 funcionários");
    expect(txt).not.toMatch(/[—–]/);
  });

  it("frase pronta: rótulo, horário de pico e necessidade por armazém", () => {
    const txt = textoAvisoPrestador(
      nec({
        agendamentos: 2,
        minimo: { chapas: 6, empilhadeira: true },
        maximo: { chapas: 6, empilhadeira: true },
        picoHorario: "08:00",
        porHorario: [
          {
            horario: "08:00",
            agendamentos: 2,
            minimo: { chapas: 6, empilhadeira: true },
            maximo: { chapas: 6, empilhadeira: true },
            porArmazem: [
              { armazemId: 2, nome: "Adubo", minimo: { chapas: 5, empilhadeira: false }, maximo: { chapas: 5, empilhadeira: false } },
              { armazemId: 1, nome: "Insumos", minimo: { chapas: 1, empilhadeira: true }, maximo: { chapas: 1, empilhadeira: true } },
            ],
          },
        ],
      }),
      { rotulo: "Amanhã" },
    );
    expect(txt).toContain("Amanhã, 02/10/2025: precisamos de 6 funcionários a partir das 08:00 (Adubo 5, Insumos 1)");
    expect(txt).toContain("com empilhadeira");
  });

  it("empilhadeira de outro horário é indicada com a hora, sem atribuí-la ao pico", () => {
    const h = (horario: string, emp: boolean) => ({
      horario, agendamentos: 1, minimo: { chapas: 5, empilhadeira: emp }, maximo: { chapas: 5, empilhadeira: emp }, porArmazem: [],
    });
    const txt = textoAvisoPrestador(
      nec({ minimo: { chapas: 5, empilhadeira: true }, maximo: { chapas: 5, empilhadeira: true }, picoHorario: "08:00", porHorario: [h("08:00", false), h("10:00", true)] }),
    );
    expect(txt).toContain("a partir das 08:00");
    expect(txt).toContain("sem empilhadeira; empilhadeira necessária às 10:00");
  });

  it("faixa por armazém quando há incerteza", () => {
    const txt = textoAvisoPrestador(
      nec({
        minimo: { chapas: 0, empilhadeira: false },
        maximo: { chapas: 5, empilhadeira: false },
        picoHorario: "08:00",
        porHorario: [
          {
            horario: "08:00",
            agendamentos: 1,
            minimo: { chapas: 0, empilhadeira: false },
            maximo: { chapas: 5, empilhadeira: false },
            porArmazem: [{ armazemId: 2, nome: "Adubo", minimo: { chapas: 0, empilhadeira: false }, maximo: { chapas: 5, empilhadeira: false } }],
          },
        ],
      }),
      { rotulo: "Amanhã" },
    );
    expect(txt).toContain("precisamos de 0 a 5 funcionários a partir das 08:00 (Adubo 0 a 5)");
  });
});

describe("necessidadeDoDia e a aprovação do pedido", () => {
  function comAprovacao(aprovacao: "rascunho" | "aguardando" | "aprovado" | "recusado") {
    const db = iniciar();
    const id = agendar(db, { data: DIA, nfs: [{ ac: "batido", liquido: "1000" }], destinos: ["Adubo"] });
    db.update(schema.agendamento).set({ aprovacao }).where(eq(schema.agendamento.id, id)).run();
    return necessidadeDoDia(db, DIA).agendamentos;
  }

  it("conta aguardando e aprovado", () => {
    expect(comAprovacao("aguardando")).toBe(1);
    t.apagar();
    expect(comAprovacao("aprovado")).toBe(1);
  });

  it("deixa rascunho e recusado fora", () => {
    expect(comAprovacao("rascunho")).toBe(0);
    t.apagar();
    expect(comAprovacao("recusado")).toBe(0);
  });
});
