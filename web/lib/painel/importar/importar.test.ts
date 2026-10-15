import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { igual } from "@/lib/money";
import { periodosSemDado, tratarChapas } from "./chapas";
import { PESO_MAX_SUSPEITO_KG, tratarMovimentacao, cnpjDaChave, type ContextoMov, type LinhaMovBruta } from "./movimentacao";
import { especieParaAcondicionamento, tratarXmls } from "./nf-xml";
import { executarImportacao } from "./run";
import { paraDataISO } from "./util";

// Fixtures sintéticas: nenhum nome, número ou CNPJ de pessoa ou fornecedor real.
const CHAVE = "35240411111111000191550010000000011000000011"; // 44 dígitos, CNPJ 11111111000191 nas posições 7 a 20

function ctx(): ContextoMov {
  return {
    produtos: new Map([
      ["FER000001", { unidade: "TON", grupo: "FER" }],
      ["AGR000001", { unidade: "UN", grupo: "AGR" }],
    ]),
    fornecedorCnpj: new Map([["FD000001", "12345678000190"]]),
    grupos: new Map([
      ["FER", { armazemId: 2, preco: "0.3224", conversao: "saca_50kg" as const }],
      ["AGR", { armazemId: 1, preco: "0.3224", conversao: "unidade" as const }],
    ]),
    depositos: new Map([["MATFerti", 2]]),
    pesoMaxSuspeitoKg: PESO_MAX_SUSPEITO_KG,
  };
}

let n = 1;
function linha(o: Partial<LinhaMovBruta> = {}): LinhaMovBruta {
  const i = n++;
  return {
    linha: i + 1, pedido: 1000 + i, dataLancamento: new Date("2025-11-10T00:00:00Z"), dataDocumento: new Date("2025-11-10T00:00:00Z"),
    codPn: "FD000001", nome: "FORNECEDOR SINTETICO", codItem: "FER000001", descItem: "ADUBO SINTETICO", qtd: 139, peso: 139000,
    deposito: "MATFerti", nRecebimento: i, dataRecebimento: new Date("2025-11-17T00:00:00Z"), nf: 500 + i, chave: CHAVE, ...o,
  };
}

describe("datas", () => {
  it("converte serial do Excel, Date, dd/mm/aaaa e ISO sem erro de fuso", () => {
    expect(paraDataISO(45978)).toBe("2025-11-17");
    expect(paraDataISO(new Date("2025-11-17T00:00:00Z"))).toBe("2025-11-17");
    expect(paraDataISO("17/11/2025")).toBe("2025-11-17");
    expect(paraDataISO("2025-11-17T08:00:00-03:00")).toBe("2025-11-17");
    expect(paraDataISO("31/02/2025")).toBeNull();
    expect(paraDataISO("lixo")).toBeNull();
  });
});

