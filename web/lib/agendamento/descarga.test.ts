import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";

import { agendarPorToken } from "./agendar";
import { criarCompra } from "./compra";
import {
  autorizarCarga,
  definirDestino,
  exigePesoBalanca,
  listarArmazensEEquipamentos,
  listarPendencias,
  obterDetalhe,
  registrarChegada,
  registrarEntrada,
  registrarSaida,
  registrarValidacao,
  resolverPendencia,
} from "./descarga";

const T0 = "2026-10-06T07:50:00-03:00";
const fixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome));

let t: TestDb;
afterEach(() => t?.apagar());

function agendado(xml = "nfe-palete-com-placa.xml") {
  t = createTestDb({ seed: true });
  const f = t.db.insert(schema.fornecedor).values({ codigo: "FT1", razaoSocial: "FORNECEDOR TESTE", cnpj: "99999999000191", origem: "teste" }).returning({ id: schema.fornecedor.id }).get();
  const c = criarCompra(t.db, { fornecedorId: f.id, itens: [{ descricao: "Adubo", quantidade: "400", pesoKg: "20000" }], criadaPor: "compras" }, T0);
  const { agendamentoId } = agendarPorToken(
    t.db,
    { token: c.token, arquivos: [{ nome: "a.xml", conteudo: fixture(xml), acondicionamento: "paletizado" }], data: "2026-10-06", horario: "10:00", autor: "fornecedor" },
    T0,
  );
  const armazens = t.db.select().from(schema.armazem).all();
  return { id: agendamentoId, armazens };
}

describe("dia da descarga", () => {
  it("E3 um caminhão, 2 armazéns, entrada e saída em cada, funcionários e equipamento", () => {
    const { id, armazens } = agendado();
    const [a, b] = armazens;
    registrarChegada(t.db, id, { pesoBalancaKg: "20500,5" }, "portaria", "2026-10-06T10:00:00-03:00");
    autorizarCarga(t.db, id, "responsavel", "2026-10-06T10:05:00-03:00");
    definirDestino(t.db, id, [a.id, b.id], "responsavel", "2026-10-06T10:06:00-03:00");
    registrarEntrada(t.db, id, a.id, "responsavel", "2026-10-06T10:10:00-03:00");
    expect(obterDetalhe(t.db, id).agendamento.status).toBe("em_descarga");

    const equipA = t.db.select().from(schema.equipamento).where(eq(schema.equipamento.armazemId, a.id)).all()[0];
    const r1 = registrarSaida(t.db, id, a.id, { chapasQtd: 3, equipamentoIds: [equipA.id] }, "responsavel", "2026-10-06T10:40:00-03:00");
    expect(r1.concluido).toBe(false);
    registrarEntrada(t.db, id, b.id, "responsavel", "2026-10-06T10:45:00-03:00");
    const r2 = registrarSaida(t.db, id, b.id, { chapasQtd: 2, equipamentoIds: [] }, "responsavel", "2026-10-06T11:20:00-03:00");
    expect(r2.concluido).toBe(true);

    const db = t.reabrir();
    const d = obterDetalhe(db, id);
    expect(d.agendamento).toMatchObject({ status: "concluido", liberacaoEm: "2026-10-06T11:20:00-03:00", chegadaEm: "2026-10-06T10:00:00-03:00" });
    expect(d.agendamento.pesoBalancaKg).toBe("20500.5");
    expect(d.armazens).toHaveLength(2);
    expect(d.armazens[0]).toMatchObject({ chapasQtd: 3, equipamentoIds: [equipA.id] });
    expect(d.eventos.map((e) => e.tipo)).toEqual(["agendado", "chegou", "autorizado", "destino_definido", "entrada", "saida", "entrada", "saida", "concluido"]);
  });

  it("destino recusa armazém inativo ou que não recebe descarga, com a causa", () => {
    const { id, armazens } = agendado();
    const [a, b, c] = armazens;
    t.db.update(schema.armazem).set({ recebeDescarga: false }).where(eq(schema.armazem.id, b.id)).run();
    t.db.update(schema.armazem).set({ ativo: false }).where(eq(schema.armazem.id, c.id)).run();
    expect(() => definirDestino(t.db, id, [a.id, b.id], "r", T0)).toThrow(new RegExp(`${b.nome}.*não recebe descarga`));
    expect(() => definirDestino(t.db, id, [c.id], "r", T0)).toThrow(new RegExp(`${c.nome}.*inativo`));
    expect(obterDetalhe(t.db, id).armazens).toHaveLength(0);
    definirDestino(t.db, id, [a.id], "r", T0);
    expect(obterDetalhe(t.db, id).armazens).toHaveLength(1);
  });

  it("entrada exige chegada e autorização", () => {
    const { id, armazens } = agendado();
    definirDestino(t.db, id, [armazens[0].id], "responsavel", T0);
    expect(() => registrarEntrada(t.db, id, armazens[0].id, "r", T0)).toThrow(/ainda não chegou/);
    registrarChegada(t.db, id, { pesoBalancaKg: "1" }, "portaria", T0);
    expect(() => registrarEntrada(t.db, id, armazens[0].id, "r", T0)).toThrow(/não foi autorizada/);
  });

  it("peso da balança: obrigatório só acima de 500 kg (estritamente maior)", () => {
    expect(exigePesoBalanca("500", "500")).toBe(false);
    expect(exigePesoBalanca("500.001", "500")).toBe(true);
    expect(exigePesoBalanca(null, "500")).toBe(false);
    const { id } = agendado();
    expect(() => registrarChegada(t.db, id, {}, "portaria", T0)).toThrow(/peso da balança/);
    expect(obterDetalhe(t.db, id).agendamento.status).toBe("agendado");
  });

  it("saída com equipamento de outro armazém é recusada e nada é gravado", () => {
    const { id, armazens } = agendado();
    const [a, b] = armazens;
    registrarChegada(t.db, id, { pesoBalancaKg: "20000" }, "portaria", T0);
    autorizarCarga(t.db, id, "responsavel", T0);
    definirDestino(t.db, id, [a.id], "responsavel", T0);
    registrarEntrada(t.db, id, a.id, "responsavel", T0);
    const equipB = t.db.select().from(schema.equipamento).where(eq(schema.equipamento.armazemId, b.id)).all()[0];
    expect(() => registrarSaida(t.db, id, a.id, { chapasQtd: 1, equipamentoIds: [equipB.id] }, "r", T0)).toThrow(/não pertence/);
    expect(obterDetalhe(t.db, id).armazens[0].saidaEm).toBeNull();
  });

  it("E4 divergência autorizada abre pendência aberta, listada, e pode ser resolvida", () => {
    const { id } = agendado("nfe-dois-itens.xml");
    const d0 = obterDetalhe(t.db, id);
    expect(d0.validacao.sugestao).toBe("divergente");
    registrarValidacao(t.db, id, { status: "divergente", obs: "Quantidade diferente do pedido" }, "compras", T0);
    const r = autorizarCarga(t.db, id, "responsavel", T0);
    expect(r.pendenciaId).not.toBeNull();
    const lista = listarPendencias(t.reabrir());
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ status: "aberta", tipo: "divergencia_nf_pedido", descricao: "Quantidade diferente do pedido" });

    expect(() => resolverPendencia(t.db, lista[0].id, " ", "responsavel", T0)).toThrow(/resolvida/);
    resolverPendencia(t.db, lista[0].id, "Fornecedor emitiu nota complementar", "responsavel", T0);
    expect(listarPendencias(t.db)[0]).toMatchObject({ status: "resolvida", resolvidaPor: "responsavel" });
    expect(() => resolverPendencia(t.db, lista[0].id, "x", "responsavel", T0)).toThrow(/já está resolvida/);
  });
});

