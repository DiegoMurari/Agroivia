/**
 * Consultas fixas do painel (D32): as perguntas que o painel já responde, escolhidas direto pelo usuário
 * ou indicadas pela LLM (que só devolve id, período e armazém, nunca texto nem SQL).
 * Este módulo é a única fonte da resposta: monta o texto a partir das mesmas funções do painel. Só leitura.
 */
import type { Db } from "@/lib/db";
import { dividir, formatBRL, formatNumero } from "@/lib/money";
import { demandaPorArmazem, filtroDaUrl, type Filtro, resumoHistorico } from "./consultas";
import { SEM_DADO, fraseDaResposta } from "./frase";
import { ARMAZENS_NL, CONSULTAS, escolherConsulta, type MotivoFalha, type OpcoesEscolha } from "./linguagem-natural";
import { cargasPorDia, custoDoPeriodo, diasDeMaiorMovimento, fornecedoresPorPeso } from "./indicadores";

export type ConsultaId = "sobra_falta" | "custo" | "cargas_por_dia" | "dias_de_maior_movimento" | "fornecedores_por_peso";

export interface RespostaConsulta {
  consulta: ConsultaId;
  titulo: string;
  origem: "historico";
  periodo: string;
  /** Texto da resposta, linha a linha. */
  linhas: string[];
  tabela?: { colunas: string[]; linhas: string[][] };
  /** Ressalva que vai junto de todo número histórico. */
  aviso: string;
  semDado: boolean;
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function semDado(consulta: ConsultaId, titulo: string, periodo: string, aviso: string): RespostaConsulta {
  return { consulta, titulo, origem: "historico", periodo, linhas: [SEM_DADO], aviso, semDado: true };
}

/** Período vindo da escolha (texto) para o filtro do painel; valor fora do formato cai em safra. */
export function filtroDaEscolha(periodo?: string): Filtro {
  return filtroDaUrl(periodo, null);
}

export function executarConsulta(db: Db, consulta: ConsultaId, filtro: Filtro, armazem?: string): RespostaConsulta {
  switch (consulta) {
    case "sobra_falta": {
      const h = resumoHistorico(db, filtro);
      const titulo = "Excesso ou falta de funcionários";
      if (!h.resumo) return semDado(consulta, titulo, h.rotulo, h.aviso);
      const f = fraseDaResposta(h.resumo, h.piso, h.rotulo);
      const linhas = [f.principal, f.detalhe, f.pico];
      if (armazem) {
        const a = demandaPorArmazem(db, filtro)?.armazens.find((x) => x.nome === armazem);
        linhas.push(
          a
            ? `${armazem}: ${formatNumero(a.diariasPorDia)} diárias justificadas por dia (demanda)${a.efetivoRateado ? `, efetivo rateado de ${formatNumero(a.efetivoRateado)} (premissa, a folha não registra o armazém)` : ", fora da comparação com a folha (não faz boletim)"}.`
            : `${armazem}: sem dado neste período.`,
        );
      }
      return { consulta, titulo, origem: "historico", periodo: h.rotulo, linhas, aviso: f.ressalva, semDado: false };
    }
    case "custo": {
      const h = resumoHistorico(db, filtro);
      const c = custoDoPeriodo(db, filtro, h);
      const titulo = "Custo estimado";
      if (!c) return semDado(consulta, titulo, h.rotulo, h.aviso);
      return {
        consulta,
        titulo,
        origem: "historico",
        periodo: c.rotulo,
        linhas: [
          `Custo estimado de ${formatBRL(c.custoTotal)} em ${c.diasConsiderados} dias comparados, cerca de ${formatBRL(c.custoMedioPorDia)} por dia.`,
          `Complemento pago sem produção (teto): ${formatBRL(c.complementoTotal)}. Produção acima do efetivo (piso): ${formatBRL(c.faltaReaisTotal)}.`,
        ],
        aviso: c.aviso,
        semDado: false,
      };
    }
    case "cargas_por_dia": {
      const c = cargasPorDia(db, filtro);
      const titulo = "Cargas por dia";
      if (!c) return semDado(consulta, titulo, resumoHistorico(db, filtro).rotulo, "");
      const linhas = [
        `${c.totalCargas} cargas em ${c.diasComRecebimento} dias com recebimento, média de ${formatNumero(c.mediaPorDia)} por dia e máximo de ${c.maximoPorDia} em um dia.`,
      ];
      const doArmazem = armazem ? c.porArmazem.find((a) => a.nome === armazem) : undefined;
      if (armazem) linhas.push(doArmazem ? `${armazem}: ${formatNumero(doArmazem.mediaPorDia)} cargas por dia (${doArmazem.cargas} no período).` : `${armazem}: sem carga neste período.`);
      else if (c.porArmazem.length > 0) linhas.push(`Por armazém: ${c.porArmazem.map((a) => `${a.nome} ${formatNumero(a.mediaPorDia)} por dia`).join("; ")}.`);
      return { consulta, titulo, origem: "historico", periodo: c.rotulo, linhas, aviso: c.aviso, semDado: false };
    }
    case "dias_de_maior_movimento": {
      const d = diasDeMaiorMovimento(db, filtro);
      const titulo = "Dias de maior movimento";
      if (!d) return semDado(consulta, titulo, resumoHistorico(db, filtro).rotulo, "");
      return {
        consulta,
        titulo,
        origem: "historico",
        periodo: d.rotulo,
        linhas: ["Dias com mais cargas recebidas no período. Os horários de maior movimento não existem no histórico."],
        tabela: { colunas: ["Data", "Dia da semana", "Cargas"], linhas: d.dias.map((x) => [x.data, DIAS[x.diaDaSemana], String(x.cargas)]) },
        aviso: d.aviso,
        semDado: false,
      };
    }
    case "fornecedores_por_peso": {
      const f = fornecedoresPorPeso(db, filtro);
      const titulo = "Fornecedores com maior volume";
      if (!f) return semDado(consulta, titulo, resumoHistorico(db, filtro).rotulo, "");
      return {
        consulta,
        titulo,
        origem: "historico",
        periodo: f.rotulo,
        linhas: [`Dez maiores fornecedores por peso recebido. Linhas sem peso utilizável: ${f.linhasSemPeso}; sem código de fornecedor: ${f.linhasSemFornecedor}.`],
        tabela: {
          colunas: ["Fornecedor", "Peso (t)", "Parte do peso"],
          linhas: f.fornecedores.map((x) => [x.nome, formatNumero(dividir(x.pesoKg, "1000")), `${formatNumero(x.participacao.times(100), 1)}%`]),
        },
        aviso: f.aviso,
        semDado: false,
      };
    }
  }
}

export interface EntradaConsulta {
  /** Pergunta livre (opcional). Só vai à LLM, mascarada, se houver chave. */
  pergunta?: string;
  /** Consulta escolhida direto na lista fixa: tem prioridade sobre a pergunta. */
  consulta?: string;
  periodo?: string;
  armazem?: string;
}

export type SaidaConsulta =
  | { modo: "nenhuma" }
  | { modo: "fixa" | "llm"; resposta: RespostaConsulta }
  /** A LLM não pôde ajudar (sem chave, rede, tempo, resposta fora do formato): o usuário escolhe uma consulta da lista. */
  | { modo: "fallback"; motivo: MotivoFalha };

const IDS = new Set<string>(CONSULTAS.map((c) => c.id));

/**
 * Orquestra a consulta: lista fixa primeiro; a LLM só entra com pergunta e sem consulta escolhida,
 * e apenas indica id, período e armazém. A resposta sempre sai de executarConsulta.
 */
export async function resolverConsulta(db: Db, entrada: EntradaConsulta, opcoes: OpcoesEscolha = {}): Promise<SaidaConsulta> {
  const armazemValido = (a?: string) => (a && (ARMAZENS_NL as readonly string[]).includes(a) ? a : undefined);
  if (entrada.consulta && IDS.has(entrada.consulta)) {
    return {
      modo: "fixa",
      resposta: executarConsulta(db, entrada.consulta as ConsultaId, filtroDaEscolha(entrada.periodo), armazemValido(entrada.armazem)),
    };
  }
  if (!entrada.pergunta || entrada.pergunta.trim() === "") return { modo: "nenhuma" };
  const r = await escolherConsulta(entrada.pergunta, opcoes);
  if (!r.ok) return { modo: "fallback", motivo: r.motivo };
  return {
    modo: "llm",
    resposta: executarConsulta(db, r.escolha.consulta as ConsultaId, filtroDaEscolha(r.escolha.periodo), r.escolha.armazem),
  };
}
