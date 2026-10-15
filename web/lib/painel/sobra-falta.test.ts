import { describe, expect, it } from "vitest";
import { deInteiro, formatNumero, igual } from "@/lib/money";
import {
  avaliarDia,
  avaliarDias,
  diariasJustificadas,
  efetivoDoDia,
  ehFimDeSemana,
  producaoEstimada,
  reaisDoSaldo,
  resumirMeses,
  resumirPeriodo,
  resumirPorOrigem,
  saldoDeDiarias,
  type DiaEntrada,
} from "./sobra-falta";

const PISO = "90.1731";

describe("P1: saldo em funcionários e palavra (excesso ou falta)", () => {
  it("presentes 15, café 3, justificadas 5 dá +7 excesso", () => {
    const { efetivo, inconsistente } = efetivoDoDia(15, 3);
    expect(inconsistente).toBe(false);
    expect(igual(efetivo!, "12")).toBe(true);
    const r = saldoDeDiarias(efetivo!, "5");
    expect(igual(r.saldo, "7")).toBe(true);
    expect(r.rotulo).toBe("excesso");
  });

  it("efetivo 3 e justificadas 5 dá -2 falta", () => {
    const r = saldoDeDiarias("3", "5");
    expect(igual(r.saldo, "-2")).toBe(true);
    expect(r.rotulo).toBe("falta");
  });

  it("efetivo igual às justificadas é equilíbrio", () => {
    expect(saldoDeDiarias("5", "5").rotulo).toBe("equilibrio");
  });

  it("café maior que presentes é marcado, não vira efetivo negativo", () => {
    const r = efetivoDoDia(2, 5);
    expect(r.inconsistente).toBe(true);
    expect(r.efetivo).toBeNull();
  });

  it("a linha inconsistente é contada e fica fora do resumo", () => {
    const dias: DiaEntrada[] = [
      { data: "2025-03-03", origem: "historico", efetivo: efetivoDoDia(10, 0).efetivo, producao: "901.731" },
      { data: "2025-03-04", origem: "historico", efetivo: efetivoDoDia(2, 5).efetivo, producao: "901.731", inconsistente: true },
    ];
    const resumo = resumirPeriodo(dias, PISO)!;
    expect(resumo.diasConsiderados).toBe(1);
    expect(resumo.inconsistentes).toBe(1);
  });
});

describe("P2: reais = |saldo| x piso", () => {
  it("excesso de 7 dá 631,2117 (exibe 631,21)", () => {
    const v = reaisDoSaldo("7", PISO);
    expect(igual(v, "631.2117")).toBe(true);
    expect(formatNumero(v)).toBe("631,21");
  });

  it("falta de 2 dá 180,3462 (exibe 180,35)", () => {
    const v = reaisDoSaldo("-2", PISO);
    expect(igual(v, "180.3462")).toBe(true);
    expect(formatNumero(v)).toBe("180,35");
  });
});

describe("P3: histórico, 139.000 kg de fertilizante e efetivo 11", () => {
  it("2.780 sacas, produção 896,2720, justificadas 9,94, excesso 1,06, complemento 95,6321", () => {
    const est = producaoEstimada({ conversao: "saca_50kg", pesoKg: "139000", quantidade: null, preco: "0.3224" });
    expect(igual(est.quantidadeBoletim!, "2780")).toBe(true);
    expect(igual(est.producao!, "896.272")).toBe(true);
    const dia = avaliarDia({ efetivo: deInteiro(11), producao: est.producao!, piso: PISO });
    expect(formatNumero(dia.justificadas)).toBe("9,94");
    expect(dia.rotulo).toBe("excesso");
    expect(formatNumero(dia.saldo)).toBe("1,06");
    expect(igual(dia.reais, "95.6321")).toBe(true);
    expect(igual(dia.excessoReais, "95.6321")).toBe(true);
    expect(igual(dia.faltaReais, "0")).toBe(true);
  });

  it("grupo em unidade usa a quantidade e o preço do tipo", () => {
    const est = producaoEstimada({ conversao: "unidade", pesoKg: null, quantidade: "30", preco: "0.3224" });
    expect(igual(est.quantidadeBoletim!, "30")).toBe(true);
    expect(igual(est.producao!, "9.672")).toBe(true);
  });

  it("grupo sem preço fica sem produção e diz o motivo", () => {
    const est = producaoEstimada({ conversao: "unidade", pesoKg: null, quantidade: "30", preco: null });
    expect(est.producao).toBeNull();
    expect(est.motivoSem).toBe("sem_preco");
  });

  it("sacas sem peso fica sem quantidade", () => {
    const est = producaoEstimada({ conversao: "saca_50kg", pesoKg: null, quantidade: null, preco: "0.3224" });
    expect(est.quantidadeBoletim).toBeNull();
    expect(est.motivoSem).toBe("sem_quantidade");
  });
});

