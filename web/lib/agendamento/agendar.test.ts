import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { ErroDeRegra } from "@/lib/http";
import { igual } from "@/lib/money";

import { agendarPorToken, conferirLinkAtivo, conferirTamanhoDoCorpo, lerArquivoParaDownload, lerNfs, obterVisaoDoLink } from "./agendar";
import { criarCompra } from "./compra";

const AGORA = "2026-10-05T07:00:00-03:00";
const fixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome));

let t: TestDb;
afterEach(() => t?.apagar());

function preparar() {
  t = createTestDb({ seed: true });
  const fornecedor = t.db
    .insert(schema.fornecedor)
    .values({ codigo: "FT0001", razaoSocial: "FORNECEDOR DE TESTE LTDA", cnpj: "99999999000191", origem: "teste" })
    .returning({ id: schema.fornecedor.id })
    .get();
  const novaCompra = () => criarCompra(t.db, { fornecedorId: fornecedor.id, criadaPor: "compras" }, AGORA);
  return { fornecedorId: fornecedor.id, novaCompra };
}

const palete = () => ({ nome: "palete.xml", conteudo: fixture("nfe-palete-com-placa.xml"), acondicionamento: "paletizado" as const });
const bigBag = () => ({ nome: "bigbag.xml", conteudo: fixture("nfe-big-bag-sem-placa.xml"), acondicionamento: "big_bag" as const });
const batida = (f: () => { nome: string; conteudo: Buffer }) => ({ ...f(), acondicionamento: "batido" as const });

