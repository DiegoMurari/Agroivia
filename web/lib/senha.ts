import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Senha e tokens, sem Next e sem banco: serve à aplicação, aos seeds e aos testes. */

export const SENHA_MINIMA = 8;

/** scrypt com sal aleatório: `sal:hash`, em hexadecimal. O `sal` fixo é só para o seed, que precisa ser determinístico. */
export function hashSenha(senha: string, sal: Buffer = randomBytes(16)): string {
  return `${sal.toString("hex")}:${scryptSync(senha, sal, 64).toString("hex")}`;
}

export function conferirSenha(senha: string, guardado: string | null | undefined): boolean {
  const [salHex, hashHex] = (guardado ?? "").split(":");
  if (!salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = scryptSync(senha, Buffer.from(salHex, "hex"), esperado.length || 64);
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

/** Token aleatório de uso único (convite, recuperação de senha, convite de fornecedor). */
export function novoToken(): string {
  return randomBytes(24).toString("base64url");
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
