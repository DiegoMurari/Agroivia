/**
 * Gestão de usuários (D49), só para o Adm Master: contas de Compras e de Adm Master.
 * Nunca exclui: desativa e reativa. Sempre há pelo menos um Adm Master ativo.
 * Sem e-mail: primeiro acesso e redefinição devolvem um link /senha/<token> para copiar.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { novoToken, normalizarEmail } from "@/lib/senha";
import { paraISO } from "@/lib/relogio";

export const PERFIS_GERENCIADOS = ["compras", "adm_master", "portaria", "armazem"] as const;

/** Papel gravado ao criar a conta: segue o perfil. */
const PAPEL_DO_PERFIL = { compras: "compras", adm_master: "compras", portaria: "portaria", armazem: "responsavel" } as const;
export type PerfilGerenciado = (typeof PERFIS_GERENCIADOS)[number];

/** Validade do link de primeiro acesso e de redefinição: 7 dias. */
const VALIDADE_LINK_MS = 7 * 24 * 60 * 60 * 1000;

export const esquemaUsuario = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail válido, como nome@agrovia.com.br.").max(200),
  perfil: z.enum(PERFIS_GERENCIADOS, { error: "Escolha o perfil: Compras, Adm Master, Portaria ou Gestor de armazém." }),
});
export type DadosUsuario = z.infer<typeof esquemaUsuario>;

export interface UsuarioGerenciado {
  id: number;
  nome: string;
  email: string;
  perfil: PerfilGerenciado;
  ativo: boolean;
  trocarSenha: boolean;
  /** Há um link de acesso ainda válido, aguardando o usuário definir a senha. */
  conviteAberto: boolean;
}

export interface UsuarioComLink {
  usuario: UsuarioGerenciado;
  token: string;
  link: string;
}

type Linha = typeof schema.usuario.$inferSelect;

function paraGerenciado(l: Linha, agoraISO?: string): UsuarioGerenciado {
  return {
    id: l.id,
    nome: l.nome ?? l.email ?? "",
    email: l.email ?? "",
    perfil: l.perfil as PerfilGerenciado,
    ativo: l.ativo,
    trocarSenha: l.trocarSenha,
    conviteAberto: Boolean(l.tokenSenha && l.tokenSenhaExpira && (!agoraISO || l.tokenSenhaExpira > agoraISO)),
  };
}

const ehGerenciada = (l: Linha) => Boolean(l.email) && (PERFIS_GERENCIADOS as readonly string[]).includes(l.perfil ?? "");

