import { z } from "zod";

import {
  abrirPendencia,
  autorizarCarga,
  definirDestino,
  exigirPedidoAprovado,
  registrarChegada,
  registrarEntrada,
  registrarSaida,
  registrarValidacao,
} from "@/lib/agendamento/descarga";
import { cancelarAgendamento, registrarNaoRecebimento, remarcarAgendamento } from "@/lib/agendamento/desvios";
import { desfazerEtapa, encerrarDescarga, iniciarDescarga } from "@/lib/agendamento/rapidas";
import { registrarAtrasoManual, remarcarPorAtraso } from "@/lib/agendamento/portaria";
import { getDb } from "@/lib/db";
import { VALIDACAO_STATUS } from "@/lib/db/enums";
import { erro, lerJson, ok, responderErro, validar } from "@/lib/http";
import { papelAtual } from "@/lib/papel";
import { agoraISO } from "@/lib/relogio";

const texto = z.string().trim().max(500).nullish();

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("validar"), status: z.enum(VALIDACAO_STATUS), obs: texto }),
  z.object({ acao: z.literal("autorizar") }),
  z.object({ acao: z.literal("desfazer") }),
  z.object({ acao: z.literal("iniciar"), armazemId: z.number().int().positive().nullish() }),
  z.object({
    acao: z.literal("encerrar"),
    chapasQtd: z.number().int().min(0, "Não pode ser negativo.").max(20, "No máximo 20 funcionários.").nullish(),
    equipamentoIds: z.array(z.number().int().positive()).default([]),
  }),
  z.object({ acao: z.literal("destino"), armazemIds: z.array(z.number().int().positive()).min(1, "Escolha pelo menos um armazém.") }),
  z.object({ acao: z.literal("chegada"), placa: z.string().trim().max(10).nullish(), pesoBalancaKg: z.string().trim().max(20).nullish() }),
  z.object({ acao: z.literal("entrada"), armazemId: z.number().int().positive() }),
  z.object({
    acao: z.literal("saida"),
    armazemId: z.number().int().positive(),
    chapasQtd: z.number().int().min(0, "Não pode ser negativo.").max(20, "No máximo 20 funcionários."),
    equipamentoIds: z.array(z.number().int().positive()).default([]),
    pesoKg: z.string().trim().max(20).nullish(),
  }),
  z.object({ acao: z.literal("remarcar_atraso") }),
  z.object({
    acao: z.literal("atraso_manual"),
    previsao: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
    motivo: z.string().trim().min(1, "Informe o motivo.").max(300),
  }),
  z.object({ acao: z.literal("cancelar"), motivo: z.string().trim().min(1, "Informe o motivo.").max(300) }),
  z.object({
    acao: z.literal("reagendar"),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
    horario: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
    motivo: z.string().trim().min(1, "Informe o motivo do caso fortuito.").max(300),
  }),
  z.object({
    acao: z.literal("prioridade"),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
    horario: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
    motivo: z.string().trim().min(1, "A justificativa é obrigatória.").max(300),
  }),
  z.object({ acao: z.literal("nao_recebimento"), motivo: z.string(), descricao: texto }),
  z.object({ acao: z.literal("pendencia"), tipo: z.enum(["divergencia_nf_pedido", "outra"]), descricao: z.string().trim().min(1, "Descreva a pendência.").max(500) }),
]);

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return erro(400, "Agendamento inválido.");
    const v = validar(esquema, await lerJson(request));
    if (!v.ok) return v.resposta;
    const d = v.data;
    const db = getDb();
    exigirPedidoAprovado(db, id);
    const autor = await papelAtual();
    const agora = agoraISO();

    switch (d.acao) {
      case "validar":
        registrarValidacao(db, id, { status: d.status, obs: d.obs }, autor, agora);
        return ok({});
      case "desfazer":
        return ok(desfazerEtapa(db, id, autor, agora));
      case "autorizar":
        return ok(autorizarCarga(db, id, autor, agora));
      case "iniciar":
        return ok(iniciarDescarga(db, id, { armazemId: d.armazemId }, autor, agora));
      case "encerrar":
        return ok(encerrarDescarga(db, id, { chapasQtd: d.chapasQtd, equipamentoIds: d.equipamentoIds }, autor, agora));
      case "destino":
        definirDestino(db, id, d.armazemIds, autor, agora);
        return ok({});
      case "chegada":
        registrarChegada(db, id, { placa: d.placa, pesoBalancaKg: d.pesoBalancaKg }, autor, agora);
        return ok({});
      case "entrada":
        registrarEntrada(db, id, d.armazemId, autor, agora);
        return ok({});
      case "saida":
        return ok(registrarSaida(db, id, d.armazemId, { chapasQtd: d.chapasQtd, equipamentoIds: d.equipamentoIds, pesoKg: d.pesoKg }, autor, agora));
      case "atraso_manual":
        registrarAtrasoManual(db, id, { previsao: d.previsao, motivo: d.motivo, por: "portaria" }, autor, agora);
        return ok({});
      case "remarcar_atraso":
        return ok(remarcarPorAtraso(db, id, autor, agora));
      case "cancelar":
        return ok(cancelarAgendamento(db, id, { motivo: d.motivo, por: "armazem" }, autor, agora));
      case "reagendar":
        remarcarAgendamento(db, id, { data: d.data, horario: d.horario, excecao: "caso_fortuito", motivo: d.motivo }, autor, agora);
        return ok({});
      case "prioridade":
        remarcarAgendamento(db, id, { data: d.data, horario: d.horario, excecao: "prioridade", motivo: d.motivo }, autor, agora);
        return ok({});
      case "nao_recebimento":
        return ok(registrarNaoRecebimento(db, { agendamentoId: id, motivo: d.motivo, descricao: d.descricao }, autor, agora));
      case "pendencia":
        return ok(abrirPendencia(db, id, { tipo: d.tipo, descricao: d.descricao }, autor, agora), 201);
    }
  } catch (e) {
    return responderErro(e);
  }
}
