import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { ErroDeRegra } from "@/lib/http";

import { agendarPorToken } from "./agendar";
import { criarCompra } from "./compra";
import { cnpjDaChave, conferirNota } from "./conferencia";
import { lerNfeXml } from "./nf-xml";
import { recusarRecebimentoDaConferencia, registrarChegadaDaConferencia } from "./portaria";

const fixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome));
const nfDe = (nome: string) => lerNfeXml(fixture(nome).toString("utf8"));
const CRIACAO = "2026-10-02T09:00:00-03:00";
/** Hoje: terça 06/10, 10:05. */
const HOJE = "2026-10-06T10:05:00-03:00";

let t: TestDb;
afterEach(() => t?.apagar());

function preparar(opcoes: { cnpj?: string | null; itens?: boolean } = {}) {
  t = createTestDb({ seed: true });
  const f = t.db
    .insert(schema.fornecedor)
    .values({ codigo: "FT1", razaoSocial: "FORNECEDOR TESTE", cnpj: opcoes.cnpj === undefined ? "99999999000191" : opcoes.cnpj, origem: "teste" })
    .returning({ id: schema.fornecedor.id })
    .get();
  const agendar = (xml: string, data = "2026-10-06", horario = "10:00", itens = opcoes.itens) => {
    const c = criarCompra(
      t.db,
      { fornecedorId: f.id, itens: itens ? [{ descricao: "Adubo", quantidade: "1", pesoKg: "1" }] : [], criadaPor: "compras" },
      CRIACAO,
    );
    return agendarPorToken(t.db, { token: c.token, arquivos: [{ nome: xml, conteudo: fixture(xml), acondicionamento: "paletizado" }], data, horario, autor: "fornecedor" }, CRIACAO).agendamentoId;
  };
  return { fornecedorId: f.id, agendar };
}
const ag = (id: number) => t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;
const item = (r: ReturnType<typeof conferirNota>, chave: string) => r.itens.find((i) => i.chave === chave)!;

