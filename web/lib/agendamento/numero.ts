/**
 * Número do agendamento de descarga (D51): gerado pelo sistema, derivado do `id`, que nunca se repete.
 * Ex.: `AG-2026-000123`. O ano é o de criação. A Tela do Dia usa a mesma regra: `AG-<ano>-<id com 6 dígitos>`.
 */
export function numeroDoAgendamento(id: number, criadoEm: string): string {
  return `AG-${criadoEm.slice(0, 4)}-${String(id).padStart(6, "0")}`;
}
