import { describe, expect, it } from "vitest";

import { AGENDAMENTO_STATUS } from "@/lib/db/enums";

import { acondicionamentoDeOcupacao, calcularAtraso, planejarRemarcacaoPorAtraso, recusaDeTransicao, transicaoPermitida, type AgendamentoParaAtraso } from "./estado";
import type { ContextoOcupacao } from "./ocupacao";

const base: AgendamentoParaAtraso = { id: 1, status: "agendado", data: "2026-10-05", horario: "08:00", chegadaEm: null, acondicionamento: "unitizado" };
const em = (hhmmss: string) => `2026-10-05T${hhmmss}-03:00`;

describe("transições de status", () => {
  it("permite o fluxo normal e os desvios", () => {
    expect(transicaoPermitida("agendado", "chegou")).toBe(true);
    expect(transicaoPermitida("agendado", "cancelado")).toBe(true);
    expect(transicaoPermitida("agendado", "nao_recebido")).toBe(true);
    expect(transicaoPermitida("chegou", "em_descarga")).toBe(true);
    expect(transicaoPermitida("chegou", "nao_recebido")).toBe(true);
    expect(transicaoPermitida("em_descarga", "concluido")).toBe(true);
  });

  it("recusa o resto com a causa", () => {
    expect(transicaoPermitida("agendado", "concluido")).toBe(false);
    expect(transicaoPermitida("chegou", "cancelado")).toBe(false);
    expect(recusaDeTransicao("agendado", "concluido")).toMatch(/próximo passo/);
    expect(recusaDeTransicao("concluido", "chegou")).toMatch(/não muda mais/);
    expect(recusaDeTransicao("agendado", "chegou")).toBeNull();
  });

  it("estados finais não saem", () => {
    for (const final of ["concluido", "cancelado", "nao_recebido"] as const) {
      for (const para of AGENDAMENTO_STATUS) expect(transicaoPermitida(final, para)).toBe(false);
    }
  });
});

describe("atraso com tolerância de 30 min", () => {
  it("O11 exatamente 30 min não é atraso", () => {
    expect(calcularAtraso(base, em("08:30:00"), 30)).toEqual({ atrasado: false, minutos: 30 });
  });

  it("O10 31 min é atraso", () => {
    expect(calcularAtraso(base, em("08:31:00"), 30)).toEqual({ atrasado: true, minutos: 31 });
  });

  it("30 min e 59 s ainda não é atraso", () => {
    expect(calcularAtraso(base, em("08:30:59"), 30).atrasado).toBe(false);
  });

  it("antes do horário não atrasa", () => {
    expect(calcularAtraso(base, em("07:00:00"), 30)).toEqual({ atrasado: false, minutos: 0 });
  });

  it("só agendado sem chegada atrasa", () => {
    expect(calcularAtraso({ ...base, chegadaEm: em("08:10:00") }, em("09:00:00"), 30).atrasado).toBe(false);
    for (const status of ["chegou", "em_descarga", "concluido", "cancelado", "nao_recebido"] as const) {
      expect(calcularAtraso({ ...base, status }, em("09:00:00"), 30).atrasado).toBe(false);
    }
  });

  it("O10 remarca para o próximo horário livre e monta o aviso", () => {
    const ctx: ContextoOcupacao = {
      agendamentos: [
        { id: 1, data: "2026-10-05", horario: "08:00", acondicionamento: "unitizado", status: "agendado" },
        { id: 2, data: "2026-10-05", horario: "10:00", acondicionamento: "batido", status: "agendado" },
      ],
      grade: ["08:00", "10:00", "13:00", "15:00"],
      feriados: [],
      limiteUnitizados: 2,
      agora: em("08:31:00"),
    };
    const plano = planejarRemarcacaoPorAtraso(base, ctx, 30);
    expect(plano.atraso.atrasado).toBe(true);
    expect(plano.proxima).toEqual({ data: "2026-10-05", horario: "13:00" });
    expect(plano.aviso).toContain("05/10/2026 às 13:00");
  });

  it("sem atraso, nada a remarcar", () => {
    const ctx: ContextoOcupacao = { agendamentos: [], grade: ["08:00"], feriados: [], limiteUnitizados: 2, agora: em("08:30:00") };
    expect(planejarRemarcacaoPorAtraso(base, ctx, 30)).toMatchObject({ proxima: null, aviso: null });
  });
});

describe("acondicionamento de ocupação pelas NF", () => {
  it("O8 NF batida + NF paletizada conta como batido", () => {
    expect(acondicionamentoDeOcupacao(["batido", "paletizado"])).toBe("batido");
  });
  it("sem batido é unitizado", () => {
    expect(acondicionamentoDeOcupacao(["paletizado", "big_bag"])).toBe("unitizado");
    expect(acondicionamentoDeOcupacao(["big_bag"])).toBe("unitizado");
  });
});
