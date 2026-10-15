import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { NAO_RECEBIMENTO_MOTIVO } from "@/lib/db/enums";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { ErroDeRegra } from "@/lib/http";

import { agendarPorToken } from "./agendar";
import { carregarContexto } from "./comum";
import { criarCompra } from "./compra";
import { cargaElegivelPrioridade, cancelarAgendamento, cancelarPeloLink, listarNaoRecebimentos, listarVagasAbertas, ocuparVaga, registrarNaoRecebimento, remarcarAgendamento } from "./desvios";
import { verificarOcupacao } from "./ocupacao";

const T0 = "2026-10-05T07:00:00-03:00";
const fixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome));

let t: TestDb;
afterEach(() => t?.apagar());

function base() {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ codigo: "FT1", razaoSocial: "FORNECEDOR TESTE", cnpj: "99999999000191", origem: "teste" }).returning({ id: schema.fornecedor.id }).get();
  const agendar = (xml: string, acond: "batido" | "paletizado" | "big_bag", data: string, horario: string) => {
    const c = criarCompra(t.db, { fornecedorId: f.id, criadaPor: "compras" }, T0);
    const r = agendarPorToken(t.db, { token: c.token, arquivos: [{ nome: xml, conteudo: fixture(xml), acondicionamento: acond }], data, horario, autor: "fornecedor" }, T0);
    return { ...r, token: c.token };
  };
  return { fornecedorId: f.id, agendar };
}

