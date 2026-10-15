"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { chaveDoNome, nomeLimpo } from "@/lib/equipes/nomes";
import { cn } from "@/lib/utils";

type Tipo = "completa" | "meia";
interface ChapaNova {
  nome: string;
  tipo: Tipo;
}

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Dia da escala. */
  data: string;
  armazens: { id: number; nome: string }[];
  /** Horários fixos da grade (08:00, 10:00...). */
  horarios: string[];
  /** Nomes já salvos, os mais escalados primeiro. */
  salvos: string[];
  /** Chaves (sem acento e maiúscula) de quem já está em alguma equipe do dia. */
  escalados: Set<string>;
  /** Quantas equipes o dia já tem: sugere o nome da próxima. */
  quantas: number;
  aoCriada: () => void;
}

async function enviar<T>(url: string, corpo: unknown): Promise<{ ok: true; data: T } | { ok: false; erro: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = (await r.json()) as { ok: boolean; data?: T; erro?: { mensagem: string } };
    return j.ok ? { ok: true, data: j.data as T } : { ok: false, erro: j.erro?.mensagem ?? "Não foi possível salvar." };
  } catch {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
}

/** Janela de preenchimento: dados da equipe e as chapas, tudo antes de criar o cartão. */
export function NovaEquipe({ aberto, aoFechar, data, armazens, horarios, salvos, escalados, quantas, aoCriada }: Props) {
  // A tela remonta a janela a cada abertura (key), então ela sempre começa em branco
  const [f, setF] = React.useState({ nome: "", armazemId: "", tarefa: "", horario: "" });
  const [chapas, setChapas] = React.useState<ChapaNova[]>([]);
  const [novoNome, setNovoNome] = React.useState("");
  const [novoTipo, setNovoTipo] = React.useState<Tipo>("completa");
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const naLista = (nome: string) => chapas.some((c) => chaveDoNome(c.nome) === chaveDoNome(nome));
  const livres = salvos.filter((s) => !escalados.has(chaveDoNome(s)));

  function alternar(nome: string) {
    setChapas((l) => (naLista(nome) ? l.filter((c) => chaveDoNome(c.nome) !== chaveDoNome(nome)) : [...l, { nome, tipo: "completa" }]));
  }

  function adicionarNovo() {
    const nome = nomeLimpo(novoNome);
    if (chaveDoNome(nome).length < 2) return setErro("Escreva o nome do funcionário.");
    if (escalados.has(chaveDoNome(nome))) return setErro(`${nome} já está em outra equipe neste dia.`);
    if (naLista(nome)) return setErro(`${nome} já está nesta equipe.`);
    setChapas((l) => [...l, { nome, tipo: novoTipo }]);
    setNovoNome("");
    setErro(null);
  }

  async function criar(ev: React.FormEvent) {
    ev.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const nome = f.nome.trim() || `Equipe ${quantas + 1}`;
    const equipe = await enviar<{ id: number }>("/api/equipes", {
      data,
      nome,
      armazemId: f.armazemId ? Number(f.armazemId) : null,
      tarefa: f.tarefa,
      horarioInicio: f.horario,
      horarioFim: "",
    });
    if (!equipe.ok) {
      setSalvando(false);
      return setErro(equipe.erro);
    }
    const falhas: string[] = [];
    for (const c of chapas) {
      const r = await enviar(`/api/equipes/${equipe.data.id}/chapas`, { nome: c.nome, tipo: c.tipo });
      if (!r.ok) falhas.push(r.erro);
    }
    setSalvando(false);
    aoCriada();
    if (falhas.length > 0) return setErro(`A equipe foi criada, mas: ${falhas.join(" ")}`);
    aoFechar();
  }

  return (
    <Dialog
      open={aberto}
      onClose={aoFechar}
      title="Nova equipe"
      description="Preencha os dados e os funcionários. O horário é opcional."
      className="w-full max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nova-equipe" loading={salvando}>
            <Plus /> Criar equipe
          </Button>
        </>
      }
    >
      <form id="form-nova-equipe" onSubmit={criar} className="grid gap-4">
        {erro && (
          <Alert variant="destructive" title="Confira">
            {erro}
          </Alert>
        )}
        <Field label="Nome da equipe">
          <Input placeholder={`Equipe ${quantas + 1}`} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={60} autoComplete="off" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Armazém">
            <Select value={f.armazemId} onChange={(e) => setF({ ...f, armazemId: e.target.value })}>
              <option value="">Sem armazém</option>
              {armazens.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tarefa (opcional)">
            <Input value={f.tarefa} onChange={(e) => setF({ ...f, tarefa: e.target.value })} maxLength={200} autoComplete="off" />
          </Field>
          <Field label="Horário (opcional)">
            <Select value={f.horario} onChange={(e) => setF({ ...f, horario: e.target.value })}>
              <option value="">Sem horário (o dia todo)</option>
              {horarios.map((h) => (
                <option key={h} value={h}>
                  {h.replace(":00", "h00")}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Chapas {chapas.length > 0 && <span className="font-normal text-muted-foreground">({chapas.length})</span>}</legend>

          {livres.length > 0 && (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border bg-muted/40 p-2" role="group" aria-label="Funcionários já salvas">
              {livres.map((nome) => {
                const marcada = naLista(nome);
                return (
                  <button
                    key={nome}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => alternar(nome)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      marcada ? "border-brand bg-brand text-brand-foreground" : "bg-card hover:bg-accent",
                    )}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <Input
              aria-label="Nome de um funcionário novo"
              placeholder="Nome de um funcionário novo"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarNovo();
                }
              }}
              maxLength={80}
              autoComplete="off"
            />
            <Select aria-label="Meia ou diária inteira" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as Tipo)}>
              <option value="completa">Inteira</option>
              <option value="meia">Meia</option>
            </Select>
            <Button type="button" variant="outline" onClick={adicionarNovo}>
              <Plus /> Adicionar
            </Button>
          </div>

          {chapas.length > 0 && (
            <ol className="grid max-h-40 gap-1 overflow-y-auto">
              {chapas.map((c, i) => (
                <li key={c.nome} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-1.5 text-sm">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
                  <button
                    type="button"
                    aria-label={`${c.nome}: ${c.tipo === "meia" ? "meia diária" : "diária inteira"}. Trocar`}
                    onClick={() => setChapas((l) => l.map((x) => (x.nome === c.nome ? { ...x, tipo: x.tipo === "meia" ? "completa" : "meia" } : x)))}
                    className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring", c.tipo === "meia" ? "border-brand/40 bg-brand/10 text-brand" : "bg-muted text-muted-foreground hover:bg-accent")}
                  >
                    {c.tipo === "meia" ? "Meia" : "Inteira"}
                  </button>
                  <button type="button" aria-label={`Tirar ${c.nome}`} onClick={() => setChapas((l) => l.filter((x) => x.nome !== c.nome))} className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}
