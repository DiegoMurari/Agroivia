/**
 * Cadastro B2B do fornecedor e decisões de Compras (D49): convite, cadastro, aprovação e alteração de dados.
 * Funções recebem `db` e a data/hora ISO (`agora`); nada aqui usa o relógio. Gravações em transação.
 */
import { and, eq, isNotNull } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { hashSenha, normalizarEmail, novoToken, SENHA_MINIMA } from "@/lib/senha";

const soDigitos = (t: string) => t.replace(/\D/g, "");

export function cnpjValido(cnpj: string): boolean {
  if (/[^\d.\-/\s]/.test(cnpj)) return false;
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((t, c, i) => t + Number(c) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function criarConvite(db: Db, usuarioId: number, agora: string): { id: number; token: string } {
  const token = novoToken();
  const { id } = db.insert(schema.conviteFornecedor).values({ token, criadoPor: usuarioId, criadoEm: agora }).returning({ id: schema.conviteFornecedor.id }).get();
  return { id, token };
}

/** Cadastro aberto: o botão "Registre-se" do login. Não usa convite; a aprovação de Compras continua obrigatória. */
export const TOKEN_ABERTO = "aberto";

export function conviteDoToken(db: Db, token: string): { id: number; usado: boolean } | null {
  if (!token) return null;
  if (token === TOKEN_ABERTO) return { id: 0, usado: false };
  const c = db.select().from(schema.conviteFornecedor).where(eq(schema.conviteFornecedor.token, token)).get();
  return c ? { id: c.id, usado: c.usadoEm !== null } : null;
}

export interface DadosFornecedor {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  email: string;
  telefone?: string;
  responsavel?: string;
  endereco?: string;
  tiposMercadoria: string[];
}

function erroCampos(campos: Record<string, string>, status = 400): never {
  throw new ErroDeRegra("Confira os campos.", { status, campos });
}

function validarDados(d: Partial<DadosFornecedor>, completo: boolean): Record<string, string> {
  const campos: Record<string, string> = {};
  if ((completo || d.razaoSocial !== undefined) && !d.razaoSocial?.trim()) campos.razaoSocial = "Informe a razão social.";
  if ((completo || d.cnpj !== undefined) && (!d.cnpj || !cnpjValido(d.cnpj))) campos.cnpj = "CNPJ inválido. Confira os 14 números.";
  if ((completo || d.email !== undefined) && (!d.email || !emailValido(d.email))) campos.email = "E-mail inválido.";
  if ((completo || d.tiposMercadoria !== undefined) && (!d.tiposMercadoria || d.tiposMercadoria.length === 0)) {
    campos.tiposMercadoria = "Escolha ao menos um tipo de mercadoria.";
  }
  return campos;
}

/** CNPJ ou e-mail já usados por outro cadastro. `ignorarCadastroId` deixa o próprio cadastro passar. */
function conflitos(db: Db, cnpj: string | undefined, email: string | undefined, ignorarCadastroId?: number): Record<string, string> {
  const campos: Record<string, string> = {};
  const cadastros = db.select().from(schema.fornecedorCadastro).all();
  if (cnpj && cadastros.some((c) => c.id !== ignorarCadastroId && soDigitos(c.cnpj) === soDigitos(cnpj))) campos.cnpj = "Este CNPJ já está cadastrado.";
  if (email) {
    const e = normalizarEmail(email);
    const usuario = db.select({ id: schema.usuario.id }).from(schema.usuario).where(eq(schema.usuario.email, e)).get();
    const donoDoUsuario = usuario ? cadastros.find((c) => c.usuarioId === usuario.id) : undefined;
    const usuarioOcupado = usuario !== undefined && (!donoDoUsuario || donoDoUsuario.id !== ignorarCadastroId);
    const cadastroOcupado = cadastros.some((c) => c.id !== ignorarCadastroId && c.email.toLowerCase() === e);
    if (usuarioOcupado || cadastroOcupado) campos.email = "Este e-mail já está cadastrado.";
  }
  return campos;
}

export function cadastrarFornecedor(db: Db, token: string, dados: DadosFornecedor & { senha: string }, agora: string): { usuarioId: number; cadastroId: number } {
  const convite = conviteDoToken(db, token);
  if (!convite) throw new ErroDeRegra("Convite inexistente.", { status: 400 });
  if (convite.usado) throw new ErroDeRegra("Este convite já foi usado.", { status: 409 });

  const campos = validarDados(dados, true);
  if (!dados.senha || dados.senha.length < SENHA_MINIMA) campos.senha = `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`;
  if (Object.keys(campos).length > 0) erroCampos(campos);
  const dup = conflitos(db, dados.cnpj, dados.email);
  if (Object.keys(dup).length > 0) erroCampos(dup, 409);

  return db.transaction((tx) => {
    // Uso único: só marca se ainda estiver livre (o cadastro aberto não tem convite)
    if (token !== TOKEN_ABERTO) {
      const marcado = tx
        .update(schema.conviteFornecedor)
        .set({ usadoEm: agora })
        .where(and(eq(schema.conviteFornecedor.id, convite.id), eq(schema.conviteFornecedor.token, token)))
        .returning({ id: schema.conviteFornecedor.id })
        .all();
      if (marcado.length === 0) throw new ErroDeRegra("Este convite já foi usado.", { status: 409 });
    }
    const email = normalizarEmail(dados.email);
    const usuarioId = tx
      .insert(schema.usuario)
      .values({ nome: dados.razaoSocial.trim(), papel: "fornecedor", email, perfil: "fornecedor", senhaHash: hashSenha(dados.senha), ativo: true, criadoEm: agora })
      .returning({ id: schema.usuario.id })
      .get().id;
    const cadastroId = tx
      .insert(schema.fornecedorCadastro)
      .values({
        usuarioId,
        razaoSocial: dados.razaoSocial.trim(),
        nomeFantasia: dados.nomeFantasia?.trim() || null,
        cnpj: soDigitos(dados.cnpj),
        inscricaoEstadual: dados.inscricaoEstadual?.trim() || null,
        email,
        telefone: dados.telefone?.trim() || null,
        responsavel: dados.responsavel?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        tiposMercadoria: JSON.stringify(dados.tiposMercadoria),
        status: "pendente",
        criadoEm: agora,
      })
      .returning({ id: schema.fornecedorCadastro.id })
      .get().id;
    return { usuarioId, cadastroId };
  });
}

type Alteracao = Partial<DadosFornecedor>;

export interface CadastroPendente {
  id: number;
  razaoSocial: string;
  cnpj: string;
  email: string;
  atual: DadosFornecedor;
  alteracao: Alteracao | null;
  criadoEm: string;
}

function paraPendente(c: typeof schema.fornecedorCadastro.$inferSelect): CadastroPendente {
  return {
    id: c.id,
    razaoSocial: c.razaoSocial,
    cnpj: c.cnpj,
    email: c.email,
    atual: {
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia ?? undefined,
      cnpj: c.cnpj,
      inscricaoEstadual: c.inscricaoEstadual ?? undefined,
      email: c.email,
      telefone: c.telefone ?? undefined,
      responsavel: c.responsavel ?? undefined,
      endereco: c.endereco ?? undefined,
      tiposMercadoria: c.tiposMercadoria ? (JSON.parse(c.tiposMercadoria) as string[]) : [],
    },
    alteracao: c.alteracaoPendente ? (JSON.parse(c.alteracaoPendente) as Alteracao) : null,
    criadoEm: c.criadoEm,
  };
}

export function listarPendencias(db: Db): { novos: CadastroPendente[]; alteracoes: CadastroPendente[] } {
  const novos = db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.status, "pendente")).all().map(paraPendente);
  const alteracoes = db
    .select()
    .from(schema.fornecedorCadastro)
    .where(and(eq(schema.fornecedorCadastro.status, "aprovado"), isNotNull(schema.fornecedorCadastro.alteracaoPendente)))
    .all()
    .map(paraPendente);
  return { novos, alteracoes };
}