describe("tratarMovimentacao", () => {
  it("linha sem data de recebimento fica marcada e fora (considerada 0), sem sumir", () => {
    const r = tratarMovimentacao([linha({ dataRecebimento: null })], ctx());
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].qualidade).toContain("sem_data");
    expect(r.linhas[0].considerada).toBe(false);
    expect(r.motivos._fora).toBe(1);
  });

  it("duplicata inteira é marcada e a primeira fica", () => {
    const a = linha();
    const r = tratarMovimentacao([a, { ...a, linha: a.linha + 1 }], ctx());
    expect(r.linhas.map((l) => l.considerada)).toEqual([true, false]);
    expect(r.linhas[1].qualidade).toContain("duplicada");
    expect(r.motivos.duplicada).toBe(1);
  });

  it("CNPJ vem do cadastro (normalizado) ou, na falta, dos dígitos 7 a 20 da chave", () => {
    expect(cnpjDaChave(CHAVE)).toBe("11111111000191");
    const r = tratarMovimentacao([linha(), linha({ codPn: "FD999999" })], ctx());
    expect(r.linhas[0].fornecedorCnpj).toBe("12345678000190");
    expect(r.linhas[1].fornecedorCnpj).toBe("11111111000191");
  });

  it("chave curta, com letras ou ausente é marcada sem derrubar a linha", () => {
    const r = tratarMovimentacao([linha({ chave: "123" }), linha({ chave: "ABC" }), linha({ chave: null })], ctx());
    expect(r.linhas[0].qualidade).toContain("chave_tamanho");
    expect(r.linhas[1].qualidade).toContain("chave_com_letras");
    expect(r.linhas[2].qualidade).toContain("sem_chave");
    expect(r.linhas.every((l) => l.considerada)).toBe(true);
  });

  it("sábado é marcado e a linha continua considerada", () => {
    const r = tratarMovimentacao([linha({ dataRecebimento: new Date("2025-11-15T00:00:00Z") })], ctx());
    expect(r.linhas[0].qualidade).toContain("fim_de_semana");
    expect(r.linhas[0].considerada).toBe(true);
  });

  it("TON: peso da linha = Qtd x 1000; sacas = peso / 50; produção = sacas x preço (P3)", () => {
    const r = tratarMovimentacao([linha({ qtd: 60, peso: 7 })], ctx()); // Peso da NF diferente de propósito
    const l = r.linhas[0];
    expect(igual(l.pesoKg!, "60000")).toBe(true);
    expect(igual(l.quantidadeBoletim!, "1200")).toBe(true);
    expect(igual(l.producaoEstimada!, "386.88")).toBe(true);
    expect(l.armazemId).toBe(2);
  });

  it("corretivo (calcário, gesso) fica fora da produção estimada, com marca; linha acima de 100 t é suspeita", () => {
    const r = tratarMovimentacao([linha({ descItem: "CALC.DOLOM.SINTETICO", qtd: 30 }), linha({ qtd: 139 }), linha({ codPn: null })], ctx());
    expect(r.linhas[0].producaoEstimada).toBeNull();
    expect(r.linhas[0].qualidade).toContain("corretivo_fora_da_producao");
    expect(r.linhas[1].qualidade).toContain("peso_suspeito");
    expect(r.linhas[1].pesoKg).toBeNull();
    expect(r.linhas[2].considerada).toBe(false);
    expect(r.linhas[2].qualidade).toContain("sem_cod_pn");
  });

  it("o Peso é o da NF: com mais de uma linha na NF ele não vira peso da linha", () => {
    const duas = [
      linha({ pedido: 7, nf: 9, codItem: "AGR000001", qtd: 3, peso: 500 }),
      linha({ pedido: 7, nf: 9, codItem: "AGR000001", qtd: 4, peso: 500, descItem: "OUTRO" }),
    ];
    const r = tratarMovimentacao(duas, ctx());
    expect(r.linhas.map((l) => l.pesoKg)).toEqual([null, null]);
    const uma = tratarMovimentacao([linha({ pedido: 8, nf: 10, codItem: "AGR000001", qtd: 3, peso: 500 })], ctx());
    expect(igual(uma.linhas[0].pesoKg!, "500")).toBe(true);
  });

  it("peso impossível é marcado e não vira peso nem produção; peso zero é marcado", () => {
    const r = tratarMovimentacao([linha({ qtd: 16, peso: 16016000, codItem: "AGR000001" }), linha({ peso: 0 })], ctx());
    expect(r.linhas[0].qualidade).toContain("peso_suspeito");
    expect(r.linhas[0].pesoKg).toBeNull();
    expect(r.linhas[1].qualidade).toContain("peso_zero");
  });

  it("item fora do cadastro: grupo pelo prefixo do código, declarado; sem armazém vira marca", () => {
    const r = tratarMovimentacao([linha({ codItem: "FER999999" }), linha({ codItem: "XYZ000001", deposito: "MATNada" })], ctx());
    expect(r.linhas[0].grupo).toBe("FER");
    expect(r.linhas[0].qualidade).toContain("grupo_pelo_prefixo");
    expect(r.linhas[1].qualidade).toContain("sem_armazem");
    expect(r.linhas[1].armazemId).toBeNull();
  });
});