export function listarUsuarios(db: Db, agoraISO?: string): UsuarioGerenciado[] {
  return db
    .select()
    .from(schema.usuario)
    .all()
    .filter(ehGerenciada)
    .map((l) => paraGerenciado(l, agoraISO))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function buscar(db: Db, id: number): Linha {
  const l = db.select().from(schema.usuario).where(eq(schema.usuario.id, id)).get();
  if (!l || !ehGerenciada(l)) throw new ErroDeRegra("Usuário não encontrado. Recarregue a página e tente de novo.", { status: 404 });
  return l;
}

function checarEmail(db: Db, email: string, ignorarId: number | null) {
  const outro = db.select().from(schema.usuario).all().find((u) => u.id !== ignorarId && (u.email ?? "").toLowerCase() === email);
  if (outro) throw new ErroDeRegra(`O e-mail ${email} já tem uma conta. Use outro e-mail ou edite a conta existente.`, { campos: { email: "E-mail já usado." } });
}

/** Quantos Adm Master ativos existem, sem contar o usuário `exceto`. */
function outrosAdmsAtivos(db: Db, exceto: number): number {
  return db.select().from(schema.usuario).all().filter((u) => u.id !== exceto && u.perfil === "adm_master" && u.ativo && u.email).length;
}

function novoLink(agoraISO: string): { token: string; expira: string } {
  return { token: novoToken(), expira: paraISO(new Date(new Date(agoraISO).getTime() + VALIDADE_LINK_MS)) };
}

export function criarUsuario(db: Db, bruto: DadosUsuario, agoraISO: string): UsuarioComLink {
  const v = esquemaUsuario.safeParse(bruto);
  if (!v.success) throw new ErroDeRegra(v.error.issues[0]?.message ?? "Dados inválidos.", { status: 400 });
  const email = normalizarEmail(v.data.email);
  return db.transaction(
    (tx) => {
      checarEmail(tx as unknown as Db, email, null);
      const { token, expira } = novoLink(agoraISO);
      const linha = tx
        .insert(schema.usuario)
        .values({ nome: v.data.nome, papel: PAPEL_DO_PERFIL[v.data.perfil], email, perfil: v.data.perfil, ativo: true, trocarSenha: true, tokenSenha: token, tokenSenhaExpira: expira, criadoEm: agoraISO })
        .returning()
        .get();
      return { usuario: paraGerenciado(linha, agoraISO), token, link: `/senha/${token}` };
    },
    { behavior: "immediate" },
  );
}

export function editarUsuario(db: Db, id: number, bruto: DadosUsuario, agoraISO?: string): UsuarioGerenciado {
  const v = esquemaUsuario.safeParse(bruto);
  if (!v.success) throw new ErroDeRegra(v.error.issues[0]?.message ?? "Dados inválidos.", { status: 400 });
  const email = normalizarEmail(v.data.email);
  return db.transaction(
    (tx) => {
      const atual = buscar(tx as unknown as Db, id);
      checarEmail(tx as unknown as Db, email, id);
      if (atual.perfil === "adm_master" && v.data.perfil !== "adm_master" && atual.ativo && outrosAdmsAtivos(tx as unknown as Db, id) === 0) {
        throw new ErroDeRegra("Este é o último Adm Master ativo e não pode virar Compras. Torne outra conta Adm Master antes.", { campos: { perfil: "Último Adm Master." } });
      }
      return paraGerenciado(tx.update(schema.usuario).set({ nome: v.data.nome, email, perfil: v.data.perfil }).where(eq(schema.usuario.id, id)).returning().get(), agoraISO);
    },
    { behavior: "immediate" },
  );
}

function definirAtivo(db: Db, id: number, ativo: boolean, porUsuarioId?: number): UsuarioGerenciado {
  return db.transaction(
    (tx) => {
      if (!ativo && porUsuarioId === id) {
        throw new ErroDeRegra("Você não pode desativar a própria conta. Peça a outro Adm Master.", { status: 409, campos: { ativo: "Conta própria." } });
      }
      const atual = buscar(tx as unknown as Db, id);
      if (!ativo && atual.perfil === "adm_master" && atual.ativo && outrosAdmsAtivos(tx as unknown as Db, id) === 0) {
        throw new ErroDeRegra("Este é o último Adm Master ativo e não pode ser desativado. Torne outra conta Adm Master antes.", { campos: { ativo: "Último Adm Master." } });
      }
      return paraGerenciado(tx.update(schema.usuario).set({ ativo }).where(eq(schema.usuario.id, id)).returning().get());
    },
    { behavior: "immediate" },
  );
}

/** `porUsuarioId` é quem pede: ninguém desativa a própria conta. */
export const desativarUsuario = (db: Db, id: number, porUsuarioId?: number) => definirAtivo(db, id, false, porUsuarioId);
export const reativarUsuario = (db: Db, id: number) => definirAtivo(db, id, true);

/**
 * Exclui a conta de vez. Não vale para a própria conta nem para o último Adm Master ativo.
 * Conta com histórico (decidiu pedido ou cadastro, criou convite, aprovou algo) não é excluída: apagar levaria junto a auditoria.
 */
export function excluirUsuario(db: Db, id: number, porUsuarioId: number): void {
  if (porUsuarioId === id) throw new ErroDeRegra("Você não pode excluir a própria conta. Peça a outro Adm Master.", { status: 409 });
  db.transaction(
    (tx) => {
      const atual = buscar(tx as unknown as Db, id);
      if (atual.perfil === "adm_master" && atual.ativo && outrosAdmsAtivos(tx as unknown as Db, id) === 0) {
        throw new ErroDeRegra("Este é o último Adm Master ativo e não pode ser excluído. Torne outra conta Adm Master antes.", { status: 409 });
      }
      try {
        tx.delete(schema.usuario).where(eq(schema.usuario.id, id)).run();
      } catch (e) {
        if (e instanceof Error && /FOREIGN KEY/i.test(e.message)) {
          throw new ErroDeRegra("Esta conta tem histórico no sistema (decisões, convites ou pedidos). Excluir apagaria a auditoria: desative a conta em vez de excluir.", { status: 409 });
        }
        throw e;
      }
    },
    { behavior: "immediate" },
  );
}

/** Gera um link novo de definição de senha. A senha atual continua valendo até o usuário definir a nova. */
export function redefinirSenha(db: Db, id: number, agoraISO: string): UsuarioComLink {
  return db.transaction(
    (tx) => {
      buscar(tx as unknown as Db, id);
      const { token, expira } = novoLink(agoraISO);
      const linha = tx.update(schema.usuario).set({ trocarSenha: true, tokenSenha: token, tokenSenhaExpira: expira }).where(eq(schema.usuario.id, id)).returning().get();
      return { usuario: paraGerenciado(linha, agoraISO), token, link: `/senha/${token}` };
    },
    { behavior: "immediate" },
  );
}
