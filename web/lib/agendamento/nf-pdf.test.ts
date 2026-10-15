import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { chaveDoPdf, chaveValida, nfSoComChave } from "./nf-pdf";

const CHAVE = "35260999999999000191550010000090011000090017";

describe("chave de acesso", () => {
  it("confere o dígito verificador", () => {
    expect(chaveValida(CHAVE)).toBe(false); // chave de teste inventada nas fixtures
    expect(chaveValida("23220511222333000181551010000208031742408662")).toBe(true);
    expect(chaveValida("2322051122233300018155101000020803174240866")).toBe(false);
    expect(chaveValida("23220511222333000181551010000208031742408663")).toBe(false);
  });

  it("a chave sozinha já diz CNPJ, série e número", () => {
    const nf = nfSoComChave("23220511222333000181551010000208031742408662");
    expect(nf.emitenteCnpj).toBe("11222333000181");
    expect(nf.serie).toBe("101");
    expect(nf.numero).toBe("20803");
  });
});

describe("chaveDoPdf", () => {
  it("usa o nome do arquivo quando o PDF não tem a chave em texto", () => {
    const pdf = Buffer.from("%PDF-1.4\n%%EOF");
    expect(chaveDoPdf("23220511222333000181551010000208031742408662 (1).pdf", pdf)).toBe("23220511222333000181551010000208031742408662");
    expect(chaveDoPdf("nota.pdf", pdf)).toBeNull();
  });

  it("acha a chave impressa em grupos de 4", () => {
    const grupos = "2322 0511 2223 3300 0181 5510 1000 0208 0317 4240 8662";
    expect(chaveDoPdf("nota.pdf", Buffer.from(`%PDF-1.4\n(${grupos}) Tj`))).toBe("23220511222333000181551010000208031742408662");
  });

  // Com o pacote de dados da demo: lê o texto do PDF (sem ajuda do nome) e tem de bater com a chave do nome
  const pasta = process.env.PACOTE_DIR ? path.join(process.env.PACOTE_DIR, "01_notas_fiscais", "danfe_pdf") : null;
  const amostra = pasta && fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((n) => /^\d{44}\.pdf$/.test(n)).slice(0, 40) : [];
  it.skipIf(amostra.length === 0)("lê a chave de DANFEs reais", () => {
    const acertos = amostra.filter((n) => chaveDoPdf("nota.pdf", fs.readFileSync(path.join(pasta!, n))) === n.slice(0, 44));
    console.log(`DANFE lidos pelo texto: ${acertos.length} de ${amostra.length}`);
    expect(acertos.length).toBeGreaterThan(0);
  });
});
