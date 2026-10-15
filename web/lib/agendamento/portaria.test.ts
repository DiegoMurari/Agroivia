import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";

import { agendarPorToken, lerArquivoParaDownload, nfDoPdf, pesoDeclarado } from "./agendar";
import { criarCompra } from "./compra";
import { lerNfeXml } from "./nf-xml";
import { atrasosAvisados, caminhaoSemAgendamento, listarAvisos, registrarAtrasoManual, remarcarPorAtraso } from "./portaria";

const fx = (n: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", n));
let t: TestDb;
afterEach(() => t?.apagar());

function base(agora: string) {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ codigo: "F1", razaoSocial: "FORN", cnpj: "99999999000191", origem: "teste" }).returning({ id: schema.fornecedor.id }).get();
  const ag = (xml: string, data: string, h: string) => {
    const c = criarCompra(t.db, { fornecedorId: f.id, criadaPor: "c" }, agora);
    return agendarPorToken(t.db, { token: c.token, arquivos: [{ nome: xml, conteudo: fx(xml), acondicionamento: "paletizado" }], data, horario: h, autor: "f" }, agora).agendamentoId;
  };
  return { f, ag };
}

describe("atraso", () => {
  it("O10 31 min remarca e grava aviso; 30 min recusa", () => {
    const { ag } = base("2026-10-05T07:00:00-03:00");
    const id = ag("nfe-palete-com-placa.xml", "2026-10-05", "08:00");
    expect(() => remarcarPorAtraso(t.db, id, "responsavel", "2026-10-05T08:30:00-03:00")).toThrow(/não está atrasado/);
    const r = remarcarPorAtraso(t.db, id, "responsavel", "2026-10-05T08:31:00-03:00");
    expect(r.proxima).toEqual({ data: "2026-10-05", horario: "10:00" });
    const a = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;
    expect(a).toMatchObject({ horario: "10:00", remarcacoes: 1 });
    expect(listarAvisos(t.db, id)).toHaveLength(1);
  });
});

describe("sem agendamento", () => {
  it("com vaga hoje agenda na hora", () => {
    const { f } = base("2026-10-05T07:00:00-03:00");
    const r = caminhaoSemAgendamento(t.db, { fornecedorId: f.id, placa: "abc1d23", acondicionamento: "unitizado" }, "portaria", "2026-10-05T07:00:00-03:00");
    expect(r.agendado).toBe(true);
    expect(t.db.select().from(schema.agendamento).all()[0]).toMatchObject({ agendadoNaHora: true, status: "chegou", compraId: null, placa: "ABC1D23" });
  });
  it("com o XML da nota, o pedido criado na hora nasce com a NF, o peso e a observação", () => {
    const { f } = base("2026-10-05T07:00:00-03:00");
    const conteudo = fx("nfe-palete-com-placa.xml");
    const nf = lerNfeXml(conteudo.toString("utf8"));
    const r = caminhaoSemAgendamento(
      t.db,
      { fornecedorId: f.id, placa: nf.placa, acondicionamento: "unitizado", nota: { arquivo: { nome: "nota.xml", conteudo, acondicionamento: nf.acondicionamentoSugerido ?? "batido" }, nf } },
      "portaria",
      "2026-10-05T07:00:00-03:00",
    );
    expect(r.agendado).toBe(true);
    const ag = t.db.select().from(schema.agendamento).all()[0];
    expect(ag.pesoDeclaradoKg).toBe(pesoDeclarado([nf]));
    expect(ag.observacao).toContain(`NF ${nf.numero}`);
    expect(t.db.select().from(schema.agendamentoNf).all()).toHaveLength(1);
    expect(t.db.select().from(schema.notaFiscal).all()[0]).toMatchObject({ chaveAcesso: nf.chaveAcesso, numero: nf.numero });
    expect(t.db.select().from(schema.notaFiscalItem).all().length).toBe(nf.itens.length);
  });
  it("o peso digitado na portaria vale mais que o da nota", () => {
    const { f } = base("2026-10-05T07:00:00-03:00");
    const conteudo = fx("nfe-palete-com-placa.xml");
    const nf = lerNfeXml(conteudo.toString("utf8"));
    caminhaoSemAgendamento(t.db, { fornecedorId: f.id, acondicionamento: "unitizado", pesoKg: "1234,5", nota: { arquivo: { nome: "n.xml", conteudo, acondicionamento: "paletizado" }, nf } }, "portaria", "2026-10-05T07:00:00-03:00");
    expect(t.db.select().from(schema.agendamento).all()[0].pesoDeclaradoKg).toBe("1234.5");
  });
  it("sem vaga registra não recebimento e mostra a próxima data", () => {
    const { f } = base("2026-10-05T16:00:00-03:00");
    const r = caminhaoSemAgendamento(t.db, { fornecedorId: f.id, acondicionamento: "unitizado" }, "portaria", "2026-10-05T16:00:00-03:00");
    expect(r).toMatchObject({ agendado: false, proxima: { data: "2026-10-06", horario: "08:00" } });
    expect(t.db.select().from(schema.naoRecebimento).all()[0]).toMatchObject({ motivo: "sem_agendamento_sem_vaga", agendamentoId: null });
  });
});

