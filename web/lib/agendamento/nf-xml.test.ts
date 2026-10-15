import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { igual } from "@/lib/money";

import { ErroNfe, lerNfeXml, sugerirAcondicionamento } from "./nf-xml";

const lerFixture = (nome: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", nome), "utf8");

describe("leitor de NF-e", () => {
  it("lê NF com PALETE e placa", () => {
    const nf = lerNfeXml(lerFixture("nfe-palete-com-placa.xml"));
    expect(nf.chaveAcesso).toBe("35260999999999000191550010000090011000090017");
    expect(nf.numero).toBe("9001");
    expect(nf.serie).toBe("1");
    expect(nf.emitenteCnpj).toBe("99999999000191");
    expect(nf.emitenteNome).toBe("FORNECEDOR DE TESTE LTDA");
    expect(nf.emitidaEm).toBe("2026-10-02T09:15:00-03:00");
    expect(igual(nf.valorTotal!, "48200")).toBe(true);
    expect(igual(nf.pesoLiquidoKg!, "20000")).toBe(true);
    expect(igual(nf.pesoBrutoKg!, "20400")).toBe(true);
    expect(nf.volumes).toBe("20");
    expect(nf.especie).toBe("PALETE");
    expect(nf.placa).toBe("ABC1D23");
    expect(nf.transportadora).toBe("TRANSPORTADORA TESTE");
    expect(nf.acondicionamentoSugerido).toBe("paletizado");
    expect(nf.pedidoFornecedor).toBe("PED-9001");
    expect(nf.itens).toHaveLength(1);
    expect(nf.itens[0]).toMatchObject({ codigo: "ADU-01", unidade: "SC", pedido: "PED-9001" });
    expect(igual(nf.itens[0].quantidade!, "400")).toBe(true);
    expect(igual(nf.itens[0].valorUnitario!, "120.5")).toBe(true);
  });

  it("BIG BAG sem placa", () => {
    const nf = lerNfeXml(lerFixture("nfe-big-bag-sem-placa.xml"));
    expect(nf.placa).toBeNull();
    expect(nf.acondicionamentoSugerido).toBe("big_bag");
    expect(igual(nf.pesoLiquidoKg!, "10000.5")).toBe(true);
  });

  it("espécie ausente não sugere acondicionamento", () => {
    const nf = lerNfeXml(lerFixture("nfe-sem-especie.xml"));
    expect(nf.especie).toBeNull();
    expect(nf.acondicionamentoSugerido).toBeNull();
    expect(nf.pesoBrutoKg).toBeNull();
  });

  it("2 itens e vários volumes: soma pesos e volumes", () => {
    const nf = lerNfeXml(lerFixture("nfe-dois-itens.xml"));
    expect(nf.itens).toHaveLength(2);
    expect(nf.itens[1].descricao).toBe("SEMENTE DE SOJA");
    expect(nf.volumes).toBe("15");
    expect(igual(nf.pesoLiquidoKg!, "8500.5")).toBe(true);
    expect(nf.acondicionamentoSugerido).toBe("paletizado");
  });

  it("aceita NFe na raiz, sem nfeProc", () => {
    const xml = lerFixture("nfe-sem-especie.xml").replace(/<\/?nfeProc[^>]*>/g, "");
    expect(lerNfeXml(xml).numero).toBe("9003");
  });

  it("sugestão pela espécie ignora maiúsculas, espaços e acentos", () => {
    expect(sugerirAcondicionamento("big bag")).toBe("big_bag");
    expect(sugerirAcondicionamento("BIG-BAG")).toBe("big_bag");
    expect(sugerirAcondicionamento(" Pallet ")).toBe("paletizado");
    expect(sugerirAcondicionamento("PALETÉ")).toBe("paletizado");
    expect(sugerirAcondicionamento("BIG-BAG 1000KG")).toBe("big_bag");
    expect(sugerirAcondicionamento("Pallet PBR")).toBe("paletizado");
    expect(sugerirAcondicionamento("SACARIA")).toBeNull();
    expect(sugerirAcondicionamento("VOLUMES")).toBeNull();
    expect(sugerirAcondicionamento(null)).toBeNull();
  });

  it("XML quebrado: erro em português com a correção", () => {
    expect(() => lerNfeXml("<nfeProc><NFe><infNFe")).toThrow(ErroNfe);
    expect(() => lerNfeXml("isto não é xml")).toThrow(/XML/);
  });

  it("XML que não é NF-e", () => {
    expect(() => lerNfeXml("<pedido><item>1</item></pedido>")).toThrow(/não é uma NF-e/);
  });

  it("chave sem 44 dígitos é recusada", () => {
    const xml = lerFixture("nfe-sem-especie.xml").replace(/Id="NFe\d+"/, 'Id="NFe123"');
    expect(() => lerNfeXml(xml)).toThrow(/44 dígitos/);
  });

  it.skipIf(!process.env.PACOTE_DIR)("lê os XML do pacote, se a pasta existir", () => {
    const pasta = path.join(process.env.PACOTE_DIR!, "xml");
    if (!fs.existsSync(pasta)) return;
    const arquivos = fs.readdirSync(pasta).filter((f) => f.toLowerCase().endsWith(".xml")).slice(0, 20);
    for (const arquivo of arquivos) {
      const nf = lerNfeXml(fs.readFileSync(path.join(pasta, arquivo), "utf8"));
      expect(nf.chaveAcesso).toMatch(/^\d{44}$/);
    }
  });

  it("recusa DTD e decodifica as entidades padrão", () => {
    const xml = lerFixture("nfe-palete-com-placa.xml");
    const comDtd = xml.replace(/<\?xml[^>]*\?>/, "").replace("<nfeProc", '<!DOCTYPE x [<!ENTITY e "EXPANDIDO">]><nfeProc');
    expect(() => lerNfeXml(comDtd)).toThrow(/DTD/);
    const nf = lerNfeXml(xml.replace(/<xNome>([^<]*)<\/xNome>/, "<xNome>A &amp; B &lt;LTDA&gt;</xNome>"));
    expect(nf.emitenteNome).toBe("A & B <LTDA>");
  });
});
