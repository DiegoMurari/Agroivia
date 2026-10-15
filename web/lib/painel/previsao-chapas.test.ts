import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { dec, formatBRL, igual, multiplicar, subtrair } from "@/lib/money";
import type { NecessidadeDoDia } from "./dia-seguinte";
import { preverChapas, previsaoDoDia, textoCurtoPrestador } from "./previsao-chapas";

const PISO = "90.1731";

type Entrada = Parameters<typeof preverChapas>[0];

function entrada(p: Partial<Entrada>): Entrada {
  return {
    agendamentos: 1,
    normaMinimo: 2,
    normaMaximo: 2,
    producaoDescarga: "0",
    producaoNaoDescarga: "0",
    temMediaBoletim: false,
    piso: PISO,
    ...p,
  };
}

describe("preverChapas", () => {
  it("produção cobre a norma: pede o mínimo e informa até quantas funcionários a produção paga", () => {
    const r = preverChapas(entrada({ normaMinimo: 2, normaMaximo: 2, producaoDescarga: "450" }));
    expect(r.tipo).toBe("cobre");
    expect(r.maximoPago).toBe(4); // 450 / 90,1731 = 4,99
    expect(r.recomendado).toBe(2);
    expect(r.de).toBe(2);
    expect(r.ate).toBe(4);
    expect(r.complementoPrevisto).toBeNull();
    expect(r.incerta).toBe(false);
    expect(igual(r.producaoPrevista, "450")).toBe(true);
    expect(r.motivo).toBe("Peça de 2 a 4 funcionários. Até 4, a produção prevista cobre as diárias.");
  });

  it("soma produção de descarga e de não descarga", () => {
    const r = preverChapas(entrada({ normaMinimo: 1, normaMaximo: 1, producaoDescarga: "100", producaoNaoDescarga: "80.3462" }));
    expect(igual(r.producaoPrevista, "180.3462")).toBe(true);
    expect(r.maximoPago).toBe(2);
  });

  it("N igual a M usa a frase singular da faixa", () => {
    const r = preverChapas(entrada({ normaMinimo: 3, normaMaximo: 3, producaoDescarga: "270.5193" }));
    expect(r.tipo).toBe("cobre");
    expect(r.de).toBe(3);
    expect(r.ate).toBe(3);
    expect(r.motivo).toBe("Peça 3 funcionários. A produção prevista cobre as diárias.");
  });

  it("produção exatamente igual a 3 pisos paga 3 diárias, não 2 (floor exato, sem float)", () => {
    const r = preverChapas(entrada({ normaMinimo: 1, normaMaximo: 1, producaoDescarga: "270.5193" }));
    expect(r.maximoPago).toBe(3);
    expect(r.ate).toBe(3);
  });

  it("um centavo de milésimo abaixo de 3 pisos paga 2", () => {
    const r = preverChapas(entrada({ normaMinimo: 1, normaMaximo: 1, producaoDescarga: "270.5192" }));
    expect(r.maximoPago).toBe(2);
  });

  it("produção não cobre a norma: pede o mínimo e prevê o complemento exato", () => {
    const r = preverChapas(entrada({ normaMinimo: 5, normaMaximo: 5, producaoDescarga: "180.3462" }));
    expect(r.tipo).toBe("nao_cobre");
    expect(r.maximoPago).toBe(2);
    expect(r.recomendado).toBe(5);
    expect(r.de).toBe(5);
    expect(r.ate).toBe(5);
    expect(r.complementoPrevisto).not.toBeNull();
    expect(igual(r.complementoPrevisto!, "270.5193")).toBe(true);
    expect(igual(r.complementoPrevisto!, subtrair(multiplicar(PISO, "5"), "180.3462"))).toBe(true);
    const x = formatBRL("270.5193").replace(/^R\$\s*/, "");
    expect(x).toBe("270,52");
    expect(r.motivo).toBe(
      `Peça 5 funcionários (mínimo para descarregar). A produção prevista paga só 2 diárias: complemento previsto de R$ ${x}.`,
    );
    expect(r.incerta).toBe(false);
  });

  it("aceita produção como Valor", () => {
    const r = preverChapas(entrada({ normaMinimo: 2, normaMaximo: 2, producaoDescarga: dec("450"), producaoNaoDescarga: dec("0") }));
    expect(r.maximoPago).toBe(4);
  });

  it("faixa de norma (0 a 5) é incerta e cita a norma máxima", () => {
    const r = preverChapas(entrada({ normaMinimo: 0, normaMaximo: 5, producaoDescarga: "450" }));
    expect(r.incerta).toBe(true);
    expect(r.motivo.endsWith(" A norma pode pedir até 5 funcionários se o peso ou o acondicionamento forem confirmados.")).toBe(true);
  });

  it("incertaProducao com min igual a max: incerta, sem a frase da norma, com a frase da produção", () => {
    const r = preverChapas(entrada({ normaMinimo: 2, normaMaximo: 2, producaoDescarga: "450", incertaProducao: true }));
    expect(r.incerta).toBe(true);
    expect(r.motivo).not.toContain("A norma pode pedir");
    expect(r.motivo.endsWith(" Parte da produção não pôde ser estimada.")).toBe(true);
  });

  it("incertaProducao com faixa de norma: usa a frase da norma", () => {
    const r = preverChapas(entrada({ normaMinimo: 1, normaMaximo: 4, producaoDescarga: "450", incertaProducao: true }));
    expect(r.incerta).toBe(true);
    expect(r.motivo.endsWith(" A norma pode pedir até 4 funcionários se o peso ou o acondicionamento forem confirmados.")).toBe(true);
  });

  it("faixa de norma quando a produção não cobre o mínimo", () => {
    const r = preverChapas(entrada({ normaMinimo: 3, normaMaximo: 5, producaoDescarga: "0" }));
    expect(r.tipo).toBe("nao_cobre");
    expect(r.maximoPago).toBe(0);
    expect(r.incerta).toBe(true);
    expect(r.motivo).toContain("A norma pode pedir até 5 funcionários");
  });

  it("dia sem agendamento e sem média: nada a pedir", () => {
    const r = preverChapas(entrada({ agendamentos: 0, normaMinimo: 0, normaMaximo: 0 }));
    expect(r.tipo).toBe("sem_descarga");
    expect(r.recomendado).toBe(0);
    expect(r.de).toBe(0);
    expect(r.ate).toBeNull();
    expect(r.maximoPago).toBeNull();
    expect(r.complementoPrevisto).toBeNull();
    expect(r.incerta).toBe(false);
    expect(r.motivo).toBe("Nenhuma descarga agendada.");
  });

  it("dia sem agendamento mas com média de boletim sem produção de não descarga continua sem descarga", () => {
    const r = preverChapas(entrada({ agendamentos: 0, normaMinimo: 0, normaMaximo: 0, temMediaBoletim: true, producaoNaoDescarga: "0" }));
    expect(r.tipo).toBe("sem_descarga");
    expect(r.ate).toBeNull();
  });

  it("dia sem agendamento com média de remoção e transferência: informa até quantas diárias a média paga", () => {
    const r = preverChapas(
      entrada({ agendamentos: 0, normaMinimo: 0, normaMaximo: 0, temMediaBoletim: true, producaoNaoDescarga: "270.5193" }),
    );
    expect(r.tipo).toBe("sem_descarga_com_media");
    expect(r.recomendado).toBe(0);
    expect(r.de).toBe(0);
    expect(r.ate).toBe(3);
    expect(r.maximoPago).toBe(3);
    expect(igual(r.producaoPrevista, "270.5193")).toBe(true);
    expect(r.motivo).toBe("Nenhuma descarga agendada. A média de remoção e transferência paga até 3 diárias.");
  });

  it("média positiva sem boletim usado (temMediaBoletim false) cai em sem_descarga", () => {
    const r = preverChapas(entrada({ agendamentos: 0, normaMinimo: 0, normaMaximo: 0, temMediaBoletim: false, producaoNaoDescarga: "270.5193" }));
    expect(r.tipo).toBe("sem_descarga");
  });
});

