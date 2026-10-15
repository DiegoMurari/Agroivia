import fs from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/lib/db/testing";
import { ErroDeRegra } from "@/lib/http";

import { carregarContexto } from "./comum";
import { numeroDoAgendamento } from "./numero";
import { exigirPedidoAprovado, listarAgendamentos } from "./descarga";
import { verificarOcupacao } from "./ocupacao";
import {
  criarPedido,
  decidirPedido,
  editarPedido,
  estadoDoPedido,
  listarAprovacoes,
  listarNotificacoes,
  listarTiposMercadoria,
  listarPedidosDoFornecedor,
  marcarNotificacoesLidas,
  type DadosPedido,
} from "./pedido";

const AGORA = "2026-10-05T07:00:00-03:00";
const fixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome));

let t: TestDb;
afterEach(() => t?.apagar());

function preparar() {
  t = createTestDb({ seed: true });
  const forn = t.db.select().from(schema.usuario).where(eq(schema.usuario.email, "fornecedor@demo.com.br")).get()!;
  const compras = t.db.select().from(schema.usuario).where(eq(schema.usuario.email, "compras@agrovia.com.br")).get()!;
  return { forn: forn.id, compras: { id: compras.id, nome: "Compras" } };
}

const palete = (arq = "nfe-palete-com-placa.xml") => ({ nome: arq, conteudo: fixture(arq), acondicionamento: "paletizado" as const });
const batida = (arq = "nfe-big-bag-sem-placa.xml") => ({ nome: arq, conteudo: fixture(arq), acondicionamento: "batido" as const });
const dados = (extra: Partial<DadosPedido> = {}): DadosPedido => ({
  data: "2026-10-06",
  horario: "08:00",
  tipoMercadoria: "FER",
  arquivos: [palete()],
  enviar: true,
  ...extra,
});
const ag = (id: number) => t.db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;
const ocupa = (data: string, horario: string, acondicionamento: "batido" | "unitizado") =>
  verificarOcupacao(carregarContexto(t.db, AGORA), { data, horario, acondicionamento });

