/**
 * Alerta de equipamento indisponível na tela do dia (grupo 6). Só LEITURA.
 * Dois casos por armazém:
 *  - em_uso: descargas em andamento usam mais unidades de um equipamento do que `disponivel`;
 *  - sem_empilhadeira: há cargas de hoje ainda sem entrada que pedem empilhadeira
 *    (`agendamento.empilhadeira_prevista` ou a norma do acondicionamento) e nenhuma está disponível.
 */
import { eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

export interface AlertaEquipamento {
  tipo: "em_uso" | "sem_empilhadeira";
  armazem: string;
  equipamento: string | null;
  /** Em em_uso: unidades que faltam. */
  faltam: number;
  /** Em sem_empilhadeira: cargas pendentes que pedem empilhadeira. */
  cargas: number;
  mensagem: string;
}

const ATIVAS = ["agendado", "chegou", "em_descarga"] as const;
/** Em manutenção não está disponível, mesmo que `disponivel` ainda diga o contrário. */
const disponiveis = (e: { status: string; disponivel: number }) => (e.status === "manutencao" ? 0 : e.disponivel);
const ehEmpilhadeira = (nome: string | null) => (nome ?? "").toLowerCase().includes("empilhadeira");

export function alertasEquipamento(db: Db, hoje: string): AlertaEquipamento[] {
  const armazens = new Map(db.select().from(schema.armazem).all().map((a) => [a.id, a.nome]));
  const equipamentos = db.select().from(schema.equipamento).all();
  const perfilRow = db.select().from(schema.parametro).where(eq(schema.parametro.chave, "perfil_norma")).get();
  const norma = db.select().from(schema.normaChapas).where(eq(schema.normaChapas.perfil, perfilRow?.valor === "dossie" ? "dossie" : "agrovia")).all();

  const doDia = db.select().from(schema.agendamento).where(eq(schema.agendamento.data, hoje)).all().filter((a) => a.aprovacao === "aprovado" && (ATIVAS as readonly string[]).includes(a.status));
  const porId = new Map(doDia.map((a) => [a.id, a]));
  const destinos = doDia.length ? db.select().from(schema.agendamentoArmazem).where(inArray(schema.agendamentoArmazem.agendamentoId, doDia.map((a) => a.id))).all() : [];
  const nfs = doDia.length ? db.select().from(schema.agendamentoNf).where(inArray(schema.agendamentoNf.agendamentoId, doDia.map((a) => a.id))).all() : [];
  const pedeEmpilhadeira = (agendamentoId: number): boolean => {
    if (porId.get(agendamentoId)?.empilhadeiraPrevista) return true;
    return nfs.filter((n) => n.agendamentoId === agendamentoId).some((n) => norma.find((x) => x.acondicionamento === n.acondicionamento)?.empilhadeira);
  };

  const alertas: AlertaEquipamento[] = [];

  // Em uso agora acima do disponível.
  // Descarga que virou a noite também conta: não filtra pela data.
  const ativasIds = new Set(db.select().from(schema.agendamento).where(inArray(schema.agendamento.status, [...ATIVAS])).all().filter((a) => a.aprovacao === "aprovado").map((a) => a.id));
  const emAndamento = db.select().from(schema.agendamentoArmazem).all().filter((d) => d.entradaEm !== null && d.saidaEm === null && ativasIds.has(d.agendamentoId));
  const usos = emAndamento.length ? db.select().from(schema.descargaEquipamento).where(inArray(schema.descargaEquipamento.agendamentoArmazemId, emAndamento.map((d) => d.id))).all() : [];
  const emUso = new Map<number, number>();
  for (const u of usos) emUso.set(u.equipamentoId, (emUso.get(u.equipamentoId) ?? 0) + 1);
  for (const e of equipamentos) {
    const usando = emUso.get(e.id) ?? 0;
    if (usando > disponiveis(e)) {
      const faltam = usando - disponiveis(e);
      const arm = armazens.get(e.armazemId) ?? "";
      const motivo = e.status === "manutencao" ? " Equipamento em manutenção." : e.indisponivelMotivo ? ` Motivo: ${e.indisponivelMotivo}.` : "";
      alertas.push({
        tipo: "em_uso", armazem: arm, equipamento: e.nome, faltam, cargas: 0,
        mensagem: `${arm}: ${e.nome} em uso em ${usando} descarga${usando > 1 ? "s" : ""}, mas só ${disponiveis(e)} disponível. Faltam ${faltam}.${motivo} Reorganize as descargas ou libere o equipamento.`,
      });
    }
  }

  // Cargas pendentes que pedem empilhadeira sem nenhuma disponível.
  const pendentes = new Map<number, Set<number>>();
  for (const d of destinos) {
    if (d.entradaEm !== null) continue;
    if (!pedeEmpilhadeira(d.agendamentoId)) continue;
    const s = pendentes.get(d.armazemId) ?? new Set<number>();
    s.add(d.agendamentoId);
    pendentes.set(d.armazemId, s);
  }
  for (const [armazemId, cargasSet] of pendentes) {
    const empilhadeiras = equipamentos.filter((e) => e.armazemId === armazemId && ehEmpilhadeira(e.nome));
    // Armazém sem empilhadeira cadastrada: não dá para afirmar falta (pode usar a de outro), não alerta.
    if (empilhadeiras.length === 0 || empilhadeiras.some((e) => disponiveis(e) > 0)) continue;
    const arm = armazens.get(armazemId) ?? "";
    const n = cargasSet.size;
    const motivos = empilhadeiras.map((e) => (e.status === "manutencao" ? "em manutenção" : e.indisponivelMotivo)).filter(Boolean).join("; ");
    alertas.push({
      tipo: "sem_empilhadeira", armazem: arm, equipamento: null, faltam: 0, cargas: n,
      mensagem: `${arm}: ${n} carga${n > 1 ? "s" : ""} de hoje ${n > 1 ? "precisam" : "precisa"} de empilhadeira e não há nenhuma disponível${motivos ? ` (${motivos})` : ""}. Libere um equipamento ou remarque a carga.`,
    });
  }

  // Cargas que pedem empilhadeira e ainda não têm destino: só dá para avisar se não resta nenhuma no sistema.
  const comDestino = new Set(destinos.map((d) => d.agendamentoId));
  const semDestino = doDia.filter((a) => !comDestino.has(a.id) && pedeEmpilhadeira(a.id));
  if (semDestino.length > 0 && !equipamentos.some((e) => ehEmpilhadeira(e.nome) && disponiveis(e) > 0)) {
    const n = semDestino.length;
    alertas.push({
      tipo: "sem_empilhadeira", armazem: "Todos os armazéns", equipamento: null, faltam: 0, cargas: n,
      mensagem: `${n} carga${n > 1 ? "s" : ""} de hoje sem destino ${n > 1 ? "precisam" : "precisa"} de empilhadeira e nenhum armazém tem uma disponível. Libere um equipamento antes de definir o destino.`,
    });
  }

  return alertas.sort((a, b) => a.armazem.localeCompare(b.armazem, "pt-BR") || a.tipo.localeCompare(b.tipo));
}
