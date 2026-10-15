"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, Clock, Copy, KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { PerfilGerenciado, UsuarioGerenciado } from "@/lib/usuarios/servico";

type Erro = { mensagem: string; campos?: Record<string, string> };
type Resposta<T> = { ok: true; data: T } | { ok: false; erro: Erro };
type Edicao = { id: number | null; nome: string; email: string; perfil: PerfilGerenciado };
type Link = { titulo: string; nome: string; link: string };

const ROTULO_PERFIL: Record<PerfilGerenciado, string> = { compras: "Compras", adm_master: "Adm Master", portaria: "Portaria", armazem: "Gestor de armazém" };

export function Usuarios({ usuarios, meuId }: { usuarios: UsuarioGerenciado[]; meuId: number | null }) {
  const router = useRouter();
  const [ed, setEd] = React.useState<Edicao | null>(null);
  const [erro, setErro] = React.useState<Erro | null>(null);
  const [aviso, setAviso] = React.useState<Erro | null>(null);
  const [link, setLink] = React.useState<Link | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [excluir, setExcluir] = React.useState<UsuarioGerenciado | null>(null);

  async function chamar<T>(url: string, metodo: "POST" | "PUT" | "DELETE", corpo?: unknown): Promise<Resposta<T> | null> {
    setOcupado(true);
    try {
      const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
      return (await r.json()) as Resposta<T>;
    } catch {
      return { ok: false, erro: { mensagem: "Não foi possível falar com o servidor. Tente de novo." } };
    } finally {
      setOcupado(false);
    }
  }

  const abrirLink = (titulo: string, nome: string, caminho: string) => {
    setCopiado(false);
    setLink({ titulo, nome, link: `${window.location.origin}${caminho}` });
  };

  async function salvar() {
    if (!ed) return;
    setErro(null);
    const corpo = { nome: ed.nome, email: ed.email, perfil: ed.perfil };
    if (ed.id === null) {
      const r = await chamar<{ usuario: UsuarioGerenciado; link: string }>("/api/usuarios", "POST", corpo);
      if (!r) return;
      if (!r.ok) return setErro(r.erro);
      setEd(null);
      abrirLink("Conta criada", r.data.usuario.nome, r.data.link);
    } else {
      const r = await chamar<UsuarioGerenciado>(`/api/usuarios/${ed.id}`, "PUT", corpo);
      if (!r) return;
      if (!r.ok) return setErro(r.erro);
      setEd(null);
    }
    router.refresh();
  }

  async function alternar(u: UsuarioGerenciado) {
    setAviso(null);
    const r = await chamar<UsuarioGerenciado>(`/api/usuarios/${u.id}/ativo`, "POST", { ativo: !u.ativo });
    if (r && !r.ok) return setAviso(r.erro);
    router.refresh();
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setAviso(null);
    const r = await chamar<unknown>(`/api/usuarios/${excluir.id}`, "DELETE");
    setExcluir(null);
    if (r && !r.ok) return setAviso(r.erro);
    router.refresh();
  }

  async function redefinir(u: UsuarioGerenciado) {
    setAviso(null);
    const r = await chamar<{ link: string }>(`/api/usuarios/${u.id}/senha`, "POST");
    if (!r) return;
    if (!r.ok) return setAviso(r.erro);
    abrirLink("Link para nova senha", u.nome, r.data.link);
    router.refresh();
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.link);
      setCopiado(true);
    } catch {
      const campo = document.getElementById("link-senha") as HTMLInputElement | null;
      campo?.select();
      setCopiado(false);
    }
  }

  const abertos = usuarios.filter((u) => u.conviteAberto).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {aviso && (
        <Alert variant="destructive" title="Não foi possível concluir">
          {aviso.mensagem}
        </Alert>
      )}
      <div>
        <Button onClick={() => { setErro(null); setEd({ id: null, nome: "", email: "", perfil: "compras" }); }}>
          <Plus /> Nova conta
        </Button>
      </div>
      {abertos > 0 && <p className="text-sm text-muted-foreground">{abertos} conta{abertos > 1 ? "s" : ""} com link de acesso ainda não usado. Gere outro com o botão Nova senha se o prazo vencer.</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.nome}
                {u.id === meuId && <span className="text-muted-foreground"> (você)</span>}
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.perfil === "adm_master" ? "info" : "outline"}>
                  <ShieldCheck /> {ROTULO_PERFIL[u.perfil]}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1.5">
                  {u.ativo ? <Badge variant="success"><CircleCheck /> Ativa</Badge> : <Badge variant="outline"><Ban /> Desativada</Badge>}
                  {u.conviteAberto && <Badge variant="warning"><Clock /> Aguarda definir a senha</Badge>}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center justify-end gap-1">
                  {/* Liga e desliga o acesso, à esquerda das ações. Na própria linha fica travado. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={u.ativo}
                    aria-label={`${u.ativo ? "Desativar" : "Reativar"} ${u.nome}`}
                    title={u.id === meuId ? "Você não pode desativar a própria conta" : u.ativo ? "Desativar" : "Reativar"}
                    disabled={ocupado || u.id === meuId}
                    onClick={() => alternar(u)}
                    className={cn(
                      "relative mr-2 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
                      u.ativo ? "border-success bg-success" : "border-input bg-muted",
                    )}
                  >
                    <span className={cn("absolute left-0.5 size-[18px] rounded-full bg-white shadow-xs transition-transform duration-200 ease-out-expo", u.ativo && "translate-x-5")} />
                  </button>
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => { setErro(null); setEd({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil }); }}>
                    <Pencil /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => redefinir(u)}>
                    <KeyRound /> Nova senha
                  </Button>
                  {/* Ninguém exclui a própria conta: o botão some na sua linha */}
                  {u.id !== meuId && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={ocupado} onClick={() => setExcluir(u)}>
                      <Trash2 /> Excluir
                    </Button>
                  )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={excluir !== null}
        onClose={() => setExcluir(null)}
        title="Excluir esta conta?"
        description={excluir ? `${excluir.nome} (${excluir.email}) perde o acesso para sempre. Conta com histórico no sistema não pode ser excluída: nesse caso, desative.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setExcluir(null)} disabled={ocupado}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} loading={ocupado}>
              <Trash2 /> Excluir conta
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
      </Dialog>

      <Dialog
        open={ed !== null}
        onClose={() => setEd(null)}
        title={ed?.id === null ? "Nova conta" : "Editar conta"}
        description={ed?.id === null ? "Depois de salvar, você recebe um link para a pessoa criar a senha." : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEd(null)} disabled={ocupado}>Cancelar</Button>
            <Button onClick={salvar} loading={ocupado}>Salvar</Button>
          </>
        }
      >
        {ed && (
          <div className="grid gap-4">
            {erro && <Alert variant="destructive" title="Não foi possível salvar">{erro.mensagem}</Alert>}
            <Field label="Nome" required error={erro?.campos?.nome}>
              <Input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
            </Field>
            <Field label="E-mail" required error={erro?.campos?.email}>
              <Input type="email" value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} />
            </Field>
            <Field label="Perfil" required description={
                <span className="flex flex-col">
                  <span>Portaria confere a nota fiscal na chegada.</span>
                  <span>Gestor de armazém confere a nota e opera o dia.</span>
                  <span>Compras valida pedidos e cadastros.</span>
                  <span>Adm Master também gerencia as contas.</span>
                </span>
              } error={erro?.campos?.perfil}>
              <Select value={ed.perfil} onChange={(e) => setEd({ ...ed, perfil: e.target.value as Edicao["perfil"] })}>
                <option value="portaria">Portaria</option>
                <option value="armazem">Gestor de armazém</option>
                <option value="compras">Compras</option>
                <option value="adm_master">Adm Master</option>
              </Select>
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog
        open={link !== null}
        onClose={() => setLink(null)}
        title={link?.titulo ?? ""}
        description={link ? `Envie este link a ${link.nome}. Ele vale por 7 dias e só pode ser usado uma vez.` : undefined}
        footer={<Button onClick={() => setLink(null)}>Fechar</Button>}
      >
        {link && (
          <div className="grid gap-3">
            <Field label="Link de acesso">
              <Input id="link-senha" readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={copiar}>
                <Copy /> Copiar link
              </Button>
              {copiado && <span className="flex items-center gap-1 text-sm text-success" role="status"><CircleCheck className="size-4" /> Link copiado</span>}
            </div>
            <p className="text-[13px] text-muted-foreground">Não há envio de e-mail neste sistema: copie o link e mande por onde preferir.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
