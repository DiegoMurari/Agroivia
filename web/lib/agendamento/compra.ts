import { randomBytes } from "node:crypto";

import { desc, eq, like, or } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { origemPadrao } from "@/lib/origem";
import { decOuNulo, paraTexto } from "@/lib/money";

export interface ItemCompraEntrada {
  produtoId?: number | null;
  descricao: string;
  quantidade?: string | null;
  unidade?: string | null;
  pesoKg?: string | null;
}

export interface CriarCompraEntrada {
  fornecedorId?: number;
  fornecedorNovo?: { razaoSocial: string; cnpj?: string | null };
  numeroPedido?: string | null;
  descricao?: string | null;
  itens?: ItemCompraEntrada[];
  criadaPor: string;
}

export function somenteDigitos(texto: string | null | undefined): string | null {
  const d = (texto ?? "").replace(/\D/g, "");
  return d === "" ? null : d;
}

function decimalOuErro(valor: string | null | undefined, campo: string): string | null {
  if (valor === null || valor === undefined || valor.trim() === "") return null;
  const v = decOuNulo(valor.trim().replace(",", "."));
  if (v === null || v.isNegative()) {
    throw new ErroDeRegra(`${campo} inválido. Digite um número positivo, por exemplo 1500,5.`, { status: 400 });
  }
  return paraTexto(v);
}

/** Compras cria a compra e o link com token (RF1-17). O token é aleatório e vale uma vez. */
export function criarCompra(db: Db, entrada: CriarCompraEntrada, agoraISO: string): { id: number; token: string } {
  return db.transaction(
    (tx) => {
      let fornecedorId = entrada.fornecedorId;
      if (fornecedorId === undefined) {
        const novo = entrada.fornecedorNovo;
        if (!novo || novo.razaoSocial.trim() === "") {
          throw new ErroDeRegra("Escolha um fornecedor do cadastro ou informe a razão social do novo.", { status: 400 });
        }
        fornecedorId = tx
          .insert(schema.fornecedor)
          .values({ codigo: null, razaoSocial: novo.razaoSocial.trim(), cnpj: somenteDigitos(novo.cnpj), origem: origemPadrao() })
          .returning({ id: schema.fornecedor.id })
          .get().id;
      } else {
        const existe = tx.select({ id: schema.fornecedor.id }).from(schema.fornecedor).where(eq(schema.fornecedor.id, fornecedorId)).get();
        if (!existe) throw new ErroDeRegra("Fornecedor não encontrado no cadastro.", { status: 404 });
      }

      const token = randomBytes(18).toString("base64url");
      const compra = tx
        .insert(schema.compra)
        .values({
          fornecedorId,
          numeroPedido: entrada.numeroPedido?.trim() || null,
          descricao: entrada.descricao?.trim() || null,
          token,
          status: "criada",
          criadaPor: entrada.criadaPor,
          criadaEm: agoraISO,
          origem: origemPadrao(),
        })
        .returning({ id: schema.compra.id })
        .get();

      for (const item of entrada.itens ?? []) {
        tx.insert(schema.compraItem)
          .values({
            compraId: compra.id,
            produtoId: item.produtoId ?? null,
            descricao: item.descricao.trim(),
            quantidade: decimalOuErro(item.quantidade, "Quantidade"),
            unidade: item.unidade?.trim() || null,
            pesoKg: decimalOuErro(item.pesoKg, "Peso"),
          })
          .run();
      }
      return { id: compra.id, token };
    },
    { behavior: "immediate" },
  );
}

export function buscarFornecedores(db: Db, termo: string, limite = 15) {
  const t = termo.trim();
  if (t.length < 2) return [];
  const digitos = somenteDigitos(t);
  const filtros = [like(schema.fornecedor.razaoSocial, `%${t}%`), like(schema.fornecedor.codigo, `%${t}%`)];
  if (digitos) filtros.push(like(schema.fornecedor.cnpj, `%${digitos}%`));
  return db
    .select({ id: schema.fornecedor.id, codigo: schema.fornecedor.codigo, razaoSocial: schema.fornecedor.razaoSocial, cnpj: schema.fornecedor.cnpj })
    .from(schema.fornecedor)
    .where(or(...filtros))
    .limit(limite)
    .all();
}

export function buscarProdutos(db: Db, termo: string, limite = 15) {
  const t = termo.trim();
  if (t.length < 2) return [];
  return db
    .select({
      id: schema.produto.id,
      item: schema.produto.item,
      descricao: schema.produto.descricao,
      unidade: schema.produto.unidade,
      grupo: schema.produto.grupo,
      armazemId: schema.produto.armazemId,
    })
    .from(schema.produto)
    .where(or(like(schema.produto.descricao, `%${t}%`), like(schema.produto.item, `%${t}%`)))
    .limit(limite)
    .all();
}

export interface CompraResumo {
  id: number;
  token: string;
  status: string;
  numeroPedido: string | null;
  criadaEm: string;
  fornecedor: string;
  agendamentoId: number | null;
  agendamentoData: string | null;
  agendamentoHorario: string | null;
  agendamentoStatus: string | null;
}

/** Lista para a tela de Compras: as mais novas primeiro (por id; a data é texto ISO). */
export function listarCompras(db: Db, limite = 30): CompraResumo[] {
  const linhas = db
    .select({
      id: schema.compra.id,
      token: schema.compra.token,
      status: schema.compra.status,
      numeroPedido: schema.compra.numeroPedido,
      criadaEm: schema.compra.criadaEm,
      fornecedor: schema.fornecedor.razaoSocial,
    })
    .from(schema.compra)
    .innerJoin(schema.fornecedor, eq(schema.fornecedor.id, schema.compra.fornecedorId))
    .orderBy(desc(schema.compra.id))
    .limit(limite)
    .all();
  return linhas.map((c) => {
    const ag = db
      .select({ id: schema.agendamento.id, data: schema.agendamento.data, horario: schema.agendamento.horario, status: schema.agendamento.status })
      .from(schema.agendamento)
      .where(eq(schema.agendamento.compraId, c.id))
      .get();
    return { ...c, agendamentoId: ag?.id ?? null, agendamentoData: ag?.data ?? null, agendamentoHorario: ag?.horario ?? null, agendamentoStatus: ag?.status ?? null };
  });
}