export function decidirCadastro(
  db: Db,
  cadastroId: number,
  decisao: "aprovado" | "recusado",
  porUsuarioId: number,
  agora: string,
  comentario?: string,
): void {
  const c = db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.id, cadastroId)).get();
  if (!c) throw new ErroDeRegra("Cadastro não encontrado.", { status: 404 });
  const ehAlteracao = c.status === "aprovado" && c.alteracaoPendente !== null;
  if (c.status !== "pendente" && !ehAlteracao) throw new ErroDeRegra("Este cadastro não tem nada a decidir.", { status: 409 });
  const motivo = comentario?.trim();
  if (decisao === "recusado" && !motivo) erroCampos({ comentario: "Explique o motivo da recusa." });

  db.transaction((tx) => {
    const alvo = eq(schema.fornecedorCadastro.id, c.id);
    if (decisao === "aprovado" && ehAlteracao) {
      const a = JSON.parse(c.alteracaoPendente as string) as Alteracao;
      tx.update(schema.fornecedorCadastro)
        .set({
          razaoSocial: a.razaoSocial ?? c.razaoSocial,
          nomeFantasia: a.nomeFantasia ?? c.nomeFantasia,
          cnpj: a.cnpj ? soDigitos(a.cnpj) : c.cnpj,
          inscricaoEstadual: a.inscricaoEstadual ?? c.inscricaoEstadual,
          email: a.email ? normalizarEmail(a.email) : c.email,
          telefone: a.telefone ?? c.telefone,
          responsavel: a.responsavel ?? c.responsavel,
          endereco: a.endereco ?? c.endereco,
          tiposMercadoria: a.tiposMercadoria ? JSON.stringify(a.tiposMercadoria) : c.tiposMercadoria,
          alteracaoPendente: null,
          decididoPor: porUsuarioId,
          decididoEm: agora,
        })
        .where(alvo)
        .run();
    } else if (decisao === "aprovado") {
      tx.update(schema.fornecedorCadastro).set({ status: "aprovado", decididoPor: porUsuarioId, decididoEm: agora, motivoRecusa: null }).where(alvo).run();
    } else if (ehAlteracao) {
      tx.update(schema.fornecedorCadastro).set({ alteracaoPendente: null, motivoRecusa: motivo, decididoPor: porUsuarioId, decididoEm: agora }).where(alvo).run();
    } else {
      tx.update(schema.fornecedorCadastro).set({ status: "recusado", motivoRecusa: motivo, decididoPor: porUsuarioId, decididoEm: agora }).where(alvo).run();
    }
    tx.insert(schema.logAprovacao).values({ alvo: "cadastro", alvoId: c.id, decisao, comentario: motivo || null, usuarioId: porUsuarioId, criadoEm: agora }).run();
    const o = ehAlteracao ? "A alteração dos seus dados" : "Seu cadastro";
    tx.insert(schema.notificacao)
      .values({
        usuarioId: c.usuarioId,
        tipo: decisao === "aprovado" ? "cadastro_aprovado" : "cadastro_recusado",
        mensagem: decisao === "aprovado" ? `${o} foi aprovado.` : `${o} foi recusado. Motivo: ${motivo}`,
        link: "/fornecedor",
        criadoEm: agora,
      })
      .run();
  });
}

