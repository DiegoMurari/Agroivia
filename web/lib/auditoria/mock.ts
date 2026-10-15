/**
 * Dados simulados para a demonstração de Aprovações e Auditoria (mockado de propósito).
 * Preenche quem aprovou os pedidos e deixa alguns pedidos aguardando decisão, para as telas não aparecerem vazias.
 * Idempotente: um marcador em `parametro` impede de rodar duas vezes. Nunca roda sobre um banco com decisões reais.
 */
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";

const MARCADOR = "mock_auditoria_v1";

export function garantirDadosDeAuditoria(db: Db, hoje: string): boolean {
  if (db.select().from(schema.parametro).where(eq(schema.parametro.chave, MARCADOR)).get()) return false;

  const usuarios = db.select().from(schema.usuario).all();
  const adm = usuarios.find((u) => u.perfil === "adm_master");
  const compras = usuarios.find((u) => u.perfil === "compras");
  const fornecedorUsuario = usuarios.find((u) => u.perfil === "fornecedor" && u.email === "fornecedor@demo.com.br");
  if (!adm || !compras) return false;
  const decisores = [compras.id, adm.id];

  db.transaction(
    (tx) => {
      // 1) Pedidos já aprovados: quem aprovou e quando (logo depois de o pedido ser criado)
      const antigos = tx
        .select()
        .from(schema.agendamento)
        .where(and(eq(schema.agendamento.aprovacao, "aprovado"), isNull(schema.agendamento.aprovacaoPor)))
        .orderBy(asc(schema.agendamento.id))
        .limit(24)
        .all();
      antigos.forEach((a, i) => {
        const por = decisores[i % 2];
        const em = a.criadoEm;
        tx.update(schema.agendamento).set({ aprovacaoPor: por, aprovacaoEm: em }).where(eq(schema.agendamento.id, a.id)).run();
        tx.insert(schema.logAprovacao).values({ alvo: "pedido", alvoId: a.id, decisao: "aprovado", usuarioId: por, criadoEm: em }).run();
      });

      // 2) Uma recusa com motivo, num pedido cancelado
      const cancelado = tx.select().from(schema.agendamento).where(eq(schema.agendamento.status, "cancelado")).limit(1).get();
      if (cancelado) {
        tx.insert(schema.logAprovacao)
          .values({ alvo: "pedido", alvoId: cancelado.id, decisao: "recusado", comentario: "Peso da NF acima do pedido. Corrija e envie de novo.", usuarioId: compras.id, criadoEm: cancelado.criadoEm })
          .run();
      }

      // 3) Dois pedidos futuros do fornecedor de demonstração esperando a decisão de Compras
      if (fornecedorUsuario) {
        const futuros = tx
          .select()
          .from(schema.agendamento)
          .where(and(eq(schema.agendamento.status, "agendado"), gt(schema.agendamento.data, hoje)))
          .orderBy(asc(schema.agendamento.data), asc(schema.agendamento.horario))
          .limit(2)
          .all();
        if (futuros.length > 0) {
          tx.update(schema.agendamento)
            .set({ aprovacao: "aguardando", aprovacaoPor: null, aprovacaoEm: null, criadoPorUsuarioId: fornecedorUsuario.id })
            .where(inArray(schema.agendamento.id, futuros.map((f) => f.id)))
            .run();
        }
      }

      tx.insert(schema.parametro).values({ chave: MARCADOR, valor: "1", descricao: "Dados simulados de aprovação e auditoria já aplicados" }).run();
    },
    { behavior: "immediate" },
  );
  return true;
}