// ---------------------------------------------------------------------------------------------
// previsaoDoDia (banco)
// ---------------------------------------------------------------------------------------------

let t: TestDb;
let fornecedorId: number;
let contador = 0;
afterEach(() => t?.apagar());

type Origem = "historico" | "teste" | "operacao";

interface ItemEntrada {
  produtoId?: number | null;
  descricao?: string;
  quantidade?: string;
  unidade?: string;
}
interface NfEntrada {
  liquido?: string | null;
  bruto?: string | null;
  itens?: ItemEntrada[];
}

function iniciar() {
  t = createTestDb({ seed: true });
  fornecedorId = t.db
    .insert(schema.fornecedor)
    .values({ codigo: "T1", razaoSocial: "Fornecedor de teste", origem: "teste" })
    .returning()
    .get().id;
  return t.db;
}

function armazemId(db: TestDb["db"], nome: string) {
  return db.select().from(schema.armazem).all().find((a) => a.nome === nome)!.id;
}

function tipoPreco(db: TestDb["db"], nome: string) {
  return db.select().from(schema.tipoItem).all().find((x) => x.nome === nome)!;
}

function produto(db: TestDb["db"], o: { grupo: string; descricao?: string; pesoUnitarioKg?: string | null }) {
  contador += 1;
  return db
    .insert(schema.produto)
    .values({ item: `P${contador}`, descricao: o.descricao ?? "Produto", grupo: o.grupo, pesoUnitarioKg: o.pesoUnitarioKg ?? null })
    .returning()
    .get().id;
}