describe("falta: produção acima do que o efetivo cobre ao piso", () => {
  it("efetivo 3 e produção de 5 diárias dá falta de 2 funcionários e R$ 180,3462", () => {
    const producao = "450.8655"; // 5 x 90,1731
    const dia = avaliarDia({ efetivo: "3", producao, piso: PISO });
    expect(dia.rotulo).toBe("falta");
    expect(igual(dia.saldo, "-2")).toBe(true);
    expect(igual(dia.faltaReais, "180.3462")).toBe(true);
    expect(igual(dia.excessoReais, "0")).toBe(true);
    expect(igual(dia.custo, producao)).toBe(true);
  });

  it("custo do dia é o maior entre piso x efetivo e a produção (D31)", () => {
    expect(igual(avaliarDia({ efetivo: "11", producao: "918.1952", piso: PISO }).custo, "991.9041")).toBe(true);
    expect(igual(avaliarDia({ efetivo: "3", producao: "450.8655", piso: PISO }).custo, "450.8655")).toBe(true);
  });
});

describe("P5: boletim novo, produção 918,1952 e 11 diárias", () => {
  it("excesso 0,82 funcionário e R$ 73,7089 (igual ao complemento do boletim)", () => {
    const dia = avaliarDia({ efetivo: "11", producao: "918.1952", piso: PISO });
    expect(formatNumero(dia.justificadas)).toBe("10,18");
    expect(dia.rotulo).toBe("excesso");
    expect(formatNumero(dia.saldo)).toBe("0,82");
    expect(igual(dia.reais, "73.7089")).toBe(true);
  });

  it("meia diária entra como 0,5 no efetivo", () => {
    const dia = avaliarDia({ efetivo: "10.5", producao: "918.1952", piso: PISO });
    expect(igual(dia.reais, "28.62235")).toBe(true);
  });
});

function dia(data: string, efetivo: number, producao: string, origem: DiaEntrada["origem"] = "historico"): DiaEntrada {
  return { data, origem, efetivo: deInteiro(efetivo), producao };
}

describe("P4: meses sem dado e parciais ficam fora da média", () => {
  const dias: DiaEntrada[] = [
    dia("2025-10-01", 10, "901.731"), // justificadas 10: equilíbrio
    dia("2025-10-02", 12, "901.731"), // excesso 2
    dia("2025-11-03", 8, "901.731"), // falta 2
    dia("2025-11-04", 10, "901.731"), // equilíbrio
    dia("2026-01-05", 15, "901.731"), // parcial: fora da média
  ];
  const r = resumirMeses(dias, {
    meses: ["2025-10", "2025-11", "2025-12", "2026-01"],
    statusMes: { "2025-12": "sem_dado", "2026-01": "parcial" },
    piso: PISO,
  });

  it("marca o status de cada mês e não devolve resumo para sem dado ou parcial", () => {
    expect(r.meses.map((m) => m.status)).toEqual(["ok", "ok", "sem_dado", "parcial"]);
    expect(r.meses[2].resumo).toBeNull();
    expect(r.meses[3].resumo).toBeNull();
    expect(r.mesesComDado).toBe(2);
    expect(r.mesesForaDasMedias).toBe(2);
  });

  it("a média do período usa só os meses com dado, sem NaN", () => {
    const p = r.periodo!;
    expect(p.diasConsiderados).toBe(4);
    expect(p.diasExcesso).toBe(1);
    expect(p.diasFalta).toBe(1);
    expect(igual(p.excessoMedioChapas, "0.5")).toBe(true); // 2 / 4 dias
    expect(igual(p.faltaMediaChapas, "0.5")).toBe(true);
    expect(igual(p.saldoMedioChapas, "0")).toBe(true);
  });

  it("período sem nenhum mês com dado devolve null, nunca zero", () => {
    const vazio = resumirMeses([], { meses: ["2025-08", "2025-12"], statusMes: { "2025-08": "sem_dado", "2025-12": "sem_dado" }, piso: PISO });
    expect(vazio.periodo).toBeNull();
    expect(vazio.meses.map((m) => m.status)).toEqual(["sem_dado", "sem_dado"]);
  });

  it("mês pedido sem nenhuma linha e sem marca é sem dado", () => {
    const r2 = resumirMeses([dia("2025-10-01", 10, "901.731")], { meses: ["2025-10", "2025-12"], statusMes: {}, piso: PISO });
    expect(r2.meses[1].status).toBe("sem_dado");
  });
});