describe("conferência da nota na portaria", () => {
  it("chave igual e tudo certo: confere", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const r = conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE);
    expect(r).toMatchObject({ veredito: "confere", agendamentoId: id });
    expect(r.numero).toBe(`AG-2026-${String(id).padStart(6, "0")}`);
    expect(r.resumo).toContain(r.numero!);
    expect(r.itens.filter((i) => i.resultado === "nao_bate")).toHaveLength(0);
  });

  it("só a chave digitada também acha o agendamento", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const chave = nfDe("nfe-palete-com-placa.xml").chaveAcesso;
    expect(conferirNota(t.db, { chave: ` ${chave.slice(0, 20)} ${chave.slice(20)} ` }, HOJE)).toMatchObject({ veredito: "confere", agendamentoId: id });
    expect(() => conferirNota(t.db, { chave: "123" }, HOJE)).toThrow(ErroDeRegra);
  });

  it("o CNPJ do emitente sai da chave", () => {
    expect(cnpjDaChave(nfDe("nfe-palete-com-placa.xml").chaveAcesso)).toBe("99999999000191");
  });

  it("chave diferente do mesmo fornecedor: a nota não é a anexada", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const r = conferirNota(t.db, { nf: nfDe("nfe-dois-itens.xml") }, HOJE);
    expect(r).toMatchObject({ veredito: "divergente", agendamentoId: id });
    expect(item(r, "nota")).toMatchObject({ resultado: "nao_bate", naNota: "9004", noAgendamento: "9001" });
    expect(item(r, "nota").mensagem).toMatch(/não é a que foi anexada/);
    expect(item(r, "fornecedor").resultado).toBe("bate");
  });

  it("CNPJ diferente: o fornecedor não bate", () => {
    const { agendar } = preparar({ cnpj: "11222333000181" });
    agendar("nfe-palete-com-placa.xml");
    const r = conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE);
    expect(r.veredito).toBe("divergente");
    expect(item(r, "fornecedor").resultado).toBe("nao_bate");
    expect(item(r, "fornecedor").mensagem).toContain("11222333000181");
  });

  it("dia errado: divergente com as duas datas", () => {
    const { agendar } = preparar();
    agendar("nfe-palete-com-placa.xml", "2026-10-07");
    const r = conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE);
    expect(r.veredito).toBe("divergente");
    expect(item(r, "dia").mensagem).toBe("Agendado para 07/10, hoje é 06/10.");
    expect(r.itens.some((i) => i.chave === "horario")).toBe(false);
  });

  it("horário: 30 min ainda bate, 40 min é aviso e não bloqueia", () => {
    const { agendar } = preparar();
    agendar("nfe-palete-com-placa.xml", "2026-10-06", "10:00");
    const nf = nfDe("nfe-palete-com-placa.xml");
    expect(conferirNota(t.db, { nf }, "2026-10-06T10:30:00-03:00").veredito).toBe("confere");
    const r = conferirNota(t.db, { nf }, "2026-10-06T10:40:00-03:00");
    expect(r.veredito).toBe("confere_com_aviso");
    expect(item(r, "horario")).toMatchObject({ resultado: "aviso", mensagem: "Chegou 40 min depois do horário." });
  });

  it("placa diferente é aviso; igual bate; placa digitada vale mais que a da nota", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    t.db.update(schema.agendamento).set({ placa: "ABC-1D23" }).where(eq(schema.agendamento.id, id)).run();
    const nf = nfDe("nfe-palete-com-placa.xml");
    expect(item(conferirNota(t.db, { nf }, HOJE), "placa").resultado).toBe("bate");
    const r = conferirNota(t.db, { nf, placa: "zzz9z99" }, HOJE);
    expect(r.veredito).toBe("confere_com_aviso");
    expect(item(r, "placa")).toMatchObject({ resultado: "aviso", naNota: "ZZZ9Z99", noAgendamento: "ABC1D23" });
  });

  it("pedido de compra com itens: quantidade e peso diferentes são divergência", () => {
    const { agendar } = preparar({ itens: true });
    agendar("nfe-palete-com-placa.xml");
    const r = conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE);
    expect(item(r, "pedido").resultado).toBe("nao_bate");
    expect(r.veredito).toBe("divergente");
    expect(item(r, "pedido").mensagem).toMatch(/Quantidade|Peso/);
  });

  it("sem itens na compra o pedido não se aplica", () => {
    const { agendar } = preparar();
    agendar("nfe-palete-com-placa.xml");
    expect(item(conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE), "pedido").resultado).toBe("nao_se_aplica");
  });

  it("sem a chave anexada: um candidato pelo CNPJ é conferido, e a nota não bate", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const r = conferirNota(t.db, { nf: nfDe("nfe-sem-especie.xml") }, HOJE);
    expect(r.agendamentoId).toBe(id);
    expect(r.veredito).toBe("divergente");
    expect(item(r, "nota").resultado).toBe("nao_bate");
  });

  it("dois candidatos pelo CNPJ: devolve a lista, hoje primeiro, depois futuros e atrasados", () => {
    const { agendar } = preparar();
    const futuro = agendar("nfe-palete-com-placa.xml", "2026-10-08");
    const hoje = agendar("nfe-dois-itens.xml", "2026-10-06", "13:00");
    const atrasado = agendar("nfe-big-bag-sem-placa.xml", "2026-10-05");
    const r = conferirNota(t.db, { nf: nfDe("nfe-sem-especie.xml") }, HOJE);
    expect(r.veredito).toBe("escolher");
    expect(r.candidatos.map((c) => c.agendamentoId)).toEqual([hoje, futuro, atrasado]);
    const escolhido = conferirNota(t.db, { nf: nfDe("nfe-sem-especie.xml"), agendamentoId: hoje }, HOJE);
    expect(escolhido.agendamentoId).toBe(hoje);
  });

  it("agendamento ainda aguardando aprovação não confere", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    t.db.update(schema.agendamento).set({ aprovacao: "aguardando" }).where(eq(schema.agendamento.id, id)).run();
    const r = conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE);
    expect(r.veredito).toBe("divergente");
    expect(r.resumo).toBe("Agendamento ainda não aprovado por Compras");
  });

  it("nota de agendamento já concluído ou que já chegou não confere", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    t.db.update(schema.agendamento).set({ status: "concluido" }).where(eq(schema.agendamento.id, id)).run();
    expect(conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE).resumo).toBe("Este agendamento já foi descarregado");
    t.db.update(schema.agendamento).set({ status: "chegou" }).where(eq(schema.agendamento.id, id)).run();
    expect(conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE).resumo).toBe("Este agendamento já registrou a chegada");
  });

  it("agendamento cancelado não conta: a nota fica sem agendamento", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    t.db.update(schema.agendamento).set({ status: "cancelado" }).where(eq(schema.agendamento.id, id)).run();
    expect(conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml") }, HOJE).veredito).toBe("sem_agendamento");
  });

  it("sem agendamento nenhum", () => {
    preparar();
    const r = conferirNota(t.db, { nf: nfDe("nfe-palete-com-placa.xml"), placa: "ABC1D23" }, HOJE);
    expect(r).toMatchObject({ veredito: "sem_agendamento", agendamentoId: null, candidatos: [], cnpjEmitente: "99999999000191" });
  });
});

