import { and, asc, eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";
import { paraISO } from "@/lib/relogio";

import { type DbOuTx, registrarEvento } from "./comum";
import { autorizarCargaTx, definirDestinoTx, exigirPedidoAprovado, registrarEntradaTx, registrarSaidaTx } from "./descarga";
import { minutosEntre } from "./datas";

/**
 * Ações rápidas da descarga para a Tela do Dia (D51): `iniciar` e `encerrar`.
 * Cada uma é uma transação só, com os eventos das etapas e a origem no evento final.
 */

export interface InicioDescarga {
  inicioEm: string;
  previsaoTerminoEm: string | null;
  duracaoPrevistaMin: number | null;
}

export interface FimDescarga {
  fimEm: string;
  duracaoMin: number;
}

function destinosDe(tx: DbOuTx, id: number) {
  return tx.select().from(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.agendamentoId, id)).orderBy(asc(schema.agendamentoArmazem.ordem)).all();
}

/** Autoriza a carga (abre pendência se a validação for divergente), define o galpão se faltar e registra a entrada. */
export function iniciarDescarga(db: Db, id: number, dados: { armazemId?: number | null }, autor: string, agoraISO: string): InicioDescarga {
  return db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
      if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
      exigirPedidoAprovado(tx, id);
      if (ag.status === "em_descarga") throw new ErroDeRegra("A descarga já começou.");
      if (ag.status !== "chegou") {
        throw new ErroDeRegra(ag.status === "agendado" ? "O caminhão ainda não chegou. Registre a chegada antes de iniciar a descarga." : "Este agendamento está encerrado.");
      }

      let destinos = destinosDe(tx, id);
      if (dados.armazemId) {
        if (!destinos.some((d) => d.armazemId === dados.armazemId)) {
          definirDestinoTx(tx, id, [...destinos.map((d) => d.armazemId), dados.armazemId], autor, agoraISO);
          destinos = destinosDe(tx, id);
        }
      } else if (destinos.length === 0) {
        throw new ErroDeRegra("Informe o galpão da descarga: a carga ainda não tem destino.", { status: 400, campos: { armazemId: "Escolha o galpão." } });
      }
      const alvo = dados.armazemId ? destinos.find((d) => d.armazemId === dados.armazemId)! : destinos.find((d) => !d.entradaEm) ?? destinos[0];

      if (!ag.autorizadoEm) autorizarCargaTx(tx, id, autor, agoraISO);
      registrarEntradaTx(tx, id, alvo.armazemId, autor, agoraISO);

      const duracao = ag.duracaoPrevistaMin;
      const previsaoTerminoEm = duracao ? paraISO(new Date(Date.parse(agoraISO) + duracao * 60_000)) : null;
      registrarEvento(tx, id, "entrada", autor, agoraISO, { acao: "iniciar", armazemId: alvo.armazemId, previsaoTerminoEm, via: "tela_do_dia", origem: origemPadrao() });
      return { inicioEm: agoraISO, previsaoTerminoEm, duracaoPrevistaMin: duracao };
    },
    { behavior: "immediate" },
  );
}