/** O fornecedor aprovado propõe novos dados; os atuais continuam valendo até Compras aprovar. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `agora` fica na assinatura para o chamador e para o futuro histórico
export function solicitarAlteracao(db: Db, usuarioId: number, dados: Alteracao, _agora?: string): void {
  const u = db.select().from(schema.usuario).where(eq(schema.usuario.id, usuarioId)).get();
  if (!u || u.perfil !== "fornecedor") throw new ErroDeRegra("Só o fornecedor altera os próprios dados.", { status: 403 });
  const c = db.select().from(schema.fornecedorCadastro).where(eq(schema.fornecedorCadastro.usuarioId, usuarioId)).get();
  if (!c) throw new ErroDeRegra("Cadastro não encontrado.", { status: 404 });
  if (c.status !== "aprovado") throw new ErroDeRegra("Seu cadastro ainda não foi aprovado.", { status: 403 });

  const dup = conflitos(db, dados.cnpj, dados.email, c.id);
  if (Object.keys(dup).length > 0) erroCampos(dup, 409);
  const campos = validarDados(dados, false);
  if (Object.keys(campos).length > 0) erroCampos(campos);

  const limpo: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (v === undefined) continue;
    limpo[k] = k === "cnpj" ? soDigitos(v as string) : k === "email" ? normalizarEmail(v as string) : v;
  }
  db.update(schema.fornecedorCadastro).set({ alteracaoPendente: JSON.stringify(limpo) }).where(eq(schema.fornecedorCadastro.id, c.id)).run();
}