function agendar(
  db: TestDb["db"],
  o: { data: string; horario?: string; origem?: Origem; nfs: NfEntrada[]; destinos?: string[] },
) {
  const ag = db
    .insert(schema.agendamento)
    .values({
      fornecedorId,
      data: o.data,
      horario: o.horario ?? "08:00",
      acondicionamentoOcupacao: "batido",
      origem: o.origem ?? "teste",
      status: "agendado",
      criadoEm: "2026-10-01T10:00:00-03:00",
    })
    .returning()
    .get().id;
  for (const nf of o.nfs) {
    contador += 1;
    const nfId = db
      .insert(schema.notaFiscal)
      .values({
        chaveAcesso: `CHAVE-PREV-${contador}`,
        fornecedorId,
        pesoLiquidoKg: nf.liquido ?? null,
        pesoBrutoKg: nf.bruto ?? null,
        origem: o.origem ?? "teste",
        criadaEm: "2026-10-01T10:00:00-03:00",
      })
      .returning()
      .get().id;
    db.insert(schema.agendamentoNf).values({ agendamentoId: ag, notaFiscalId: nfId, acondicionamento: "batido" }).run();
    for (const it of nf.itens ?? []) {
      db.insert(schema.notaFiscalItem)
        .values({
          notaFiscalId: nfId,
          produtoId: it.produtoId ?? null,
          descricao: it.descricao ?? "ITEM",
          quantidade: it.quantidade ?? null,
          unidade: it.unidade ?? null,
        })
        .run();
    }
  }
  for (const nome of o.destinos ?? []) {
    db.insert(schema.agendamentoArmazem).values({ agendamentoId: ag, armazemId: armazemId(db, nome) }).run();
  }
  return ag;
}

interface LinhaBoletim {
  tipo: string;
  remocao?: string;
  transferencia?: string;
  descarga?: string;
  preco: string;
}

function boletim(
  db: TestDb["db"],
  o: { armazem: string; data: string; status?: "rascunho" | "fechado"; origem?: Origem; linhas: LinhaBoletim[] },
) {
  const id = db
    .insert(schema.boletim)
    .values({
      armazemId: armazemId(db, o.armazem),
      data: o.data,
      status: o.status ?? "fechado",
      producaoTotal: "0",
      diariasEquivalentes: "0",
      valorPorDiaria: "0",
      totalAPagar: "0",
      complemento: "0",
      pisoUsado: PISO,
      fatorMeiaUsado: "0.5",
      origem: o.origem ?? "teste",
      criadoEm: "2026-10-01T10:00:00-03:00",
    })
    .returning()
    .get().id;
  for (const l of o.linhas) {
    db.insert(schema.boletimLinha)
      .values({
        boletimId: id,
        tipoItemId: tipoPreco(db, l.tipo).id,
        qtdDescarga: l.descarga ?? "0",
        qtdRemocao: l.remocao ?? "0",
        qtdTransferencia: l.transferencia ?? "0",
        quantidadeTotal: "0",
        precoUsado: l.preco,
        valor: "0",
      })
      .run();
  }
  return id;
}

