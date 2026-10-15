import { describe, expect, it } from "vitest";

import { calendarioDoMes, capacidadeDoDia, proximosDias, verificarOcupacao, type ContextoOcupacao, type OcupanteHorario } from "./ocupacao";

const SEGUNDA = "2026-10-05";
const TERCA = "2026-10-06";
const GRADE = ["08:00", "10:00", "13:00", "15:00"];

let seq = 0;
function ag(
  data: string,
  horario: string,
  acondicionamento: OcupanteHorario["acondicionamento"],
  status: OcupanteHorario["status"] = "agendado",
): OcupanteHorario {
  return { id: ++seq, data, horario, acondicionamento, status };
}

function ctx(agendamentos: OcupanteHorario[] = [], extra: Partial<ContextoOcupacao> = {}): ContextoOcupacao {
  return { agendamentos, grade: GRADE, feriados: [], limiteUnitizados: 2, agora: `${SEGUNDA}T07:00:00-03:00`, ...extra };
}

const pedir = (c: ContextoOcupacao, horario: string, acondicionamento: "batido" | "unitizado", data = SEGUNDA, extra = {}) =>
  verificarOcupacao(c, { data, horario, acondicionamento, ...extra });

describe("ocupação do horário", () => {
  it("O1 horário vazio aceita batido ou unitizado", () => {
    expect(pedir(ctx(), "08:00", "batido").aceita).toBe(true);
    expect(pedir(ctx(), "08:00", "unitizado").aceita).toBe(true);
  });

  it("O2 horário com 1 batido recusa qualquer outro", () => {
    const c = ctx([ag(SEGUNDA, "08:00", "batido")]);
    expect(pedir(c, "08:00", "unitizado")).toMatchObject({ aceita: false, motivo: "reservado_batido" });
    expect(pedir(c, "08:00", "batido")).toMatchObject({ aceita: false, motivo: "reservado_batido" });
  });

  it("O3 com 1 unitizado aceita mais 1, recusa o 3º e recusa batido", () => {
    const um = ctx([ag(SEGUNDA, "10:00", "unitizado")]);
    expect(pedir(um, "10:00", "unitizado").aceita).toBe(true);
    expect(pedir(um, "10:00", "batido")).toMatchObject({ aceita: false, motivo: "cheio" });
    const dois = ctx([ag(SEGUNDA, "10:00", "unitizado"), ag(SEGUNDA, "10:00", "unitizado")]);
    expect(pedir(dois, "10:00", "unitizado")).toMatchObject({ aceita: false, motivo: "cheio" });
  });

  it("O4 com 2 unitizados e 1 cancelado volta a aceitar", () => {
    const c = ctx([ag(SEGUNDA, "10:00", "unitizado"), ag(SEGUNDA, "10:00", "unitizado", "cancelado")]);
    expect(pedir(c, "10:00", "unitizado").aceita).toBe(true);
  });

  it("remarcar: o agendamento ignorado não conta contra ele mesmo", () => {
    const a = ag(SEGUNDA, "10:00", "batido");
    const r = verificarOcupacao(ctx([a]), { data: SEGUNDA, horario: "10:00", acondicionamento: "batido", ignorarAgendamentoId: a.id });
    expect(r.aceita).toBe(true);
  });

  it("O5 sábado, domingo e feriado recusam e sugerem a próxima data útil", () => {
    const c = ctx([], { feriados: ["2026-10-12"], agora: "2026-10-02T07:00:00-03:00" });
    for (const [data, proxima] of [
      ["2026-10-03", SEGUNDA],
      ["2026-10-04", SEGUNDA],
      ["2026-10-12", "2026-10-13"],
    ]) {
      const r = pedir(c, "08:00", "unitizado", data);
      expect(r).toMatchObject({ aceita: false, motivo: "dia_nao_util", proxima: { data: proxima, horario: "08:00" } });
    }
  });

  it("O6 caso fortuito ignora o limite do horário", () => {
    const c = ctx([ag(SEGUNDA, "08:00", "batido")]);
    expect(pedir(c, "08:00", "unitizado", SEGUNDA, { excecao: "caso_fortuito" })).toEqual({ aceita: true, excedeu: true });
  });

  it("O7 todos os horários do dia cheios: próxima vaga é a primeira livre depois", () => {
    const cheios = GRADE.map((h) => ag(SEGUNDA, h, "batido"));
    expect(pedir(ctx(cheios), "08:00", "unitizado")).toMatchObject({ aceita: false, proxima: { data: TERCA, horario: "08:00" } });
  });

  it("a próxima vaga serve ao acondicionamento: batido pula horário com unitizado", () => {
    const c = ctx([ag(SEGUNDA, "08:00", "batido"), ag(SEGUNDA, "10:00", "unitizado")]);
    expect(pedir(c, "08:00", "batido")).toMatchObject({ aceita: false, proxima: { data: SEGUNDA, horario: "13:00" } });
    expect(pedir(c, "08:00", "unitizado")).toMatchObject({ aceita: false, proxima: { data: SEGUNDA, horario: "10:00" } });
  });

  it("O8 um batido reserva o horário mesmo ao lado de paletizados em outro", () => {
    const c = ctx([ag(SEGUNDA, "08:00", "batido"), ag(SEGUNDA, "10:00", "unitizado")]);
    expect(pedir(c, "08:00", "unitizado").aceita).toBe(false);
    expect(pedir(c, "10:00", "unitizado").aceita).toBe(true);
  });

  it("O9 e O12 capacidade do dia: 8 menos os batidos, mínimo 4", () => {
    const batidos = (n: number) => Array.from({ length: n }, (_, i) => ag(SEGUNDA, GRADE[i % 4], "batido"));
    expect(capacidadeDoDia(SEGUNDA, [])).toBe(8);
    expect(capacidadeDoDia(SEGUNDA, [...batidos(2), ag(SEGUNDA, "13:00", "unitizado")])).toBe(6);
    expect(capacidadeDoDia(SEGUNDA, batidos(4))).toBe(4);
    expect(capacidadeDoDia(SEGUNDA, batidos(6))).toBe(4);
    expect(capacidadeDoDia(SEGUNDA, [ag(SEGUNDA, "08:00", "batido", "cancelado")])).toBe(8);
  });

  it("O13 fora da grade e data passada são recusados", () => {
    expect(pedir(ctx(), "09:00", "unitizado")).toMatchObject({ aceita: false, motivo: "fora_da_grade" });
    expect(pedir(ctx(), "08:00", "unitizado", "2026-10-02")).toMatchObject({ aceita: false, motivo: "passado" });
    const tarde = ctx([], { agora: `${SEGUNDA}T09:00:00-03:00` });
    expect(pedir(tarde, "08:00", "unitizado")).toMatchObject({ aceita: false, motivo: "passado", proxima: { data: SEGUNDA, horario: "10:00" } });
  });

  it("O14 caso fortuito em horário cheio; o comum depois é recusado", () => {
    const base = [ag(SEGUNDA, "10:00", "unitizado"), ag(SEGUNDA, "10:00", "unitizado")];
    expect(pedir(ctx(base), "10:00", "unitizado").aceita).toBe(false);
    const fortuito = ag(SEGUNDA, "10:00", "unitizado");
    expect(pedir(ctx(base), "10:00", "unitizado", SEGUNDA, { excecao: "caso_fortuito" }).aceita).toBe(true);
    expect(pedir(ctx([...base, fortuito]), "10:00", "unitizado")).toMatchObject({ aceita: false, motivo: "cheio" });
  });

  it("caso fortuito não ignora grade, dia útil nem passado", () => {
    expect(pedir(ctx(), "09:00", "unitizado", SEGUNDA, { excecao: "caso_fortuito" }).aceita).toBe(false);
    expect(pedir(ctx(), "08:00", "unitizado", "2026-10-03", { excecao: "caso_fortuito" }).aceita).toBe(false);
    expect(pedir(ctx(), "08:00", "unitizado", "2026-10-02", { excecao: "caso_fortuito" }).aceita).toBe(false);
  });

  it("prioridade ignora só o limite, como o caso fortuito; sem exceção a regra vale", () => {
    const cheio = ctx([ag(SEGUNDA, "10:00", "unitizado"), ag(SEGUNDA, "10:00", "unitizado")]);
    expect(pedir(cheio, "10:00", "unitizado").aceita).toBe(false);
    expect(pedir(cheio, "10:00", "unitizado", SEGUNDA, { excecao: "prioridade" })).toEqual({ aceita: true, excedeu: true });
    expect(pedir(cheio, "09:00", "unitizado", SEGUNDA, { excecao: "prioridade" }).aceita).toBe(false);
  });

  it("prioridade não fura a reserva de carga batida, nos dois sentidos", () => {
    const comBatido = ctx([ag(SEGUNDA, "10:00", "batido")]);
    expect(pedir(comBatido, "10:00", "unitizado", SEGUNDA, { excecao: "prioridade" })).toMatchObject({ aceita: false, motivo: "reservado_batido" });
    const comUnitizado = ctx([ag(SEGUNDA, "10:00", "unitizado")]);
    expect(pedir(comUnitizado, "10:00", "batido", SEGUNDA, { excecao: "prioridade" })).toMatchObject({ aceita: false, motivo: "cheio" });
  });

  it("calendário do mês: livre, parcial, cheio, feriado, fim de semana e passado", () => {
    const c = ctx(
      [
        ag("2026-10-06", "08:00", "unitizado"),
        ag("2026-10-07", "08:00", "batido"),
        ag("2026-10-07", "10:00", "batido"),
        ag("2026-10-07", "13:00", "batido"),
        ag("2026-10-07", "15:00", "batido"),
      ],
      { feriados: ["2026-10-12"] },
    );
    const dia = (d: string) => calendarioDoMes(c, "2026-10", "unitizado").find((x) => x.data === d)!;
    expect(calendarioDoMes(c, "2026-10", "unitizado")).toHaveLength(31);
    expect(dia("2026-10-03").estado).toBe("passado");
    expect(dia("2026-10-10").estado).toBe("fim_de_semana");
    expect(dia("2026-10-17").estado).toBe("fim_de_semana");
    expect(dia("2026-10-12").estado).toBe("feriado");
    expect(dia("2026-10-05").estado).toBe("livre");
    expect(dia("2026-10-06")).toMatchObject({ estado: "livre", livres: 4 });
    expect(dia("2026-10-07")).toMatchObject({ estado: "cheio", livres: 0 });
  });

  it("a grade mostra o motivo do horário ocupado por exceção", () => {
    const a = { ...ag("2026-10-06", "10:00", "unitizado"), excecaoOcupacao: "prioridade", excecaoMotivo: "Defensivo com prazo" };
    const dias = proximosDias(ctx([a], { agora: "2026-10-03T07:00:00-03:00" }), "unitizado", 2);
    expect(dias[1].horarios.find((h) => h.horario === "10:00")).toMatchObject({ livre: true, excecao: "prioridade: Defensivo com prazo" });
  });

  it("próximos dias úteis mostram cada horário livre ou cheio com o motivo", () => {
    const c = ctx([ag(SEGUNDA, "08:00", "batido")], { agora: "2026-10-03T07:00:00-03:00" });
    const dias = proximosDias(c, "unitizado", 3);
    expect(dias.map((d) => d.data)).toEqual([SEGUNDA, TERCA, "2026-10-07"]);
    expect(dias[0].capacidade).toBe(7);
    expect(dias[0].horarios[0]).toMatchObject({ horario: "08:00", livre: false, motivo: "reservado_batido" });
    expect(dias[0].horarios[1]).toMatchObject({ horario: "10:00", livre: true });
  });
});
