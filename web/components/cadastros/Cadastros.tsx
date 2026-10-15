"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CircleCheck, CircleOff, Forklift, Package, Pencil, Plus, Tractor, Wrench } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

interface Armazem { id: number; nome: string; localFisico: string | null; fazBoletim: boolean; recebeDescarga: boolean; ativo: boolean }
interface Equipamento { id: number; armazemId: number; armazemNome: string; nome: string | null; finalidade: string | null; quantidade: number; disponivel: number; indisponivelMotivo: string | null; status: string }
interface Chapa { id: number; matricula: string; nome: string; armazemId: number | null; ativo: boolean }

interface Props {
  armazens: Armazem[];
  equipamentos: Equipamento[];
  chapas: Chapa[];
  consulta: {
    horarios: { hora: string; ativo: boolean }[];
    feriados: { data: string; nome: string | null }[];
    parametros: { chave: string; valor: string; descricao: string | null }[];
  };
}

type Tipo = "equipamentos" | "chapas";
type Form = Record<string, string | boolean>;
type Edicao = { tipo: Tipo; id: number | null; form: Form };

const TITULO: Record<Tipo, string> = { equipamentos: "equipamento", chapas: "chapa" };

function iconeDoEquipamento(nome: string | null) {
  const n = (nome ?? "").toLowerCase();
  if (n.includes("trator")) return Tractor;
  if (n.includes("empilhadeira") || n.includes("paleteira") || n.includes("transpaleteira")) return Forklift;
  return Package;
}

function Ativo({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <Badge variant="success"><CircleCheck /> Ativo</Badge>
  ) : (
    <Badge variant="outline"><CircleOff /> Inativo</Badge>
  );
}