const DIA = "2026-10-06";

describe("previsaoDoDia: produção de descarga", () => {
  it("FER de 5000 kg vale 100 sacas vezes o preço do tipo do grupo", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER", descricao: "UREIA" });
    agendar(db, {
      data: DIA,
      destinos: ["Adubo"],
      nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "5", unidade: "TON" }] }],
    });
    const r = previsaoDoDia(db, DIA);
    expect(r.data).toBe(DIA);
    expect(igual(r.producaoDescarga, multiplicar("100", preco))).toBe(true);
    expect(igual(r.previsao.producaoPrevista, multiplicar("100", preco))).toBe(true);
    expect(r.necessidade.agendamentos).toBe(1);
  });

  it("quantidade em KG é usada direto como peso", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER" });
    agendar(db, { data: DIA, nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "5000", unidade: "KG" }] }] });
    expect(igual(previsaoDoDia(db, DIA).producaoDescarga, multiplicar("100", preco))).toBe(true);
  });

  it("outra unidade usa peso unitário do produto vezes a quantidade", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER", pesoUnitarioKg: "50" });
    agendar(db, { data: DIA, nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "100", unidade: "SC" }] }] });
    expect(igual(previsaoDoDia(db, DIA).producaoDescarga, multiplicar("100", preco))).toBe(true);
  });

  it("sem unidade conhecida nem peso unitário, NF com um único item usa o peso da NF", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER" });
    agendar(db, { data: DIA, nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "7", unidade: "SC" }] }] });
    const r = previsaoDoDia(db, DIA);
    expect(igual(r.producaoDescarga, multiplicar("100", preco))).toBe(true);
    expect(r.previsao.incerta).toBe(false);
  });

  it("peso da NF cai para o bruto quando não há líquido", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER" });
    agendar(db, { data: DIA, nfs: [{ liquido: null, bruto: "2500", itens: [{ produtoId: p, quantidade: "1", unidade: "SC" }] }] });
    expect(igual(previsaoDoDia(db, DIA).producaoDescarga, multiplicar("50", preco))).toBe(true);
  });

  it("grupo de unidade usa a quantidade vezes o preço do tipo", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Agroquímico").precoUnitario;
    const p = produto(db, { grupo: "AGR" });
    agendar(db, { data: DIA, nfs: [{ liquido: "100", itens: [{ produtoId: p, quantidade: "10", unidade: "UN", }] }] });
    // unidade UN sem peso unitário: NF com único item usa o peso da NF, mas a produção do grupo unidade usa a quantidade
    // (a quantidade do item é 10 e não depende do peso)
    const r = previsaoDoDia(db, DIA);
    expect(r.producaoDescarga.gt(0)).toBe(true);
    expect(igual(r.producaoDescarga, multiplicar("10", preco))).toBe(true);
  });

  it("corretivo (FER com CALCARIO) fica fora da produção", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const ureia = produto(db, { grupo: "FER", descricao: "UREIA" });
    const calc = produto(db, { grupo: "FER", descricao: "CALCARIO" });
    agendar(db, {
      data: DIA,
      nfs: [
        {
          liquido: "9000",
          itens: [
            { produtoId: ureia, descricao: "UREIA", quantidade: "5000", unidade: "KG" },
            { produtoId: calc, descricao: "CALCARIO DOLOMITICO", quantidade: "4000", unidade: "KG" },
          ],
        },
      ],
    });
    expect(igual(previsaoDoDia(db, DIA).producaoDescarga, multiplicar("100", preco))).toBe(true);
  });

  it("linha de grupo sem tipo (sem preço) fica fora e marca incerta", () => {
    const db = iniciar();
    db.insert(schema.grupoProduto).values({ grupo: "XYZ", descricao: "Sem tipo", conversaoProducao: "unidade" }).run();
    const p = produto(db, { grupo: "XYZ" });
    agendar(db, { data: DIA, nfs: [{ liquido: "100", itens: [{ produtoId: p, quantidade: "10", unidade: "UN" }] }] });
    const r = previsaoDoDia(db, DIA);
    expect(igual(r.producaoDescarga, "0")).toBe(true);
    expect(r.previsao.incerta).toBe(true);
  });

  it("NF sem peso e sem item: produção desconhecida marca incerta", () => {
    const db = iniciar();
    agendar(db, { data: DIA, nfs: [{ liquido: null, bruto: null }] });
    const r = previsaoDoDia(db, DIA);
    expect(igual(r.producaoDescarga, "0")).toBe(true);
    expect(r.previsao.incerta).toBe(true);
  });

  it("item com peso desconhecido em NF de vários itens não soma e marca incerta", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const a = produto(db, { grupo: "FER" });
    const b = produto(db, { grupo: "FER" });
    agendar(db, {
      data: DIA,
      nfs: [
        {
          liquido: "6000",
          itens: [
            { produtoId: a, quantidade: "5000", unidade: "KG" },
            { produtoId: b, quantidade: "3", unidade: "SC" },
          ],
        },
      ],
    });
    const r = previsaoDoDia(db, DIA);
    expect(igual(r.producaoDescarga, multiplicar("100", preco))).toBe(true);
    expect(r.previsao.incerta).toBe(true);
  });

  it("dois caminhões no mesmo horário e armazém somam produção e somam funcionários da norma", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER" });
    for (let i = 0; i < 2; i++) {
      agendar(db, {
        data: DIA,
        horario: "08:00",
        destinos: ["Adubo"],
        nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "5000", unidade: "KG" }] }],
      });
    }
    const r = previsaoDoDia(db, DIA);
    expect(r.necessidade.agendamentos).toBe(2);
    expect(r.necessidade.maximo.chapas).toBe(10);
    expect(igual(r.producaoDescarga, multiplicar("200", preco))).toBe(true);
    expect(r.previsao.recomendado).toBe(r.necessidade.minimo.chapas);
    expect(r.previsao.recomendado).toBe(10);
  });

  it("ignora agendamento de origem historico", () => {
    const db = iniciar();
    const p = produto(db, { grupo: "FER" });
    agendar(db, {
      data: DIA,
      origem: "historico",
      nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "5000", unidade: "KG" }] }],
    });
    const r = previsaoDoDia(db, DIA);
    expect(igual(r.producaoDescarga, "0")).toBe(true);
    expect(r.necessidade.agendamentos).toBe(0);
  });
});

