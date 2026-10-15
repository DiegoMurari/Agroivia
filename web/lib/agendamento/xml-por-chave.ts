import fs from "node:fs";
import path from "node:path";

/**
 * Busca o XML completo da NF-e pela chave de acesso (os 44 números do código de barras).
 * Na demonstração o "consultar a nota" lê a pasta de XMLs do pacote de dados (PACOTE_DIR). Em produção este é o ponto
 * de troca para a consulta à SEFAZ (distribuição de DF-e) ou ao ERP, sem mudar mais nada.
 * Devolve null quando a nota não está disponível: a portaria segue só com os dados que a chave carrega.
 */
export function xmlPorChave(chave: string): Buffer | null {
  const digitos = chave.replace(/\D/g, "");
  if (!/^\d{44}$/.test(digitos)) return null; // só números: nunca monta caminho com texto livre
  const pacote = process.env.PACOTE_DIR?.trim();
  if (!pacote) return null;
  const arquivo = path.join(pacote, "01_notas_fiscais", "xml", `${digitos}.xml`);
  try {
    return fs.readFileSync(arquivo);
  } catch {
    return null;
  }
}