export function Cadastros({ armazens, equipamentos, chapas, consulta }: Props) {
  const router = useRouter();
  const [ed, setEd] = React.useState<Edicao | null>(null);
  const [erro, setErro] = React.useState<{ mensagem: string; campos?: Record<string, string> } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const abrir = (e: Edicao) => {
    setErro(null);
    setEd(e);
  };
  const campo = (k: string, v: string | boolean) => setEd((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  function corpo(e: Edicao) {
    const f = e.form;
    const texto = (k: string) => String(f[k] ?? "");
    if (e.tipo === "equipamentos") {
      return {
        armazemId: Number(texto("armazemId")),
        nome: texto("nome"),
        finalidade: texto("finalidade"),
        quantidade: Number(texto("quantidade") || "0"),
        disponivel: Number(texto("disponivel") || "0"),
        indisponivelMotivo: texto("indisponivelMotivo"),
        status: texto("status") || "operacional",
      };
    }
    return { matricula: texto("matricula"), nome: texto("nome"), armazemId: texto("armazemId") ? Number(texto("armazemId")) : null, ativo: Boolean(f.ativo) };
  }

  async function salvar() {
    if (!ed) return;
    setOcupado(true);
    setErro(null);
    try {
      const url = ed.id === null ? `/api/cadastros/${ed.tipo}` : `/api/cadastros/${ed.tipo}/${ed.id}`;
      const r = await fetch(url, { method: ed.id === null ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo(ed)) });
      const json = (await r.json()) as { ok: boolean; erro?: { mensagem: string; campos?: Record<string, string> } };
      if (json.ok) {
        setEd(null);
        router.refresh();
      } else setErro(json.erro ?? { mensagem: "Não foi possível salvar." });
    } catch {
      setErro({ mensagem: "Não foi possível falar com o servidor. Tente de novo." });
    } finally {
      setOcupado(false);
    }
  }

  const novo = (tipo: Tipo, form: Form) => (
    <Button onClick={() => abrir({ tipo, id: null, form })}>
      <Plus /> Novo {TITULO[tipo]}
    </Button>
  );
  const editar = (tipo: Tipo, id: number, form: Form) => (
    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${TITULO[tipo]}`} onClick={() => abrir({ tipo, id, form })}>
      <Pencil />
    </Button>
  );
  const erroDe = (k: string) => erro?.campos?.[k];
  const f = ed?.form ?? {};
  const armazemOpcoes = armazens.map((a) => (
    <option key={a.id} value={a.id}>
      {a.nome}
    </option>
  ));

  const emManutencao = equipamentos.filter((e) => e.status === "manutencao").length;

  return (
    <>
      {emManutencao > 0 && (
        <Alert variant="warning" title={emManutencao === 1 ? "1 equipamento em manutenção" : `${emManutencao} equipamentos em manutenção`} className="mb-4">
          Eles aparecem no topo da lista de equipamentos e não contam como disponíveis na Tela do Dia.
        </Alert>
      )}
      <Tabs defaultValue="equipamentos">
        <TabsList aria-label="Cadastros">
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="chapas">Funcionários</TabsTrigger>
          <TabsTrigger value="consulta">Grade, feriados e parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="equipamentos" className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-4">
          <div>
            <Button asChild>
              <Link href="/cadastros/equipamentos/novo">
                <Plus /> Novo equipamento
              </Link>
            </Button>
          </div>
          {armazens
            .filter((a) => equipamentos.some((e) => e.armazemId === a.id))
            .map((a) => (
              <section key={a.id} aria-label={a.nome} className="grid gap-3">
                <h2 className="text-h3 text-brand">
                  {a.nome} <span className="text-sm font-normal text-muted-foreground">{equipamentos.filter((e) => e.armazemId === a.id).length} equipamentos</span>
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {equipamentos
                    .filter((e) => e.armazemId === a.id)
                    .map((e) => {
                      const Icone = iconeDoEquipamento(e.nome);
                      const parado = e.status === "manutencao";
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/cadastros/equipamentos/${e.id}`}
                            className={`group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-card transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-ring ${parado ? "border-warning/50" : ""}`}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className={`grid size-11 place-items-center rounded-full ${parado ? "bg-warning/10 text-warning" : "bg-brand/10 text-brand"}`}>
                                <Icone className="size-5" aria-hidden="true" />
                              </span>
                              {parado ? (
                                <Badge variant="warning"><Wrench /> Em manutenção</Badge>
                              ) : (
                                <Badge variant="success"><CircleCheck /> Operacional</Badge>
                              )}
                            </span>
                            <span className="font-semibold break-words">{e.nome}</span>
                            <span className="text-sm text-muted-foreground">{e.finalidade ?? "Sem finalidade informada"}</span>
                            {parado && e.indisponivelMotivo && <span className="text-sm text-warning">{e.indisponivelMotivo}</span>}
                            <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-brand">
                              Abrir <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
        </TabsContent>

        <TabsContent value="chapas" className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-4">
          <div>{novo("chapas", { matricula: "", nome: "", armazemId: "", ativo: true })}</div>
          <Table>
            <TableHeader><TableRow><TableHead>Matrícula</TableHead><TableHead>Nome</TableHead><TableHead>Lotação</TableHead><TableHead>Situação</TableHead><TableHead className="relative w-12"><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {chapas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums font-medium">{c.matricula}</TableCell>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell>{armazens.find((a) => a.id === c.armazemId)?.nome ?? "Sem lotação"}</TableCell>
                  <TableCell><Ativo ativo={c.ativo} /></TableCell>
                  <TableCell>{editar("chapas", c.id, { matricula: c.matricula, nome: c.nome, armazemId: c.armazemId ? String(c.armazemId) : "", ativo: c.ativo })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="consulta" className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-4">
          <section>
            <h2 className="mb-2 text-h3">Horários de recebimento</h2>
            <p className="text-sm text-muted-foreground">{consulta.horarios.map((h) => `${h.hora}${h.ativo ? "" : " (inativo)"}`).join(", ")}</p>
          </section>
          <section>
            <h2 className="mb-2 text-h3">Feriados</h2>
            <ul className="text-sm text-muted-foreground">
              {consulta.feriados.map((x) => <li key={x.data}>{x.data.split("-").reverse().join("/")}: {x.nome}</li>)}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-h3">Parâmetros</h2>
            <Table>
              <TableHeader><TableRow><TableHead>Chave</TableHead><TableHead>Valor</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
              <TableBody>
                {consulta.parametros.map((p) => (
                  <TableRow key={p.chave}><TableCell className="font-mono text-[13px]">{p.chave}</TableCell><TableCell className="tabular-nums">{p.valor}</TableCell><TableCell>{p.descricao}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog
        open={ed !== null}
        onClose={() => setEd(null)}
        title={ed ? `${ed.id === null ? "Novo" : "Editar"} ${TITULO[ed.tipo]}` : ""}
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
            {ed.tipo === "chapas" && (
              <>
                <Field label="Matrícula" required error={erroDe("matricula")}><Input value={String(f.matricula)} onChange={(e) => campo("matricula", e.target.value)} /></Field>
                <Field label="Nome" required error={erroDe("nome")}><Input value={String(f.nome)} onChange={(e) => campo("nome", e.target.value)} /></Field>
                <Field label="Lotação"><Select value={String(f.armazemId)} onChange={(e) => campo("armazemId", e.target.value)}><option value="">Sem lotação</option>{armazemOpcoes}</Select></Field>
                <Checkbox label="Ativo" checked={Boolean(f.ativo)} onChange={(e) => campo("ativo", e.target.checked)} />
              </>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