describe("previsaoDoDia: média de não descarga", () => {
  it("sem boletim: temMediaBoletim false e média zero", () => {
    const db = iniciar();
    const r = previsaoDoDia(db, DIA);
    expect(r.temMediaBoletim).toBe(false);
    expect(igual(r.mediaNaoDescarga, "0")).toBe(true);
    expect(r.previsao.tipo).toBe("sem_descarga");
    expect(r.previsao.recomendado).toBe(0);
  });

  it("média exata de 2 boletins fechados (remoção mais transferência), ignorando rascunho, histórico e datas não anteriores", () => {
    const db = iniciar();
    agendar(db, { data: DIA, destinos: ["Adubo"], nfs: [{ liquido: "900" }] });
    // boletim 1: (10 + 5) * 2 + (1 + 0) * 3 = 33
    boletim(db, {
      armazem: "Adubo",
      data: "2026-10-01",
      linhas: [
        { tipo: "Fertilizantes", remocao: "10", transferencia: "5", preco: "2" },
        { tipo: "Sementes", remocao: "1", preco: "3" },
      ],
    });
    // boletim 2: (20 + 0) * 2 = 40
    boletim(db, { armazem: "Adubo", data: "2026-10-02", linhas: [{ tipo: "Fertilizantes", remocao: "20", preco: "2" }] });
    // fora: rascunho, historico, mesma data e data posterior
    boletim(db, { armazem: "Adubo", data: "2026-10-03", status: "rascunho", linhas: [{ tipo: "Fertilizantes", remocao: "999", preco: "2" }] });
    boletim(db, { armazem: "Adubo", data: "2026-10-04", origem: "historico", linhas: [{ tipo: "Fertilizantes", remocao: "999", preco: "2" }] });
    boletim(db, { armazem: "Adubo", data: DIA, linhas: [{ tipo: "Fertilizantes", remocao: "999", preco: "2" }] });
    boletim(db, { armazem: "Adubo", data: "2026-10-07", linhas: [{ tipo: "Fertilizantes", remocao: "999", preco: "2" }] });
    // outro armazém sem agendamento no dia: fora
    boletim(db, { armazem: "Loja", data: "2026-10-01", linhas: [{ tipo: "Peças", remocao: "999", preco: "2" }] });

    const r = previsaoDoDia(db, DIA);
    expect(r.temMediaBoletim).toBe(true);
    expect(igual(r.mediaNaoDescarga, "36.5")).toBe(true); // (33 + 40) / 2
  });

  it("descarga não entra na média de não descarga", () => {
    const db = iniciar();
    agendar(db, { data: DIA, destinos: ["Adubo"], nfs: [{ liquido: "900" }] });
    boletim(db, { armazem: "Adubo", data: "2026-10-01", linhas: [{ tipo: "Fertilizantes", descarga: "500", remocao: "2", transferencia: "3", preco: "10" }] });
    expect(igual(previsaoDoDia(db, DIA).mediaNaoDescarga, "50")).toBe(true);
  });

  it("usa no máximo os 10 boletins fechados mais recentes por armazém", () => {
    const db = iniciar();
    agendar(db, { data: DIA, destinos: ["Adubo"], nfs: [{ liquido: "900" }] });
    // 12 boletins de 2026-09-01 a 2026-09-12; os 2 mais antigos valem 1000, os 10 recentes valem 10
    for (let d = 1; d <= 12; d++) {
      boletim(db, {
        armazem: "Adubo",
        data: `2026-09-${String(d).padStart(2, "0")}`,
        linhas: [{ tipo: "Fertilizantes", remocao: d <= 2 ? "1000" : "10", preco: "1" }],
      });
    }
    expect(igual(previsaoDoDia(db, DIA).mediaNaoDescarga, "10")).toBe(true);
  });

  it("soma as médias de cada armazém com agendamento", () => {
    const db = iniciar();
    agendar(db, { data: DIA, destinos: ["Adubo"], nfs: [{ liquido: "900" }] });
    agendar(db, { data: DIA, destinos: ["Insumos"], nfs: [{ liquido: "900" }] });
    boletim(db, { armazem: "Adubo", data: "2026-10-01", linhas: [{ tipo: "Fertilizantes", remocao: "10", preco: "2" }] });
    boletim(db, { armazem: "Adubo", data: "2026-10-02", linhas: [{ tipo: "Fertilizantes", remocao: "20", preco: "2" }] });
    boletim(db, { armazem: "Insumos", data: "2026-10-01", linhas: [{ tipo: "Agroquímico", transferencia: "7", preco: "3" }] });
    // Adubo: (20 + 40) / 2 = 30; Insumos: 21; soma 51
    expect(igual(previsaoDoDia(db, DIA).mediaNaoDescarga, "51")).toBe(true);
  });

  it("dia sem agendamento: usa todos os armazéns com boletim fechado, exceto Todas as áreas", () => {
    const db = iniciar();
    boletim(db, { armazem: "Adubo", data: "2026-10-01", linhas: [{ tipo: "Fertilizantes", remocao: "10", preco: "2" }] });
    boletim(db, { armazem: "Loja", data: "2026-10-01", linhas: [{ tipo: "Peças", transferencia: "5", preco: "4" }] });
    boletim(db, { armazem: "Todas as áreas", data: "2026-10-01", linhas: [{ tipo: "Peças", remocao: "999", preco: "4" }] });
    const r = previsaoDoDia(db, DIA);
    expect(r.necessidade.agendamentos).toBe(0);
    expect(r.temMediaBoletim).toBe(true);
    expect(igual(r.mediaNaoDescarga, "40")).toBe(true); // 20 + 20
    expect(r.previsao.tipo).toBe("sem_descarga_com_media");
    expect(r.previsao.recomendado).toBe(0);
    expect(r.previsao.ate).toBe(0); // 40 / 90,1731 = 0
  });

  it("com agendamento, a média entra na produção prevista junto da descarga", () => {
    const db = iniciar();
    const preco = tipoPreco(db, "Fertilizantes").precoUnitario;
    const p = produto(db, { grupo: "FER" });
    agendar(db, {
      data: DIA,
      destinos: ["Adubo"],
      nfs: [{ liquido: "5000", itens: [{ produtoId: p, quantidade: "5000", unidade: "KG" }] }],
    });
    boletim(db, { armazem: "Adubo", data: "2026-10-01", linhas: [{ tipo: "Fertilizantes", remocao: "10", preco: "2" }] });
    const r = previsaoDoDia(db, DIA);
    const esperado = dec(multiplicar("100", preco)).plus("20");
    expect(igual(r.previsao.producaoPrevista, esperado)).toBe(true);
  });
});