describe("tratarChapas e períodos", () => {
  const b = (data: string, p: string, c: string, i: number) => ({ linha: i + 2, data, diaSemana: "", presentes: p, cafe: c, valorPago: "100.5" });

  it("café maior que presentes é marcado, contado e fora; data repetida também", () => {
    const r = tratarChapas([b("2025-03-03", "10", "0", 0), b("2025-03-04", "2", "5", 1), b("2025-03-03", "9", "0", 2)]);
    expect(r.linhas.map((l) => l.considerada)).toEqual([true, false, false]);
    expect(r.motivos.cafe_maior_que_presentes).toBe(1);
    expect(r.motivos.data_repetida).toBe(1);
  });

  it("mês sem linha vira sem_dado e mês curto vira parcial; sem interpolar", () => {
    const linhas: ReturnType<typeof b>[] = [];
    for (let d = 1; d <= 12; d++) linhas.push(b(`2025-02-${String(d).padStart(2, "0")}`, "8", "0", d));
    for (let d = 1; d <= 5; d++) linhas.push(b(`2025-03-${String(d).padStart(2, "0")}`, "8", "0", 20 + d));
    for (let d = 1; d <= 12; d++) linhas.push(b(`2025-05-${String(d).padStart(2, "0")}`, "8", "0", 40 + d));
    const p = periodosSemDado(tratarChapas(linhas).linhas, 10);
    expect(p.map((x) => [x.anoMes, x.tipo])).toEqual([["2025-03", "parcial"], ["2025-04", "sem_dado"]]);
  });
});

describe("XML", () => {
  const xml = (chave: string, esp: string | null, vols = 1) => `<nfeProc><NFe><infNFe Id="NFe${chave}">
    <ide><nNF>1</nNF><dhEmi>2025-11-10T08:00:00-03:00</dhEmi></ide><emit><CNPJ>11111111000191</CNPJ><xNome>EMITENTE SINTETICO</xNome></emit>
    <det nItem="1"><prod><cProd>X1</cProd><xProd>ITEM</xProd><qCom>1</qCom></prod></det>
    <transp><modFrete>0</modFrete>${Array.from({ length: vols }, () => `<vol><qVol>10</qVol>${esp ? `<esp>${esp}</esp>` : ""}<pesoL>100.5</pesoL><pesoB>110</pesoB></vol>`).join("")}</transp>
    </infNFe></NFe></nfeProc>`;

  it("lê chave sem o prefixo NFe, soma volumes e marca a ausência de espécie e de placa", () => {
    const r = tratarXmls([{ arquivo: "a.xml", xml: xml(CHAVE, "BIG BAG", 2) }, { arquivo: "b.xml", xml: xml(CHAVE.replace(/1$/, "2"), null) }]);
    const a = r.linhas[0];
    expect(a.chaveAcesso).toBe(CHAVE);
    expect(a.volumes).toBe("20");
    expect(igual(a.pesoLiquidoKg!, "201")).toBe(true);
    expect(a.acondicionamento).toBe("big_bag");
    expect(r.linhas[1].qualidade).toContain("sem_especie");
    expect(r.linhas[1].acondicionamento).toBeNull();
  });

  it("chave repetida fica na tabela, marcada e fora; arquivo ilegível é marcado", () => {
    const r = tratarXmls([{ arquivo: "a.xml", xml: xml(CHAVE, "PALLET") }, { arquivo: "b.xml", xml: xml(CHAVE, "PALLET") }, { arquivo: "c.xml", xml: "<lixo" }]);
    expect(r.linhas.map((l) => l.considerada)).toEqual([true, false, false]);
    expect(r.linhas[2].qualidade).toBe("xml_invalido");
  });

  it("dicionário da espécie: só o que ela diz; volume e caixa ficam sem acondicionamento (D22)", () => {
    expect(especieParaAcondicionamento("BIG-BAG 1000KG")).toBe("big_bag");
    expect(especieParaAcondicionamento("BIGBAG 500 KG")).toBe("big_bag");
    expect(especieParaAcondicionamento("PALETE")).toBe("paletizado");
    expect(especieParaAcondicionamento("SACO(S) 50 KG")).toBe("batido");
    expect(especieParaAcondicionamento("A GRANEL")).toBe("batido");
    expect(especieParaAcondicionamento("MÁQUINA")).toBe("maquina");
    expect(especieParaAcondicionamento("VOLUMES")).toBeNull();
    expect(especieParaAcondicionamento("CAIXA")).toBeNull();
    expect(especieParaAcondicionamento("TONELADA")).toBeNull();
    expect(especieParaAcondicionamento(null)).toBeNull();
  });
});

