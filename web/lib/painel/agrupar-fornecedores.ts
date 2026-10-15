/**
 * Junta fornecedores que são a mesma empresa escrita de jeitos diferentes ("S/A", "S.A" e "SA"; caixa e pontuação).
 * Só leitura sobre a lista já calculada; os pesos somam em decimal (lib/money).
 */
import { somar, type Valor } from "@/lib/money";

export function nomeNormalizado(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\bS\s*[/.]\s*A\b\.?/g, "SA")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function agruparFornecedores<T extends { nome: string; pesoKg: Valor }>(lista: T[]): T[] {
  const grupos = new Map<string, T>();
  for (const f of lista) {
    const chave = nomeNormalizado(f.nome);
    const atual = grupos.get(chave);
    grupos.set(chave, atual ? { ...atual, pesoKg: somar(atual.pesoKg, f.pesoKg) } : f);
  }
  return [...grupos.values()].sort((a, b) => b.pesoKg.comparedTo(a.pesoKg));
}