describe("previsaoDoDia: aviso", () => {
  it("o aviso usa textoCurtoPrestador com a recomendação", () => {
    const db = iniciar();
    agendar(db, { data: DIA, horario: "08:00", destinos: ["Adubo"], nfs: [{ liquido: "900" }] });
    const r = previsaoDoDia(db, DIA);
    expect(r.aviso).toBe(textoCurtoPrestador(r.necessidade, r.previsao.recomendado));
    expect(r.aviso).toContain("06/10/2026");
  });

  it("dia sem agendamento: aviso de que não há recebimentos", () => {
    const r = previsaoDoDia(iniciar(), DIA);
    expect(r.aviso).toBe("Agrovia, 06/10/2026: não há recebimentos agendados.");
  });
});

// ---------------------------------------------------------------------------------------------
// textoCurtoPrestador
// ---------------------------------------------------------------------------------------------

function nec(p: Partial<NecessidadeDoDia>): NecessidadeDoDia {
  return {
    data: "2026-10-06",
    agendamentos: 1,
    origens: ["teste"],
    minimo: { chapas: 6, empilhadeira: false },
    maximo: { chapas: 6, empilhadeira: false },
    semPeso: 0,
    semNf: 0,
    porAgendamento: [],
    porHorario: [],
    porArmazem: [],
    picoHorario: null,
    ...p,
  };
}

