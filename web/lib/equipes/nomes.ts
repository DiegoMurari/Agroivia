/** Funções puras de nome de chapa (sem banco), usadas também na tela. */

/** Chave de comparação: sem acento, sem maiúscula, espaços em um só. */
export function chaveDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Texto como o gestor escreveu, sem espaço sobrando e com cada palavra iniciada em maiúscula. */
export function nomeLimpo(nome: string): string {
  return nome
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)(\p{L})/gu, (_, e: string, l: string) => e + l.toLocaleUpperCase("pt-BR"));
}