describe("executarImportacao com banco temporário", () => {
  let t: TestDb;
  afterEach(() => t?.apagar());

  function dados() {
    const csv = (data: string, p: string, c: string, i: number) => ({ linha: i + 2, data, diaSemana: "", presentes: p, cafe: c, valorPago: "100" });
    const chapas = [];
    for (let d = 1; d <= 12; d++) chapas.push(csv(`2025-02-${String(d).padStart(2, "0")}`, "8", "0", d));
    for (let d = 1; d <= 4; d++) chapas.push(csv(`2025-04-${String(d).padStart(2, "0")}`, "8", "0", 20 + d));
    const a = linha({ codItem: "FER000001", chave: CHAVE });
    return {
      movimentacao: [
        a,
        { ...a },
        linha({ dataRecebimento: null }),
        linha({ codItem: "AGR000001", qtd: 5, peso: 50, dataRecebimento: new Date("2025-11-17T00:00:00Z") }),
      ].map((l, i) => ({ ...l, linha: i + 2 })),
      chapas,
      xmls: [{ arquivo: "a.xml", xml: null }],
    };
  }

  it("grava as hist_*, o log e os períodos; lidas = ok + marcadas; rodar duas vezes dá as mesmas contagens", () => {
    t = createTestDb({ seed: true });
    const db = t.db;
    db.insert(schema.produto).values({ item: "FER000001", unidade: "TON", grupo: "FER", deposito: "MATFerti" }).run();
    db.insert(schema.produto).values({ item: "AGR000001", unidade: "UN", grupo: "AGR", deposito: "MATDefe" }).run();
    db.insert(schema.fornecedor).values({ codigo: "FD000001", razaoSocial: "FORNECEDOR SINTETICO", cnpj: "12.345.678/0001-90", origem: "historico" }).run();

    const um = executarImportacao(db, dados(), "2026-10-03T16:00:00-03:00");
    const dois = executarImportacao(db, dados(), "2026-10-03T16:05:00-03:00");
    expect(dois).toEqual(um);

    expect(um.movimentacao).toMatchObject({ lidas: 4, consideradas: 2 });
    expect(db.select().from(schema.histMovimentacao).all()).toHaveLength(4);
    const log = db.select().from(schema.histImportacaoLog).all();
    expect(log).toHaveLength(3);
    const marcadasNoBanco = db.select().from(schema.histMovimentacao).all().filter((l) => l.qualidade).length;
    const logMov = log.find((l) => l.arquivo?.includes("movimentacao"))!;
    expect(logMov.linhasMarcadas).toBe(marcadasNoBanco);
    for (const l of log) expect(l.linhasLidas).toBe(l.linhasOk + l.linhasMarcadas);
    expect(db.select().from(schema.histPeriodoSemDado).all().map((p) => `${p.anoMes}:${p.tipo}`).sort()).toEqual(["2025-03:sem_dado", "2025-04:parcial"]);
    const cargas = db.select().from(schema.histCarga).all();
    expect(cargas).toHaveLength(1);
    expect(db.select().from(schema.histCargaArmazem).all()).toHaveLength(2);
    const fer = db.select().from(schema.histMovimentacao).all().find((l) => l.codItem === "FER000001" && l.considerada)!;
    expect(fer.fornecedorCnpj).toBe("12345678000190");
  });
});
