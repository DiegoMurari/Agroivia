import { describe, expect, it } from "vitest";

import { validarNfPedido, type CompraParaValidar, type NfParaValidar } from "./validacao";

const nf = (extra: Partial<NfParaValidar> = {}): NfParaValidar => ({
  emitenteCnpj: "99999999000191",
  pesoLiquidoKg: "20000",
  pesoBrutoKg: null,
  itens: [{ quantidade: "400" }],
  ...extra,
});
const compra = (extra: Partial<CompraParaValidar> = {}): CompraParaValidar => ({
  fornecedorCnpj: "99.999.999/0001-91",
  itens: [{ quantidade: "400", pesoKg: "20000" }],
  ...extra,
});

describe("validação NF x pedido", () => {
  it("tudo igual: conforme, sem alertas (valor igual, não texto igual)", () => {
    const r = validarNfPedido([nf({ pesoLiquidoKg: "20000.000" })], compra());
    expect(r).toEqual({ alertas: [], sugestao: "conforme" });
  });

  it("CNPJ diferente alerta", () => {
    const r = validarNfPedido([nf({ emitenteCnpj: "11111111000111" })], compra());
    expect(r.alertas.map((a) => a.tipo)).toEqual(["cnpj"]);
    expect(r.sugestao).toBe("divergente");
  });

  it("quantidade e peso diferentes alertam", () => {
    const r = validarNfPedido([nf({ itens: [{ quantidade: "380" }], pesoLiquidoKg: "19000" })], compra());
    expect(r.alertas.map((a) => a.tipo)).toEqual(["quantidade", "peso"]);
  });

  it("soma as NF do agendamento", () => {
    const r = validarNfPedido([nf({ itens: [{ quantidade: "200" }], pesoLiquidoKg: "10000" }), nf({ itens: [{ quantidade: "200" }], pesoLiquidoKg: "10000" })], compra());
    expect(r.sugestao).toBe("conforme");
  });

  it("sem itens na compra a validação é manual", () => {
    expect(validarNfPedido([nf()], compra({ itens: [] })).sugestao).toBe("aguardando");
  });

  it("sem CNPJ no cadastro não alerta", () => {
    expect(validarNfPedido([nf()], compra({ fornecedorCnpj: null })).alertas).toEqual([]);
  });
});
