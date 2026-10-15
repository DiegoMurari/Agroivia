import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";

import { agendarPorToken } from "./agendar";
import { criarCompra } from "./compra";
import { obterDetalhe, registrarChegada } from "./descarga";
import { encerrarDescarga, iniciarDescarga } from "./rapidas";

const T0 = "2026-10-06T07:50:00-03:00";
const fixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome));

let t: TestDb;
afterEach(() => t?.apagar());

function chegado(validacao?: "divergente") {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ codigo: "FT1", razaoSocial: "FORNECEDOR TESTE", cnpj: "99999999000191", origem: "teste" }).returning({ id: schema.fornecedor.id }).get();
  const c = criarCompra(t.db, { fornecedorId: f.id, itens: [{ descricao: "Adubo", quantidade: "400", pesoKg: "20000" }], criadaPor: "compras" }, T0);
  const { agendamentoId: id } = agendarPorToken(
    t.db,
    { token: c.token, arquivos: [{ nome: "a.xml", conteudo: fixture("nfe-palete-com-placa.xml"), acondicionamento: "paletizado" }], data: "2026-10-06", horario: "10:00", autor: "fornecedor" },
    T0,
  );
  if (validacao) t.db.update(schema.agendamento).set({ validacaoStatus: validacao, validacaoObs: "peso" }).where(eq(schema.agendamento.id, id)).run();
  t.db.update(schema.agendamento).set({ chapasPrevistas: 4, duracaoPrevistaMin: 90 }).where(eq(schema.agendamento.id, id)).run();
  registrarChegada(t.db, id, { pesoBalancaKg: "20500" }, "portaria", "2026-10-06T10:00:00-03:00");
  const galpao = t.db.select().from(schema.armazem).all().find((a) => a.ativo && a.recebeDescarga)!;
  return { id, galpao };
}
const ag = (id: number) => t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;

describe("ações rápidas da descarga (D51)", () => {
  it("iniciar autoriza, define o galpão e registra a entrada; devolve início e previsão de término", () => {
    const { id, galpao } = chegado();
    const r = iniciarDescarga(t.db, id, { armazemId: galpao.id }, "responsavel", "2026-10-06T10:10:00-03:00");
    expect(r).toEqual({ inicioEm: "2026-10-06T10:10:00-03:00", previsaoTerminoEm: "2026-10-06T11:40:00-03:00", duracaoPrevistaMin: 90 });
    expect(ag(id)).toMatchObject({ status: "em_descarga", autorizadoPor: "responsavel" });
    const d = obterDetalhe(t.db, id);
    expect(d.armazens[0]).toMatchObject({ armazemId: galpao.id, entradaEm: "2026-10-06T10:10:00-03:00" });
    const eventos = t.db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, id)).all();
    expect(eventos.some((e) => e.tipo === "autorizado")).toBe(true);
    expect(eventos.some((e) => e.tipo === "entrada" && e.detalhe?.includes("origem"))).toBe(true);
  });

  it("iniciar com validação divergente abre pendência", () => {
    const { id, galpao } = chegado("divergente");
    iniciarDescarga(t.db, id, { armazemId: galpao.id }, "responsavel", "2026-10-06T10:10:00-03:00");
    expect(t.db.select().from(schema.pendencia).where(eq(schema.pendencia.agendamentoId, id)).all()).toHaveLength(1);
  });

  it("iniciar sem galpão e sem destino, antes da chegada ou duas vezes: erro com causa e nada gravado", () => {
    const { id, galpao } = chegado();
    expect(() => iniciarDescarga(t.db, id, {}, "r", "2026-10-06T10:10:00-03:00")).toThrow(/Informe o galpão/);
    expect(ag(id)).toMatchObject({ status: "chegou", autorizadoEm: null });
    iniciarDescarga(t.db, id, { armazemId: galpao.id }, "r", "2026-10-06T10:10:00-03:00");
    expect(() => iniciarDescarga(t.db, id, { armazemId: galpao.id }, "r", "2026-10-06T10:11:00-03:00")).toThrow(/já começou/);
  });

  it("iniciar antes da chegada é recusado", () => {
    t = createTestDb({ seed: true });
    expect(() => iniciarDescarga(t.db, 99999, { armazemId: 1 }, "r", T0)).toThrow(/não encontrado/);
  });

  it("encerrar sem chapasQtd usa a previsão, conclui, grava a liberação e recusa a segunda vez", () => {
    const { id, galpao } = chegado();
    iniciarDescarga(t.db, id, { armazemId: galpao.id }, "r", "2026-10-06T10:10:00-03:00");
    const r = encerrarDescarga(t.db, id, {}, "r", "2026-10-06T11:25:00-03:00");
    expect(r).toEqual({ fimEm: "2026-10-06T11:25:00-03:00", duracaoMin: 75 });
    expect(ag(id)).toMatchObject({ status: "concluido", liberacaoEm: "2026-10-06T11:25:00-03:00" });
    expect(obterDetalhe(t.db, id).armazens[0].chapasQtd).toBe(4);
    expect(() => encerrarDescarga(t.db, id, {}, "r", "2026-10-06T11:30:00-03:00")).toThrow(/já foi encerrada/);
  });

  it("encerrar com chapasQtd informado e fora do limite", () => {
    const { id, galpao } = chegado();
    iniciarDescarga(t.db, id, { armazemId: galpao.id }, "r", "2026-10-06T10:10:00-03:00");
    expect(() => encerrarDescarga(t.db, id, { chapasQtd: 30 }, "r", "2026-10-06T11:00:00-03:00")).toThrow(/0 a 20/);
    encerrarDescarga(t.db, id, { chapasQtd: 2 }, "r", "2026-10-06T11:00:00-03:00");
    expect(obterDetalhe(t.db, id).armazens[0].chapasQtd).toBe(2);
  });

  it("encerrar antes de iniciar é recusado", () => {
    const { id } = chegado();
    expect(() => encerrarDescarga(t.db, id, {}, "r", "2026-10-06T11:00:00-03:00")).toThrow(/ainda não começou/);
  });

  it("encerrar com um segundo galpão que não teve entrada tira esse galpão do destino e conclui", () => {
    const { id, galpao } = chegado();
    const outro = t.db.select().from(schema.armazem).all().find((a) => a.ativo && a.recebeDescarga && a.id !== galpao.id)!;
    iniciarDescarga(t.db, id, { armazemId: galpao.id }, "r", "2026-10-06T10:10:00-03:00");
    t.db.insert(schema.agendamentoArmazem).values({ agendamentoId: id, armazemId: outro.id, ordem: 5 }).run();
    encerrarDescarga(t.db, id, {}, "r", "2026-10-06T11:00:00-03:00");
    expect(ag(id).status).toBe("concluido");
    expect(obterDetalhe(t.db, id).armazens).toHaveLength(1);
  });
});