describe("pedido do fornecedor e aprovação (D49)", () => {
  it("enviar grava aguardando com o criador e ocupa a vaga; rascunho não ocupa", () => {
    const { forn } = preparar();
    const r = criarPedido(t.db, forn, dados(), AGORA);
    expect(ag(r.agendamentoId)).toMatchObject({ aprovacao: "aguardando", criadoPorUsuarioId: forn, compraId: null });
    expect(JSON.parse(ag(r.agendamentoId).extra!)).toMatchObject({ tipoMercadoria: "Fertilizantes", tipoValor: "FER" });
    expect(ocupa("2026-10-06", "08:00", "batido").aceita).toBe(false);

    const rasc = criarPedido(t.db, forn, dados({ data: "2026-10-07", arquivos: [palete("nfe-dois-itens.xml")], enviar: false }), AGORA);
    expect(ag(rasc.agendamentoId).aprovacao).toBe("rascunho");
    expect(ocupa("2026-10-07", "08:00", "batido").aceita).toBe(true);
  });

  it("todo pedido exige NF e tipo do cadastro; NF repetida e horário reservado são recusados sem gravar", () => {
    const { forn } = preparar();
    expect(() => criarPedido(t.db, forn, dados({ arquivos: [] }), AGORA)).toThrow(/nota fiscal/);
    expect(() => criarPedido(t.db, forn, dados({ tipoMercadoria: "XYZ" }), AGORA)).toThrow(/da lista/);
    criarPedido(t.db, forn, dados(), AGORA);
    expect(() => criarPedido(t.db, forn, dados({ horario: "10:00" }), AGORA)).toThrow(/já está no pedido/);
    // 08:00 de 06/10 já tem o paletizado: um batido ali é recusado
    expect(() => criarPedido(t.db, forn, dados({ arquivos: [batida("nfe-dois-itens.xml")] }), AGORA)).toThrow(ErroDeRegra);
    expect(t.db.select().from(schema.agendamento).where(eq(schema.agendamento.aprovacao, "aguardando")).all()).toHaveLength(1);
  });

  it("recusado libera a vaga e a NF; aguardando ocupa", () => {
    const { forn, compras } = preparar();
    const a = criarPedido(t.db, forn, dados({ arquivos: [batida()] }), AGORA).agendamentoId;
    expect(ocupa("2026-10-06", "08:00", "unitizado")).toMatchObject({ aceita: false, motivo: "reservado_batido" });
    decidirPedido(t.db, compras, { id: a, decisao: "recusado", comentario: "Peso errado" }, AGORA);
    expect(ocupa("2026-10-06", "08:00", "unitizado").aceita).toBe(true);
    expect(() => criarPedido(t.db, forn, dados({ horario: "10:00", arquivos: [batida()] }), AGORA)).not.toThrow();
  });

  it("recusar exige comentário; decidir grava log e notificação; decidir duas vezes é recusado; reenvio volta a aguardando", () => {
    const { forn, compras } = preparar();
    const a = criarPedido(t.db, forn, dados(), AGORA).agendamentoId;
    expect(() => decidirPedido(t.db, compras, { id: a, decisao: "recusado", comentario: "  " }, AGORA)).toThrow(/motivo/);
    expect(ag(a).aprovacao).toBe("aguardando");
    decidirPedido(t.db, compras, { id: a, decisao: "recusado", comentario: "Falta a NF certa" }, AGORA);
    expect(ag(a)).toMatchObject({ aprovacao: "recusado", recusaComentario: "Falta a NF certa", aprovacaoPor: compras.id });
    const log = t.db
      .select()
      .from(schema.logAprovacao)
      .where(and(eq(schema.logAprovacao.alvo, "pedido"), eq(schema.logAprovacao.alvoId, a)))
      .all();
    expect(log).toMatchObject([{ decisao: "recusado", comentario: "Falta a NF certa", usuarioId: compras.id }]);
    const notas = listarNotificacoes(t.db, forn);
    expect(notas[0]).toMatchObject({ tipo: "pedido_recusado", lida: false });
    expect(notas[0].mensagem).toContain("Falta a NF certa");
    expect(() => decidirPedido(t.db, compras, { id: a, decisao: "aprovado" }, AGORA)).toThrow(/não está aguardando/);

    editarPedido(t.db, forn, a, dados({ arquivos: [] }), AGORA);
    expect(ag(a)).toMatchObject({ aprovacao: "aguardando", recusaComentario: null });
    decidirPedido(t.db, compras, { id: a, decisao: "aprovado" }, AGORA);
    expect(ag(a).aprovacao).toBe("aprovado");
    expect(listarNotificacoes(t.db, forn)[0].tipo).toBe("pedido_aprovado");
    marcarNotificacoesLidas(t.db, forn);
    expect(listarNotificacoes(t.db, forn).every((n) => n.lida)).toBe(true);
  });

  it("edição confere a ocupação de novo, é só do dono, e pedido aprovado não edita", () => {
    const { forn, compras } = preparar();
    const a = criarPedido(t.db, forn, dados(), AGORA).agendamentoId;
    const b = criarPedido(t.db, forn, dados({ horario: "10:00", arquivos: [batida()] }), AGORA).agendamentoId;
    expect(() => editarPedido(t.db, forn, a, dados({ horario: "10:00", arquivos: [] }), AGORA)).toThrow(ErroDeRegra);
    expect(ag(a).horario).toBe("08:00");
    editarPedido(t.db, forn, b, dados({ horario: "10:00", arquivos: [], observacao: "obs" }), AGORA);
    expect(ag(b).observacao).toBe("obs");
    expect(() => editarPedido(t.db, forn + 100, a, dados({ arquivos: [] }), AGORA)).toThrow();
    decidirPedido(t.db, compras, { id: a, decisao: "aprovado" }, AGORA);
    expect(() => editarPedido(t.db, forn, a, dados({ arquivos: [] }), AGORA)).toThrow(/já foi aprovado/);
  });

  it("as telas de Compras só tratam pedido aprovado", () => {
    const { forn, compras } = preparar();
    const a = criarPedido(t.db, forn, dados(), AGORA).agendamentoId;
    expect(listarAgendamentos(t.db, "2026-10-05").some((x) => x.id === a)).toBe(false);
    expect(() => exigirPedidoAprovado(t.db, a)).toThrow(/não foi aprovado/);
    decidirPedido(t.db, compras, { id: a, decisao: "aprovado" }, AGORA);
    expect(listarAgendamentos(t.db, "2026-10-05").some((x) => x.id === a)).toBe(true);
    expect(() => exigirPedidoAprovado(t.db, a)).not.toThrow();
  });

  it("número do agendamento: gerado, nunca repete, e o enviado no corpo é ignorado", () => {
    const { forn } = preparar();
    const a = criarPedido(t.db, forn, dados(), AGORA).agendamentoId;
    const b = criarPedido(t.db, forn, { ...dados({ data: "2026-10-07", arquivos: [palete("nfe-dois-itens.xml")] }), numeroPedido: "MEU-1" } as DadosPedido, AGORA).agendamentoId;
    const lista = listarPedidosDoFornecedor(t.db, forn);
    const numeros = lista.map((p) => p.numero);
    expect(new Set(numeros).size).toBe(2);
    expect(numeros).toContain(numeroDoAgendamento(a, "2026-10-05T07:00:00-03:00"));
    expect(numeroDoAgendamento(123, "2026-10-05T07:00:00-03:00")).toBe("AG-2026-000123");
    expect(JSON.stringify(ag(b))).not.toContain("MEU-1");
    expect(listarAprovacoes(t.db)[0].pedidos.every((p) => /^AG-2026-\d{6}$/.test(p.numero))).toBe(true);
  });

  it("tipo de mercadoria vem de todos os grupos e termina em Outros, que exige descrição", () => {
    const { forn } = preparar();
    const tipos = listarTiposMercadoria(t.db);
    expect(tipos.length).toBeGreaterThanOrEqual(9);
    expect(tipos.at(-1)).toEqual({ valor: "OUTROS", rotulo: "Outros" });
    expect(tipos.find((x) => x.valor === "PEC")?.rotulo).toBe("Peças");
    expect(() => criarPedido(t.db, forn, dados({ tipoMercadoria: "OUTROS" }), AGORA)).toThrow(/Descreva a mercadoria/);
    const id = criarPedido(t.db, forn, dados({ tipoMercadoria: "OUTROS", tipoOutros: "Embalagens" }), AGORA).agendamentoId;
    expect(JSON.parse(ag(id).extra!)).toMatchObject({ tipoMercadoria: "Outros: Embalagens", tipoValor: "OUTROS" });
  });

  it("lista do fornecedor com o estado em palavras e aprovações agrupadas por fornecedor", () => {
    const { forn } = preparar();
    criarPedido(t.db, forn, dados(), AGORA);
    criarPedido(t.db, forn, dados({ data: "2026-10-07", arquivos: [palete("nfe-dois-itens.xml")], enviar: false }), AGORA);
    const lista = listarPedidosDoFornecedor(t.db, forn);
    expect(lista.map((p) => p.estado)).toEqual(["Rascunho", "Aguardando aprovação"]);
    expect(lista[1]).toMatchObject({ emAberto: true, tipoMercadoria: "Fertilizantes" });
    const grupos = listarAprovacoes(t.db);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].pedidos).toHaveLength(1);
    expect(estadoDoPedido({ aprovacao: "aprovado", status: "concluido" })).toBe("Concluído");
    expect(estadoDoPedido({ aprovacao: "aprovado", status: "agendado" })).toBe("Aprovado");
  });
});