const horarioPico = {
  horario: "08:00",
  agendamentos: 2,
  minimo: { chapas: 6, empilhadeira: false },
  maximo: { chapas: 6, empilhadeira: false },
  porArmazem: [
    { armazemId: 2, nome: "Adubo", minimo: { chapas: 5, empilhadeira: false }, maximo: { chapas: 5, empilhadeira: false } },
    { armazemId: 1, nome: "Insumos", minimo: { chapas: 1, empilhadeira: false }, maximo: { chapas: 1, empilhadeira: false } },
  ],
};

describe("textoCurtoPrestador", () => {
  it("frase com horário de pico e o máximo de cada armazém do pico", () => {
    const txt = textoCurtoPrestador(nec({ picoHorario: "08:00", porHorario: [horarioPico] }), 6);
    expect(txt).toBe("Agrovia, 06/10/2026: precisamos de 6 funcionários a partir das 08:00 (Adubo 5, Insumos 1).");
    expect(txt).not.toMatch(/[—–]/);
  });

  it("usa o recomendado informado, não o da necessidade", () => {
    const txt = textoCurtoPrestador(nec({ picoHorario: "08:00", porHorario: [horarioPico] }), 3);
    expect(txt).toContain("precisamos de 3 funcionários a partir das 08:00");
  });

  it("singular para um funcionário", () => {
    const txt = textoCurtoPrestador(nec({ picoHorario: "08:00", porHorario: [horarioPico] }), 1);
    expect(txt).toContain("precisamos de 1 funcionário a partir");
    expect(txt).not.toContain("1 funcionários");
  });

  it("sem agendamento: não há recebimentos agendados", () => {
    const txt = textoCurtoPrestador(
      nec({ agendamentos: 0, origens: [], minimo: { chapas: 0, empilhadeira: false }, maximo: { chapas: 0, empilhadeira: false } }),
      0,
    );
    expect(txt).toBe("Agrovia, 06/10/2026: não há recebimentos agendados.");
  });

  it("o rótulo informado não substitui Agrovia", () => {
    const txt = textoCurtoPrestador(nec({ picoHorario: "08:00", porHorario: [horarioPico] }), 6, { rotulo: "Amanhã" });
    expect(txt.startsWith("Agrovia, 06/10/2026:")).toBe(true);
    expect(txt).not.toContain("Amanhã");
  });
});