describe("PDF (DANFE)", () => {
  const pdf = Buffer.from("%PDF-1.4\nfake");
  const chave = "35260999999999000191550010000091001000091007";
  it("recusa chave inválida e arquivo que não é PDF", () => {
    expect(() => nfDoPdf("a.pdf", pdf, { chaveAcesso: "123" })).toThrow(/44 dígitos/);
    expect(() => nfDoPdf("a.pdf", Buffer.from("x"), { chaveAcesso: chave })).toThrow(/não é um PDF/);
  });
  it("agenda com PDF, forma manual, e o download devolve os mesmos bytes", () => {
    const { f } = base("2026-10-05T07:00:00-03:00");
    const agora = "2026-10-05T07:00:00-03:00";
    const c = criarCompra(t.db, { fornecedorId: f.id, criadaPor: "c" }, agora);
    agendarPorToken(t.db, { token: c.token, arquivos: [{ nome: "d.pdf", conteudo: pdf, acondicionamento: "paletizado", manual: { chaveAcesso: chave, pesoLiquidoKg: "1000,5" } }], data: "2026-10-06", horario: "08:00", autor: "f" }, agora);
    expect(t.db.select().from(schema.notaFiscal).all()[0]).toMatchObject({ formaEntrada: "manual", pesoLiquidoKg: "1000.5" });
    const d = lerArquivoParaDownload(t.db, t.db.select().from(schema.notaFiscalArquivo).all()[0].id)!;
    expect(d.tipoMime).toBe("application/pdf");
    expect(d.conteudo.equals(pdf)).toBe(true);
  });
});

describe("atraso avisado (manual)", () => {
  it("grava evento com origem, não muda estado nem horário, e aparece na leitura", () => {
    const { ag } = base("2026-10-05T07:00:00-03:00");
    const id = ag("nfe-palete-com-placa.xml", "2026-10-05", "08:00");
    registrarAtrasoManual(t.db, id, { previsao: "09:30", motivo: "Trânsito", por: "fornecedor" }, "fornecedor", "2026-10-05T07:50:00-03:00");
    const a = t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;
    expect(a).toMatchObject({ status: "agendado", horario: "08:00", remarcacoes: 0 });
    const av = atrasosAvisados(t.db).get(id)!;
    expect(av).toMatchObject({ previsao: "09:30", motivo: "Trânsito", por: "fornecedor" });
    const ev = t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, id)).all().find((e) => e.tipo === "atraso")!;
    expect(JSON.parse(ev.detalhe!).origem).toBeTruthy();
  });
  it("remarcar depois do aviso torna o aviso obsoleto", () => {
    const { ag } = base("2026-10-05T07:00:00-03:00");
    const id = ag("nfe-palete-com-placa.xml", "2026-10-05", "08:00");
    registrarAtrasoManual(t.db, id, { previsao: "09:30", motivo: "x", por: "fornecedor" }, "f", "2026-10-05T08:05:00-03:00");
    remarcarPorAtraso(t.db, id, "responsavel", "2026-10-05T08:40:00-03:00");
    expect(atrasosAvisados(t.db).get(id)).toBeUndefined();
  });
  it("recusa previsão inválida, motivo vazio e caminhão que já chegou", () => {
    const { ag } = base("2026-10-05T07:00:00-03:00");
    const id = ag("nfe-palete-com-placa.xml", "2026-10-05", "08:00");
    expect(() => registrarAtrasoManual(t.db, id, { previsao: "25:00", motivo: "x", por: "portaria" }, "p", "2026-10-05T07:50:00-03:00")).toThrow(/HH:MM/);
    expect(() => registrarAtrasoManual(t.db, id, { previsao: "09:00", motivo: " ", por: "portaria" }, "p", "2026-10-05T07:50:00-03:00")).toThrow(/motivo/);
    t.db.update(schema.agendamento).set({ status: "chegou", chegadaEm: "2026-10-05T08:00:00-03:00" }).where(eq(schema.agendamento.id, id)).run();
    expect(() => registrarAtrasoManual(t.db, id, { previsao: "09:00", motivo: "x", por: "portaria" }, "p", "2026-10-05T08:10:00-03:00")).toThrow(/ainda não chegou/);
  });
});