describe("chegada pela conferência", () => {
  it("confere: registra a chegada com o evento e sem pendência", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const chave = nfDe("nfe-palete-com-placa.xml").chaveAcesso;
    const r = registrarChegadaDaConferencia(t.db, { agendamentoId: id, chave, pesoBalancaKg: "20500" }, "portaria", HOJE);
    expect(r).toMatchObject({ veredito: "confere", pendenciaId: null });
    expect(ag(id)).toMatchObject({ status: "chegou", chegadaEm: HOJE });
    const ev = t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, id)).all().find((e) => e.tipo === "chegou")!;
    expect(JSON.parse(ev.detalhe!)).toMatchObject({ conferencia: "confere", origem: expect.any(String) });
  });

  it("divergente exige observação e abre pendência; sem observação não grava nada", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml", "2026-10-07");
    const chave = nfDe("nfe-palete-com-placa.xml").chaveAcesso;
    expect(() => registrarChegadaDaConferencia(t.db, { agendamentoId: id, chave, pesoBalancaKg: "20500" }, "portaria", HOJE)).toThrow(/Explique o motivo/);
    expect(ag(id).status).toBe("agendado");
    const r = registrarChegadaDaConferencia(t.db, { agendamentoId: id, chave, pesoBalancaKg: "20500", observacao: "Motorista adiantou a entrega" }, "portaria", HOJE);
    expect(r.veredito).toBe("divergente");
    expect(r.pendenciaId).not.toBeNull();
    expect(t.db.select().from(schema.pendencia).where(eq(schema.pendencia.agendamentoId, id)).get()?.descricao).toContain("Motorista adiantou");
    expect(ag(id).status).toBe("chegou");
  });

  it("pedido aguardando aprovação: a chegada é recusada", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    t.db.update(schema.agendamento).set({ aprovacao: "aguardando" }).where(eq(schema.agendamento.id, id)).run();
    expect(() => registrarChegadaDaConferencia(t.db, { agendamentoId: id, chave: nfDe("nfe-palete-com-placa.xml").chaveAcesso }, "portaria", HOJE)).toThrow(/não foi aprovado/);
  });

  it("sem a chave a chegada não é registrada (a conferência não pode ser pulada)", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml", "2026-10-07");
    expect(() => registrarChegadaDaConferencia(t.db, { agendamentoId: id, chave: "" }, "portaria", HOJE)).toThrow(/Confira a nota/);
    expect(ag(id).status).toBe("agendado");
  });

  it("o servidor refaz a conferência com o XML da tela: pedido divergente no XML abre pendência", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const nf = { ...nfDe("nfe-palete-com-placa.xml"), pesoLiquidoKg: "1" };
    const compraId = ag(id).compraId!;
    t.db.insert(schema.compraItem).values({ compraId, descricao: "Adubo", quantidade: "1", pesoKg: "9999" }).run();
    const r = registrarChegadaDaConferencia(t.db, { agendamentoId: id, chave: nf.chaveAcesso, nf, observacao: "Peso diferente do pedido", pesoBalancaKg: "1" }, "portaria", HOJE);
    expect(r.veredito).toBe("divergente");
    expect(r.pendenciaId).not.toBeNull();
  });

  it("recusa só vale para nota divergente de pedido aprovado", () => {
    const { agendar } = preparar();
    const id = agendar("nfe-palete-com-placa.xml");
    const chave = nfDe("nfe-palete-com-placa.xml").chaveAcesso;
    expect(() => recusarRecebimentoDaConferencia(t.db, { agendamentoId: id, chave, descricao: "x" }, "portaria", HOJE)).toThrow(/confere/);
    const outro = agendar("nfe-dois-itens.xml", "2026-10-07");
    const chave2 = nfDe("nfe-dois-itens.xml").chaveAcesso;
    expect(recusarRecebimentoDaConferencia(t.db, { agendamentoId: outro, chave: chave2, descricao: "Fora do dia" }, "portaria", HOJE).id).toBeGreaterThan(0);
    t.db.update(schema.agendamento).set({ aprovacao: "aguardando" }).where(eq(schema.agendamento.id, id)).run();
    expect(() => recusarRecebimentoDaConferencia(t.db, { agendamentoId: id, chave, descricao: "x" }, "portaria", HOJE)).toThrow(/não foi aprovado/);
  });
});