describe("desvios", () => {
  it("E5 cancelar libera a vaga; o responsável escolhe o ocupante; o horário volta a aceitar", () => {
    const { agendar } = base();
    const a = agendar("nfe-palete-com-placa.xml", "paletizado", "2026-10-06", "10:00");
    const b = agendar("nfe-big-bag-sem-placa.xml", "big_bag", "2026-10-06", "10:00");
    const c = agendar("nfe-dois-itens.xml", "paletizado", "2026-10-07", "13:00");
    const ctxCheio = carregarContexto(t.db, T0);
    expect(verificarOcupacao(ctxCheio, { data: "2026-10-06", horario: "10:00", acondicionamento: "unitizado" }).aceita).toBe(false);

    const { vagaId } = cancelarAgendamento(t.db, a.agendamentoId, { motivo: "Caminhão quebrou", por: "armazem" }, "responsavel", T0);
    const ag = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, a.agendamentoId)).get()!;
    expect(ag).toMatchObject({ status: "cancelado", motivoCancelamento: "Caminhão quebrou", canceladoPor: "armazem" });

    const vagas = listarVagasAbertas(t.db, T0);
    expect(vagas).toHaveLength(1);
    expect(vagas[0].livre).toBe(true);
    expect(vagas[0].candidatos.map((x) => x.agendamentoId)).toEqual([c.agendamentoId]);

    ocuparVaga(t.db, vagaId, c.agendamentoId, "responsavel", T0);
    const movido = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, c.agendamentoId)).get()!;
    expect(movido).toMatchObject({ data: "2026-10-06", horario: "10:00", remarcacoes: 1 });
    expect(t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, c.agendamentoId)).all().map((e) => e.tipo)).toContain("vaga_ocupada");
    expect(listarVagasAbertas(t.db, T0)).toHaveLength(0);
    expect(() => ocuparVaga(t.db, vagaId, b.agendamentoId, "responsavel", T0)).toThrow(/já foi ocupada/);
    // o horário antigo do ocupante ficou livre
    expect(verificarOcupacao(carregarContexto(t.db, T0), { data: "2026-10-07", horario: "13:00", acondicionamento: "batido" }).aceita).toBe(true);
  });

  it("cancelar pelo link do fornecedor; cancelado não cancela de novo", () => {
    const { agendar } = base();
    const a = agendar("nfe-palete-com-placa.xml", "paletizado", "2026-10-06", "10:00");
    cancelarPeloLink(t.db, a.token, "Mudança de planos", T0);
    expect(() => cancelarPeloLink(t.db, a.token, "de novo", T0)).toThrow(/não muda mais/);
    expect(() => cancelarPeloLink(t.db, a.token, " ", T0)).toThrow(/motivo/);
  });

  it("D43 remarcação recusada não grava nada: data, horário, contador e eventos ficam como estavam", () => {
    const { agendar } = base();
    agendar("nfe-palete-com-placa.xml", "paletizado", "2026-10-06", "10:00");
    agendar("nfe-big-bag-sem-placa.xml", "big_bag", "2026-10-06", "10:00");
    const c = agendar("nfe-dois-itens.xml", "paletizado", "2026-10-07", "13:00");
    const eventos = () => t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, c.agendamentoId)).all().length;
    const antes = eventos();
    expect(() => remarcarAgendamento(t.db, c.agendamentoId, { data: "2026-10-06", horario: "10:00" }, "r", T0)).toThrow(ErroDeRegra);
    const ag = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, c.agendamentoId)).get()!;
    expect(ag).toMatchObject({ data: "2026-10-07", horario: "13:00", remarcacoes: 0 });
    expect(eventos()).toBe(antes);
  });

  it("O6 e O14 caso fortuito ignora o limite; o comum depois é recusado", () => {
    const { agendar } = base();
    agendar("nfe-palete-com-placa.xml", "paletizado", "2026-10-06", "10:00");
    agendar("nfe-big-bag-sem-placa.xml", "big_bag", "2026-10-06", "10:00");
    const c = agendar("nfe-dois-itens.xml", "paletizado", "2026-10-07", "13:00");
    expect(() => remarcarAgendamento(t.db, c.agendamentoId, { data: "2026-10-06", horario: "10:00" }, "responsavel", T0)).toThrow(ErroDeRegra);
    expect(() => remarcarAgendamento(t.db, c.agendamentoId, { data: "2026-10-06", horario: "10:00", excecao: "caso_fortuito" }, "responsavel", T0)).toThrow(/motivo/);
    remarcarAgendamento(t.db, c.agendamentoId, { data: "2026-10-06", horario: "10:00", excecao: "caso_fortuito", motivo: "Chuva forte" }, "responsavel", T0);

    const ag = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, c.agendamentoId)).get()!;
    expect(ag).toMatchObject({ data: "2026-10-06", horario: "10:00", excecaoOcupacao: "caso_fortuito", excecaoMotivo: "Chuva forte", remarcacoes: 1 });
    const ev = t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, c.agendamentoId)).all().find((e) => e.tipo === "remarcado")!;
    expect(JSON.parse(ev.detalhe!)).toMatchObject({ de: { data: "2026-10-07", horario: "13:00" }, para: { data: "2026-10-06", horario: "10:00" } });
    const depois = verificarOcupacao(carregarContexto(t.db, T0), { data: "2026-10-06", horario: "10:00", acondicionamento: "unitizado" });
    expect(depois.aceita).toBe(false);
  });

  it("E4 os 4 motivos de não recebimento gravam; inválidos são recusados", () => {
    const { agendar, fornecedorId } = base();
    const a = agendar("nfe-palete-com-placa.xml", "paletizado", "2026-10-06", "10:00");
    const b = agendar("nfe-big-bag-sem-placa.xml", "big_bag", "2026-10-06", "13:00");
    const c = agendar("nfe-dois-itens.xml", "paletizado", "2026-10-07", "13:00");
    registrarNaoRecebimento(t.db, { agendamentoId: a.agendamentoId, motivo: "divergencia_nota_pedido" }, "responsavel", T0);
    registrarNaoRecebimento(t.db, { agendamentoId: b.agendamentoId, motivo: "caso_fortuito" }, "responsavel", T0);
    registrarNaoRecebimento(t.db, { agendamentoId: c.agendamentoId, motivo: "outro", descricao: "Carga errada" }, "responsavel", T0);
    registrarNaoRecebimento(t.db, { fornecedorId, placa: "zzz1a11", motivo: "sem_agendamento_sem_vaga" }, "portaria", T0);

    const linhas = listarNaoRecebimentos(t.reabrir());
    expect(linhas.map((l) => l.motivo).sort()).toEqual([...NAO_RECEBIMENTO_MOTIVO].sort());
    expect(linhas.find((l) => l.motivo === "sem_agendamento_sem_vaga")).toMatchObject({ agendamentoId: null, placa: "ZZZ1A11" });
    expect(t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, a.agendamentoId)).get()?.status).toBe("nao_recebido");
    expect(t.db.select().from(schema.pendencia).all()).toHaveLength(0);

    expect(() => registrarNaoRecebimento(t.db, { motivo: "porque sim" }, "r", T0)).toThrow(/Motivo inválido/);
    expect(() => registrarNaoRecebimento(t.db, { motivo: "outro", descricao: "  " }, "r", T0)).toThrow(/exige descrição/);
    expect(() => registrarNaoRecebimento(t.db, { agendamentoId: a.agendamentoId, motivo: "caso_fortuito" }, "r", T0)).toThrow(/não muda mais/);
    expect(t.db.select().from(schema.naoRecebimento).all()).toHaveLength(4);
  });
});