/** Registra a saída em todos os galpões com entrada aberta e conclui. Sem `chapasQtd`, usa os chapas previstos. */
export function encerrarDescarga(
  db: Db,
  id: number,
  dados: { chapasQtd?: number | null; equipamentoIds?: number[] },
  autor: string,
  agoraISO: string,
): FimDescarga {
  if (dados.chapasQtd != null && (!Number.isInteger(dados.chapasQtd) || dados.chapasQtd < 0 || dados.chapasQtd > 20)) {
    throw new ErroDeRegra("Informe quantos funcionários atuaram, de 0 a 20.", { status: 400, campos: { chapasQtd: "Número inteiro de 0 a 20." } });
  }
  return db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
      if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
      if (ag.status === "concluido") throw new ErroDeRegra("Esta descarga já foi encerrada.");
      if (ag.status !== "em_descarga") throw new ErroDeRegra("A descarga ainda não começou. Inicie a descarga antes de encerrar.");

      const destinos = destinosDe(tx, id);
      const abertos = destinos.filter((d) => d.entradaEm && !d.saidaEm);
      if (abertos.length === 0) throw new ErroDeRegra("Não há galpão com descarga aberta.");
      // galpão do destino que não teve entrada não recebeu carga: sai do destino para a descarga poder concluir
      for (const d of destinos.filter((x) => !x.entradaEm)) tx.delete(schema.agendamentoArmazem).where(eq(schema.agendamentoArmazem.id, d.id)).run();

      const chapas = dados.chapasQtd ?? ag.chapasPrevistas ?? 0;
      if (!Number.isInteger(chapas) || chapas < 0 || chapas > 20) {
        throw new ErroDeRegra("Informe quantos funcionários atuaram, de 0 a 20.", { status: 400, campos: { chapasQtd: "Número inteiro de 0 a 20." } });
      }
      const equipamentoIds = [...new Set(dados.equipamentoIds ?? [])];
      const doGalpao = (armazemId: number) =>
        equipamentoIds.length === 0
          ? []
          : tx
              .select({ id: schema.equipamento.id })
              .from(schema.equipamento)
              .where(and(eq(schema.equipamento.armazemId, armazemId)))
              .all()
              .map((e) => e.id)
              .filter((x) => equipamentoIds.includes(x));
      const usados = new Set(abertos.flatMap((d) => doGalpao(d.armazemId)));
      if (equipamentoIds.some((e) => !usados.has(e))) throw new ErroDeRegra("Algum equipamento escolhido não pertence aos galpões em descarga.", { status: 400 });

      // os chapas contam uma vez: no primeiro galpão; os demais saem com 0
      abertos.forEach((d, i) => registrarSaidaTx(tx, id, d.armazemId, { chapasQtd: i === 0 ? chapas : 0, equipamentoIds: doGalpao(d.armazemId) }, autor, agoraISO));
      const primeira = abertos.map((d) => d.entradaEm!).sort()[0];
      const duracaoMin = Math.max(0, minutosEntre(primeira, agoraISO));
      registrarEvento(tx, id, "saida", autor, agoraISO, { acao: "encerrar", chapasQtd: chapas, duracaoMin, via: "tela_do_dia", origem: origemPadrao() });
      return { fimEm: agoraISO, duracaoMin };
    },
    { behavior: "immediate" },
  );
}

export interface Desfeito {
  de: "chegou" | "em_descarga" | "concluido";
  para: "agendado" | "chegou" | "em_descarga";
}

/**
 * Volta uma etapa da descarga (Tela do Dia): concluído → em descarga, em descarga → no pátio, no pátio → a chegar.
 * Limpa só os campos da etapa desfeita e grava o evento `desfeito`, para a trilha de auditoria mostrar a volta.
 */
export function desfazerEtapa(db: Db, id: number, autor: string, agoraISO: string): Desfeito {
  return db.transaction(
    (tx) => {
      const ag = tx.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get();
      if (!ag) throw new ErroDeRegra("Agendamento não encontrado.", { status: 404 });
      exigirPedidoAprovado(tx, id);
      const destinos = destinosDe(tx, id);

      if (ag.status === "concluido") {
        for (const d of destinos.filter((x) => x.saidaEm)) {
          tx.delete(schema.descargaEquipamento).where(eq(schema.descargaEquipamento.agendamentoArmazemId, d.id)).run();
          tx.update(schema.agendamentoArmazem).set({ saidaEm: null, chapasQtd: null, pesoKg: null }).where(eq(schema.agendamentoArmazem.id, d.id)).run();
        }
        tx.update(schema.agendamento).set({ status: "em_descarga", liberacaoEm: null, atualizadoEm: agoraISO }).where(eq(schema.agendamento.id, id)).run();
        registrarEvento(tx, id, "desfeito", autor, agoraISO, { de: "concluido", para: "em_descarga" });
        return { de: "concluido", para: "em_descarga" } as const;
      }
      if (ag.status === "em_descarga") {
        for (const d of destinos.filter((x) => x.entradaEm)) {
          tx.update(schema.agendamentoArmazem).set({ entradaEm: null, saidaEm: null, responsavel: null }).where(eq(schema.agendamentoArmazem.id, d.id)).run();
        }
        tx.update(schema.agendamento).set({ status: "chegou", atualizadoEm: agoraISO }).where(eq(schema.agendamento.id, id)).run();
        registrarEvento(tx, id, "desfeito", autor, agoraISO, { de: "em_descarga", para: "chegou" });
        return { de: "em_descarga", para: "chegou" } as const;
      }
      if (ag.status === "chegou") {
        tx.update(schema.agendamento).set({ status: "agendado", chegadaEm: null, pesoBalancaKg: null, atualizadoEm: agoraISO }).where(eq(schema.agendamento.id, id)).run();
        registrarEvento(tx, id, "desfeito", autor, agoraISO, { de: "chegou", para: "agendado" });
        return { de: "chegou", para: "agendado" } as const;
      }
      throw new ErroDeRegra("Não há etapa para desfazer neste agendamento.");
    },
    { behavior: "immediate" },
  );
}