describe("agendar pelo link", () => {
  it("E1 compra, token, 2 NF (batida + paletizada) e persistência no arquivo", () => {
    const { novaCompra } = preparar();
    const compra = novaCompra();
    const r = agendarPorToken(
      t.db,
      { token: compra.token, arquivos: [batida(bigBag), palete()], data: "2026-10-06", horario: "08:00", autor: "fornecedor" },
      AGORA,
    );

    const db = t.reabrir();
    const ag = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, r.agendamentoId)).get()!;
    expect(ag).toMatchObject({ data: "2026-10-06", horario: "08:00", acondicionamentoOcupacao: "batido", status: "agendado", placa: "ABC1D23" });
    expect(igual(ag.pesoDeclaradoKg!, "30000.5")).toBe(true);
    // norma: NF batida de 10 t pede 5 chapas; a paletizada pede empilhadeira; duração somada (45 + 15 min)
    expect(ag).toMatchObject({ chapasPrevistas: 5, empilhadeiraPrevista: true, duracaoPrevistaMin: 60 });
    expect(db.select().from(schema.agendamentoNf).where(eq(schema.agendamentoNf.agendamentoId, ag.id)).all()).toHaveLength(2);
    expect(db.select().from(schema.compra).where(eq(schema.compra.id, compra.id)).get()?.status).toBe("confirmada");
    expect(db.select().from(schema.evento).where(eq(schema.evento.agendamentoId, ag.id)).all().map((e) => e.tipo)).toEqual(["agendado"]);

    const visao = obterVisaoDoLink(db, compra.token)!;
    expect(visao.agendamento?.nfs).toHaveLength(2);
    expect(visao.agendamento?.arquivos).toHaveLength(2);
    expect(Object.keys(visao.agendamento!.arquivos[0])).not.toContain("conteudo");
    const baixado = lerArquivoParaDownload(db, visao.agendamento!.arquivos[0].id)!;
    expect(baixado.conteudo.equals(fixture("nfe-big-bag-sem-placa.xml"))).toBe(true);
    expect(baixado.tipoMime).toBe("application/xml");
  });

  it("E2 horário cheio: o segundo pedido é recusado, nada é gravado e devolve a próxima data", () => {
    const { novaCompra } = preparar();
    const um = novaCompra();
    agendarPorToken(t.db, { token: um.token, arquivos: [batida(palete)], data: "2026-10-06", horario: "10:00", autor: "fornecedor" }, AGORA);

    const dois = novaCompra();
    let erro: unknown;
    try {
      agendarPorToken(t.db, { token: dois.token, arquivos: [{ ...palete(), nome: "x.xml", conteudo: fixture("nfe-dois-itens.xml") }], data: "2026-10-06", horario: "10:00", autor: "fornecedor" }, AGORA);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroDeRegra);
    expect((erro as ErroDeRegra).detalhe).toMatchObject({ motivo: "reservado_batido", proxima: { data: "2026-10-06", horario: "13:00" } });
    expect(t.db.select().from(schema.agendamento).all()).toHaveLength(1);
    expect(t.db.select().from(schema.notaFiscal).all()).toHaveLength(1);
    expect(t.db.select().from(schema.compra).where(eq(schema.compra.id, dois.id)).get()?.status).toBe("criada");
  });

  it("E6 token usado duas vezes e NF duplicada são recusados", () => {
    const { novaCompra } = preparar();
    const um = novaCompra();
    const entrada = { token: um.token, arquivos: [palete()], data: "2026-10-06", horario: "08:00", autor: "fornecedor" };
    agendarPorToken(t.db, entrada, AGORA);
    expect(() => agendarPorToken(t.db, { ...entrada, horario: "13:00" }, AGORA)).toThrow(/já foi usado/);

    const dois = novaCompra();
    expect(() => agendarPorToken(t.db, { ...entrada, token: dois.token, horario: "13:00" }, AGORA)).toThrow(/já está no agendamento/);
    expect(t.db.select().from(schema.agendamento).all()).toHaveLength(1);
    expect(() => agendarPorToken(t.db, { ...entrada, token: "inexistente" }, AGORA)).toThrow(/Link inválido/);
  });

  it("a mesma chave repetida no envio é recusada", () => {
    const { novaCompra } = preparar();
    const c = novaCompra();
    expect(() => lerNfs(t.db, [palete(), palete()])).toThrow(/mais de uma vez/);
    expect(() =>
      agendarPorToken(t.db, { token: c.token, arquivos: [palete(), palete()], data: "2026-10-06", horario: "08:00", autor: "fornecedor" }, AGORA),
    ).toThrow(/mais de uma vez/);
  });

  it("NF só em agendamento cancelado é reaproveitada", () => {
    const { novaCompra } = preparar();
    const um = novaCompra();
    const r1 = agendarPorToken(t.db, { token: um.token, arquivos: [palete()], data: "2026-10-06", horario: "08:00", autor: "fornecedor" }, AGORA);
    t.db.update(schema.agendamento).set({ status: "cancelado" }).where(eq(schema.agendamento.id, r1.agendamentoId)).run();
    const dois = novaCompra();
    const r2 = agendarPorToken(t.db, { token: dois.token, arquivos: [palete()], data: "2026-10-06", horario: "08:00", autor: "fornecedor" }, AGORA);
    expect(r2.agendamentoId).not.toBe(r1.agendamentoId);
    expect(t.db.select().from(schema.notaFiscal).all()).toHaveLength(1);
  });

  it("o link é conferido antes de ler os arquivos; limite do corpo recusa com 413", () => {
    const { novaCompra } = preparar();
    const lixo = { nome: "lixo.xml", conteudo: Buffer.from("isto nem é xml"), acondicionamento: "batido" as const };
    // token inexistente: a recusa é de link, não de leitura do arquivo
    expect(() => agendarPorToken(t.db, { token: "nao-existe", arquivos: [lixo], data: "2026-10-06", horario: "08:00", autor: "f" }, AGORA)).toThrow(/Link inválido/);
    const c = novaCompra();
    expect(() => conferirLinkAtivo(t.db, c.token)).not.toThrow();
    agendarPorToken(t.db, { token: c.token, arquivos: [palete()], data: "2026-10-06", horario: "08:00", autor: "f" }, AGORA);
    expect(() => conferirLinkAtivo(t.db, c.token)).toThrow(/já foi usado/);
    expect(() => conferirTamanhoDoCorpo(String(26 * 1024 * 1024))).toThrow(/25 MB/);
    expect(() => conferirTamanhoDoCorpo(String(1024))).not.toThrow();
    expect(() => conferirTamanhoDoCorpo(null)).not.toThrow();
  });

  it("XML inválido e data passada não gravam nada", () => {
    const { novaCompra } = preparar();
    const c = novaCompra();
    const ruim = { nome: "ruim.xml", conteudo: Buffer.from("<x/>"), acondicionamento: "batido" as const };
    expect(() => agendarPorToken(t.db, { token: c.token, arquivos: [ruim], data: "2026-10-06", horario: "08:00", autor: "f" }, AGORA)).toThrow(/ruim\.xml/);
    expect(() => agendarPorToken(t.db, { token: c.token, arquivos: [palete()], data: "2026-10-02", horario: "08:00", autor: "f" }, AGORA)).toThrow(/já passou/);
    expect(t.db.select().from(schema.agendamento).all()).toHaveLength(0);
  });
});

describe("criar compra", () => {
  it("fornecedor novo entra sem código e com origem", () => {
    t = createTestDb({ seed: true });
    const c = criarCompra(t.db, { fornecedorNovo: { razaoSocial: "NOVO LTDA", cnpj: "12.345.678/0001-90" }, itens: [{ descricao: "Adubo", quantidade: "10,5" }], criadaPor: "compras" }, AGORA);
    const f = t.db.select().from(schema.fornecedor).where(eq(schema.fornecedor.razaoSocial, "NOVO LTDA")).get()!;
    expect(f.codigo).toBeNull();
    expect(f.cnpj).toBe("12345678000190");
    expect(c.token.length).toBeGreaterThan(16);
    expect(t.db.select().from(schema.compraItem).all()[0].quantidade).toBe("10.5");
  });
});