describe("pico e reais do período", () => {
  it("dia de pico é o de produção no topo de 10% e traz a falta média nele", () => {
    const dias: DiaEntrada[] = [];
    for (let i = 1; i <= 9; i++) dias.push(dia(`2025-10-${String(i).padStart(2, "0")}`, 8, "450.8655")); // 5 diárias, excesso 3
    dias.push(dia("2025-10-10", 3, "901.731")); // 10 diárias, efetivo 3: falta 7
    const r = resumirPeriodo(dias, PISO)!;
    expect(r.pico.dias).toBe(1);
    expect(igual(r.pico.faltaMediaChapas, "7")).toBe(true);
    expect(igual(r.pico.faltaMedianaChapas, "7")).toBe(true);
    expect(igual(r.faltaReaisTotal, "631.2117")).toBe(true);
    expect(igual(r.excessoReaisTotal, "2434.6737")).toBe(true); // 9 x 3 x 90,1731
  });
});

describe("P6: origens nunca somadas sem rótulo", () => {
  const dias: DiaEntrada[] = [dia("2025-10-01", 12, "901.731", "historico"), dia("2025-10-02", 12, "901.731", "teste")];

  it("resumirPeriodo recusa origens misturadas", () => {
    expect(() => resumirPeriodo(dias, PISO)).toThrow(/origem/i);
  });

  it("resumirPorOrigem devolve um resumo por origem, cada um rotulado", () => {
    const r = resumirPorOrigem(dias, PISO);
    expect(r.map((x) => x.origem).sort()).toEqual(["historico", "teste"]);
    for (const x of r) {
      expect(x.resumo.origem).toBe(x.origem);
      expect(x.resumo.diasConsiderados).toBe(1);
    }
  });
});

describe("avaliarDias", () => {
  it("separa o que não pode ser comparado: sem produção e inconsistente", () => {
    const r = avaliarDias(
      [
        dia("2025-10-01", 10, "901.731"),
        { data: "2025-10-02", origem: "historico", efetivo: deInteiro(10), producao: null },
        { data: "2025-10-03", origem: "historico", efetivo: null, producao: "10", inconsistente: true },
      ],
      PISO,
    );
    expect(r.avaliados).toHaveLength(1);
    expect(r.semProducao).toBe(1);
    expect(r.inconsistentes).toBe(1);
  });

  it("piso zero ou negativo falha em vez de dividir por zero", () => {
    expect(() => diariasJustificadas("100", "0")).toThrow();
    expect(() => avaliarDia({ efetivo: "1", producao: "1", piso: "0" })).toThrow();
    expect(() => reaisDoSaldo("1", "-5")).toThrow();
  });

  it("efetivo ou produção negativos falham", () => {
    expect(() => avaliarDia({ efetivo: "-1", producao: "1", piso: PISO })).toThrow();
  });

  it("efetivoDoDia recusa valor não inteiro ou negativo e resumo vazio é null", () => {
    expect(efetivoDoDia(2.5, 0).inconsistente).toBe(true);
    expect(efetivoDoDia(-1, 0).inconsistente).toBe(true);
    expect(resumirPeriodo([], PISO)).toBeNull();
  });

  it("ehFimDeSemana reconhece sábado e domingo e recusa data inválida", () => {
    expect(ehFimDeSemana("2025-11-15")).toBe(true); // sábado
    expect(ehFimDeSemana("2025-11-16")).toBe(true); // domingo
    expect(ehFimDeSemana("2025-11-17")).toBe(false);
    expect(() => ehFimDeSemana("17/11/2025")).toThrow();
  });

  it("pico com 30 dias tem 3 dias (sem erro de ponto flutuante)", () => {
    const dias: DiaEntrada[] = [];
    for (let i = 1; i <= 30; i++) dias.push(dia(`2025-10-${String(i).padStart(2, "0")}`, 8, "450.8655"));
    expect(resumirPeriodo(dias, PISO)!.pico.dias).toBe(3);
  });
});