describe("alertas sem previsão gravada", () => {
  it("calcula pelas NF na leitura, sem gravar", async () => {
    const { alertasDaData } = await import("./dimensionar");
    const { id } = agendado();
    t.db.update(schema.agendamento).set({ chapasPrevistas: null, empilhadeiraPrevista: null, duracaoPrevistaMin: null }).where(eq(schema.agendamento.id, id)).run();
    t.db.update(schema.equipamento).set({ disponivel: 0 }).run();
    const r = alertasDaData(t.db, "2026-10-06");
    expect(r.map((a) => a.tipo)).toContain("equipamento");
    expect(t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()?.chapasPrevistas).toBeNull();
  });
});

describe("equipamento em manutenção", () => {
  it("conta como 0 disponível na lista, na saída e no alerta de equipamento", async () => {
    const { alertasDaData } = await import("./dimensionar");
    const { id, armazens } = agendado();
    t.db.update(schema.agendamento).set({ chapasPrevistas: null, empilhadeiraPrevista: null, duracaoPrevistaMin: null }).where(eq(schema.agendamento.id, id)).run();
    t.db.update(schema.equipamento).set({ disponivel: 1, status: "manutencao" }).run();
    expect(listarArmazensEEquipamentos(t.db).equipamentos.every((e) => e.disponivel === 0)).toBe(true);
    expect(alertasDaData(t.db, "2026-10-06").map((a) => a.tipo)).toContain("equipamento");
    const a = armazens[0];
    registrarChegada(t.db, id, { pesoBalancaKg: "20500" }, "portaria", "2026-10-06T10:00:00-03:00");
    autorizarCarga(t.db, id, "r", "2026-10-06T10:01:00-03:00");
    definirDestino(t.db, id, [a.id], "r", "2026-10-06T10:02:00-03:00");
    registrarEntrada(t.db, id, a.id, "r", "2026-10-06T10:03:00-03:00");
    const eq1 = t.db.select().from(schema.equipamento).where(eq(schema.equipamento.armazemId, a.id)).all()[0];
    if (eq1) expect(() => registrarSaida(t.db, id, a.id, { chapasQtd: 1, equipamentoIds: [eq1.id] }, "r", "2026-10-06T10:30:00-03:00")).toThrow(/indisponível/);
  });
});