describe("prioridade (D23)", () => {
  function comItem(grupo: string) {
    const b = base();
    const prod = t.db.insert(schema.produto).values({ item: `T-${grupo}`, descricao: "teste", grupo, deposito: "MATTeste" }).returning({ id: schema.produto.id }).get();
    const c = criarCompra(t.db, { fornecedorId: b.fornecedorId, itens: [{ produtoId: prod.id, descricao: "teste" }], criadaPor: "compras" }, T0);
    const r = agendarPorToken(t.db, { token: c.token, arquivos: [{ nome: "a.xml", conteudo: fixture("nfe-palete-com-placa.xml"), acondicionamento: "paletizado" }], data: "2026-10-07", horario: "13:00", autor: "f" }, T0);
    return { ...b, id: r.agendamentoId };
  }
  function encher() {
    for (const [i, xml] of ["nfe-big-bag-sem-placa.xml", "nfe-dois-itens.xml"].entries()) {
      const c = criarCompra(t.db, { fornecedorId: 1, criadaPor: "c" }, T0);
      agendarPorToken(t.db, { token: c.token, arquivos: [{ nome: xml, conteudo: fixture(xml), acondicionamento: "paletizado" }], data: "2026-10-06", horario: "10:00", autor: String(i) }, T0);
    }
  }

  it("só carga com defensivo ou fertilizante é elegível", () => {
    const f = comItem("FER");
    expect(cargaElegivelPrioridade(t.db, f.id)).toBe(true);
    t.apagar();
    const m = comItem("PEC");
    expect(cargaElegivelPrioridade(t.db, m.id)).toBe(false);
  });

  it("aceita além do limite com justificativa, grava excecao_ocupacao e evento com origem", () => {
    const { id } = comItem("AGR");
    encher();
    expect(() => remarcarAgendamento(t.db, id, { data: "2026-10-06", horario: "10:00" }, "r", T0)).toThrow(ErroDeRegra);
    expect(() => remarcarAgendamento(t.db, id, { data: "2026-10-06", horario: "10:00", excecao: "prioridade" }, "r", T0)).toThrow(/justificativa/);
    remarcarAgendamento(t.db, id, { data: "2026-10-06", horario: "10:00", excecao: "prioridade", motivo: "Defensivo com prazo de aplicação" }, "r", T0);
    const ag = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;
    expect(ag).toMatchObject({ excecaoOcupacao: "prioridade", excecaoMotivo: "Defensivo com prazo de aplicação", prioridade: true, horario: "10:00" });
    const ev = t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, id)).all().find((e) => e.tipo === "remarcado")!;
    expect(JSON.parse(ev.detalhe!)).toMatchObject({ excecao: "prioridade" });
    expect(JSON.parse(ev.detalhe!).origem).toBeTruthy();
  });

  it("carga sem defensivo ou fertilizante não pode pedir prioridade", () => {
    const { id } = comItem("PEC");
    encher();
    expect(() => remarcarAgendamento(t.db, id, { data: "2026-10-06", horario: "10:00", excecao: "prioridade", motivo: "x" }, "r", T0)).toThrow(/defensivo ou fertilizante/);
  });
});
