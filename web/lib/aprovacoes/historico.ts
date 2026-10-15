/**
 * Histórico de decisões de Compras (D49): quem aprovou ou recusou cada cadastro de fornecedor e cada pedido de descarga.
 * Só leitura. A fonte é a `log_aprovacao`, que grava a decisão, o usuário e o instante.
 */
import { desc, eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";

export interface DecisaoRegistrada {
  id: number;
  alvo: "cadastro" | "pedido";
  alvoId: number;
  /** Fornecedor a que a decisão se refere. */
  titulo: string;
  /** "Cadastro de fornecedor" ou "Descarga de 06/10 às 10:00". */
  detalhe: string;
  decisao: "aprovado" | "recusado";
  comentario: string | null;
  /** Quem decidiu. */
  por: string;
  porPerfil: string | null;
  /** Instante da decisão, ISO com fuso. */
  em: string;
  /** Para onde levar quem clicar. */
  link: string | null;
}

const dataBR = (d: string) => d.split("-").reverse().join("/");

export function listarDecisoes(db: Db, limite = 200): DecisaoRegistrada[] {
  const usuarios = new Map(db.select().from(schema.usuario).all().map((u) => [u.id, u]));
  const cadastros = new Map(db.select().from(schema.fornecedorCadastro).all().map((c) => [c.id, c]));
  const fornecedores = new Map(db.select().from(schema.fornecedor).all().map((f) => [f.id, f.razaoSocial]));
  const agendamentos = new Map(db.select().from(schema.agendamento).all().map((a) => [a.id, a]));

  return db
    .select()
    .from(schema.logAprovacao)
    .orderBy(desc(schema.logAprovacao.criadoEm), desc(schema.logAprovacao.id))
    .limit(limite)
    .all()
    .map((l): DecisaoRegistrada => {
      const quem = usuarios.get(l.usuarioId);
      const base = { id: l.id, alvo: l.alvo, alvoId: l.alvoId, decisao: l.decisao, comentario: l.comentario, por: quem?.nome ?? "Usuário removido", porPerfil: quem?.perfil ?? null, em: l.criadoEm } as const;
      if (l.alvo === "cadastro") {
        const c = cadastros.get(l.alvoId);
        return { ...base, titulo: c?.razaoSocial ?? "Fornecedor removido", detalhe: "Cadastro de fornecedor", link: null };
      }
      const a = agendamentos.get(l.alvoId);
      return {
        ...base,
        titulo: a ? (fornecedores.get(a.fornecedorId) ?? "Fornecedor não identificado") : "Pedido removido",
        detalhe: a ? `Descarga de ${dataBR(a.data)} às ${a.horario}` : "Pedido de descarga",
        link: a ? `/agendamento/descarga/${a.id}` : null,
      };
    });
}

/** Quem aprovou o cadastro do fornecedor, para mostrar na ficha dele. */
export function aprovadorDoCadastro(db: Db, cadastroId: number): { por: string; em: string } | null {
  const l = db
    .select()
    .from(schema.logAprovacao)
    .where(eq(schema.logAprovacao.alvoId, cadastroId))
    .all()
    .filter((x) => x.alvo === "cadastro" && x.decisao === "aprovado")
    .sort((x, y) => y.criadoEm.localeCompare(x.criadoEm))[0];
  if (!l) return null;
  const u = db.select().from(schema.usuario).where(eq(schema.usuario.id, l.usuarioId)).get();
  return { por: u?.nome ?? "Usuário removido", em: l.criadoEm };
}
