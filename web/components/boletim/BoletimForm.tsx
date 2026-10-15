"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Lock, Plus, Printer, TriangleAlert, Trash2, Unlock, Users } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { calcularBoletim, ErroBoletim, type ResultadoBoletim } from "@/lib/boletim/calculo";
import { decBR, formatNumero } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface TipoForm {
  id: number;
  nome: string;
  preco: string;
  categoria: string;
}

export interface BoletimInicial {
  id: number;
  armazemId: number;
  data: string;
  status: "rascunho" | "fechado";
  observacao: string | null;
  linhas: { tipoItemId: number; qtdDescarga: string; qtdRemocao: string; qtdTransferencia: string }[];
  equipe: { matricula: string; tipo: "completa" | "meia" }[];
}

interface Props {
  armazens: { id: number; nome: string }[];
  tipos: TipoForm[];
  chapas: { matricula: string; nome: string }[];
  hoje: string;
  inicial?: BoletimInicial;
  /** Parâmetros lidos do banco no servidor, os mesmos que o servidor usa ao salvar. */
  parametros: { piso: string; fatorMeia: string; maxChapas: number };
}

type Qtd = { d: string; r: string; t: string };
type Equipe = { matricula: string; tipo: "completa" | "meia" };
type EquipeDoDia = { id: number; nome: string; armazemId: number | null; membros: { matricula: string; nome: string; tipo: "completa" | "meia" }[] };
type Resposta = { ok: true; data: { id: number } } | { ok: false; erro: { mensagem: string; campos?: Record<string, string> } };

const texto = (v: string) => (v === "0" ? "" : v);

export function BoletimForm({ armazens, tipos, chapas, hoje, inicial, parametros }: Props) {
  const router = useRouter();
  const fechado = inicial?.status === "fechado";
  // Nomes digitados aqui viram chapa cadastrada na hora (D55) e entram na lista de sugestões
  const [lista, setLista] = React.useState(chapas);
  const nomePorMatricula = React.useMemo(() => new Map(lista.map((c) => [c.matricula, c.nome])), [lista]);

  const [armazemId, setArmazemId] = React.useState<number>(inicial?.armazemId ?? armazens[0]?.id ?? 0);
  const [data, setData] = React.useState(inicial?.data ?? hoje);
  const [qtds, setQtds] = React.useState<Record<number, Qtd>>(() => {
    const m: Record<number, Qtd> = {};
    for (const l of inicial?.linhas ?? []) m[l.tipoItemId] = { d: texto(l.qtdDescarga), r: texto(l.qtdRemocao), t: texto(l.qtdTransferencia) };
    return m;
  });
  const [equipe, setEquipe] = React.useState<Equipe[]>(inicial?.equipe ?? []);
  const [observacao, setObservacao] = React.useState(inicial?.observacao ?? "");
  const [erroNova, setErroNova] = React.useState("");
  const [erro, setErro] = React.useState<{ mensagem: string; campos?: Record<string, string> } | null>(null);
  const [aviso, setAviso] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [equipesDoDia, setEquipesDoDia] = React.useState<EquipeDoDia[]>([]);
  const [escolhida, setEscolhida] = React.useState("");
  // As linhas raras ficam recolhidas, a menos que já tenham quantidade
  const [outrasAbertas, setOutrasAbertas] = React.useState(() => (inicial?.linhas ?? []).some((l) => tipos.some((t) => t.id === l.tipoItemId && (t.categoria === "diaria" || t.nome.startsWith("Sacaria")))));

  const itens = tipos.filter((t) => t.categoria === "item" && !t.nome.startsWith("Sacaria"));
  const naoUsadas = tipos.filter((t) => t.categoria === "item" && t.nome.startsWith("Sacaria"));
  const diarias = tipos.filter((t) => t.categoria === "diaria");

  const get = (id: number): Qtd => qtds[id] ?? { d: "", r: "", t: "" };
  const set = (id: number, campo: keyof Qtd, valor: string) => setQtds((q) => ({ ...q, [id]: { ...get(id), ...q[id], [campo]: valor } }));

  // Resumo ao vivo: a mesma função que o servidor usa ao salvar.
  const { resultado, problema, errosQtd } = React.useMemo(() => {
    const errosQtd: Record<string, string> = {};
    const linhas: { preco: string; descarga: string; remocao: string; transferencia: string }[] = [];
    for (const t of tipos) {
      const q = qtds[t.id];
      if (!q) continue;
      const conv = (campo: keyof Qtd): string => {
        const bruto = q[campo].trim();
        if (!bruto) return "0";
        try {
          const v = decBR(bruto);
          if (v.isNegative()) throw new Error("negativo");
          return v.toFixed();
        } catch {
          errosQtd[`${t.id}.${campo}`] = "Número inválido. Use só dígitos e vírgula, sem negativo.";
          return "0";
        }
      };
      linhas.push({ preco: t.preco, descarga: conv("d"), remocao: conv("r"), transferencia: conv("t") });
    }
    let resultado: ResultadoBoletim | null = null;
    let problema = "";
    try {
      resultado = calcularBoletim({ linhas, equipe, parametros });
    } catch (e) {
      if (e instanceof ErroBoletim) problema = e.message;
      else throw e;
    }
    if (Object.keys(errosQtd).length > 0) resultado = null;
    return { resultado, problema, errosQtd };
  }, [qtds, equipe, tipos, parametros]);

  /** Equipes montadas na Escala para o dia: o boletim traz a equipe inteira, com meia ou inteira de cada chapa. */
  React.useEffect(() => {
    if (fechado) return;
    let vivo = true;
    fetch(`/api/equipes?data=${data}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data?: { equipes: EquipeDoDia[] } }>)
      .then((j) => {
        if (!vivo) return;
        const lista = j.data?.equipes ?? [];
        setEquipesDoDia(lista);
        setEscolhida((atual) => (lista.some((e) => String(e.id) === atual) ? atual : String(lista.find((e) => e.armazemId === armazemId)?.id ?? lista[0]?.id ?? "")));
      })
      .catch(() => vivo && setEquipesDoDia([]));
    return () => {
      vivo = false;
    };
  }, [data, armazemId, fechado]);

  function trazerEquipe() {
    const e = equipesDoDia.find((x) => String(x.id) === escolhida);
    if (!e) return;
    const novos = e.membros.filter((m) => !equipe.some((x) => x.matricula === m.matricula));
    const cabem = parametros.maxChapas - equipe.length;
    if (novos.length === 0) return setErroNova(`Todas os funcionários de ${e.nome} já estão no boletim.`);
    setLista((l) => [...l, ...novos.filter((m) => !l.some((x) => x.matricula === m.matricula)).map(({ matricula, nome }) => ({ matricula, nome }))]);
    setEquipe((eq) => [...eq, ...novos.slice(0, Math.max(0, cabem)).map((m) => ({ matricula: m.matricula, tipo: m.tipo }))]);
    setErroNova(novos.length > cabem ? `O boletim aceita no máximo ${parametros.maxChapas} funcionários: entraram só as primeiras de ${e.nome}.` : "");
  }

  function corpo() {
    return {
      armazemId,
      data,
      observacao: observacao || null,
      linhas: tipos
        .filter((t) => qtds[t.id] && (qtds[t.id].d.trim() || qtds[t.id].r.trim() || qtds[t.id].t.trim()))
        .map((t) => ({ tipoItemId: t.id, descarga: qtds[t.id].d, remocao: qtds[t.id].r, transferencia: qtds[t.id].t })),
      equipe,
    };
  }

  async function chamar(url: string, metodo: "POST" | "PUT", body?: unknown): Promise<Resposta | null> {
    setOcupado(true);
    setErro(null);
    setAviso("");
    try {
      const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const json = (await r.json()) as Resposta;
      if (!json.ok) setErro(json.erro);
      return json;
    } catch {
      setErro({ mensagem: "Não foi possível falar com o servidor. Confira se ele está no ar e tente de novo." });
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    const r = inicial ? await chamar(`/api/boletim/${inicial.id}`, "PUT", corpo()) : await chamar("/api/boletim", "POST", corpo());
    if (!r?.ok) return;
    if (inicial) {
      setAviso("Boletim salvo. Os valores foram recalculados pelo servidor.");
      router.refresh();
    } else {
      router.push(`/boletim/${r.data.id}`);
    }
  }

  async function mudar(acao: "fechar" | "reabrir") {
    if (!inicial) return;
    const r = await chamar(`/api/boletim/${inicial.id}/${acao}`, "POST");
    if (r?.ok) router.refresh();
  }

  const campoErro = (k: string) => erro?.campos?.[k];
  const bloqueado = fechado || ocupado;

  const compacta = "[&_td]:py-1 [&_th]:h-8 [&_th]:py-1";
  const caixa = "rounded-xl border bg-card p-4 shadow-card";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-14 lg:h-[calc(100dvh-12.5rem)] lg:min-h-[26rem] lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0 print:block print:h-auto print:space-y-4">
      <div className="flex min-h-0 flex-col gap-3 lg:h-full">
        {fechado && (
          <Alert variant="info" title="Boletim fechado">
            Para corrigir, reabra o boletim. Ao salvar de novo, os valores são recalculados.
          </Alert>
        )}
        {erro && (
          <Alert variant="destructive" title="Não foi possível salvar">
            {erro.mensagem}
          </Alert>
        )}
        {aviso && (
          <Alert variant="success" title="Salvo">
            {aviso}
          </Alert>
        )}

        <section className={cn(caixa, "grid shrink-0 gap-3 sm:grid-cols-2")} aria-label="Armazém e dia">
          <Field label="Armazém" required error={campoErro("armazemId")}>
            <Select size="sm" value={armazemId} onChange={(e) => setArmazemId(Number(e.target.value))} disabled={bloqueado}>
              {armazens.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data" required error={campoErro("data")}>
            <Input size="sm" type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={bloqueado} />
          </Field>
        </section>

        <section className={cn(caixa, "flex min-h-0 flex-col gap-2 lg:flex-1")} aria-label="Produção do dia">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="text-h3 text-brand">Produção do dia</h2>
            <p className="text-xs text-muted-foreground">Descarga: o que chegou. Remoção: dentro do armazém. Transferência: envio aos núcleos.</p>
          </div>
          <div className={cn(compacta, "min-h-0 overflow-y-auto")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead className="text-right">Descarga</TableHead>
                  <TableHead className="text-right">Remoção</TableHead>
                  <TableHead className="text-right">Transferência</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((t) => (
                  <LinhaQtd key={t.id} tipo={t} q={get(t.id)} erros={errosQtd} set={set} desabilitado={bloqueado} resultado={resultado} indice={indiceDe(tipos, qtds, t.id)} />
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {(diarias.length > 0 || naoUsadas.length > 0) && (
          <details className="shrink-0 rounded-xl border bg-card shadow-card" open={outrasAbertas} onToggle={(e) => setOutrasAbertas(e.currentTarget.open)}>
            <summary className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-brand focus-visible:outline-2 focus-visible:outline-ring">Outras linhas: diária e sacaria (raramente usadas)</summary>
            <div className={cn("grid gap-3 px-4 pb-3", compacta)}>
              {diarias.length > 0 && (
                <Table>
                  <TableBody>
                    {diarias.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          {t.nome} <span className="text-muted-foreground">(R$ {formatNumero(t.preco, 4)})</span>
                        </TableCell>
                        <TableCell className="w-36">
                          <Input
                            size="sm"
                            inputMode="decimal"
                            aria-label={`Quantidade de ${t.nome}`}
                            aria-invalid={Boolean(errosQtd[`${t.id}.d`])}
                            className="text-right tabular-nums"
                            value={get(t.id).d}
                            onChange={(e) => set(t.id, "d", e.target.value)}
                            disabled={bloqueado}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{valorDaLinha(tipos, qtds, t.id, resultado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {naoUsadas.length > 0 && (
                <Table>
                  <TableBody>
                    {naoUsadas.map((t) => (
                      <LinhaQtd key={t.id} tipo={t} q={get(t.id)} erros={errosQtd} set={set} desabilitado={bloqueado} resultado={resultado} indice={indiceDe(tipos, qtds, t.id)} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </details>
        )}
      </div>

      {resultado && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-2 text-sm shadow-elevated lg:hidden print:hidden" aria-hidden="true">
          <span>
            Total <span className="font-semibold tabular-nums">R$ {formatNumero(resultado.totalAPagar)}</span>
          </span>
          <span>
            Complemento <span className="font-semibold tabular-nums">R$ {formatNumero(resultado.complemento)}</span>
          </span>
        </div>
      )}

      <aside className="flex min-h-0 flex-col gap-3 lg:h-full print:static" aria-live="polite">
        <section className={cn(caixa, "flex min-h-0 flex-col gap-2 lg:flex-1")} aria-label="Equipe do dia">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-h3 text-brand">Equipe do dia</h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {equipe.length} de {parametros.maxChapas}
            </p>
          </div>
          {!fechado && (
            <div className="grid gap-1.5 print:hidden">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Select size="sm" aria-label="Equipe da escala" value={escolhida} onChange={(ev) => setEscolhida(ev.target.value)} disabled={ocupado || equipesDoDia.length === 0}>
                  {equipesDoDia.length === 0 && <option value="">Nenhuma equipe montada neste dia</option>}
                  {equipesDoDia.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} ({e.membros.length} {e.membros.length === 1 ? "funcionário" : "funcionários"})
                    </option>
                  ))}
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={trazerEquipe} disabled={ocupado || !escolhida}>
                  <Users /> Trazer
                </Button>
              </div>
              <Link href={`/equipes?data=${data}`} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                <Plus className="size-4" aria-hidden="true" /> Nova equipe
              </Link>
              {erroNova && <p className="text-[13px] font-medium text-destructive">{erroNova}</p>}
            </div>
          )}
          {campoErro("equipe") && <p className="text-[13px] font-medium text-destructive">{campoErro("equipe")}</p>}
          {equipe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum funcionário na equipe. O boletim precisa de pelo menos 1.</p>
          ) : (
            <ul className="max-h-48 min-h-0 divide-y divide-border overflow-y-auto rounded-md border border-border lg:max-h-none print:max-h-none">
              {equipe.map((e, i) => (
                <li key={e.matricula} className="flex items-center justify-between gap-2 px-2.5 py-1">
                  <span className="min-w-0 truncate text-sm font-medium">{nomePorMatricula.get(e.matricula) ?? e.matricula}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Checkbox
                      label="Meia"
                      checked={e.tipo === "meia"}
                      disabled={bloqueado}
                      onChange={(ev) => setEquipe(equipe.map((x, j) => (j === i ? { ...x, tipo: ev.target.checked ? "meia" : "completa" } : x)))}
                    />
                    {!fechado && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Tirar o funcionário ${e.matricula}`} onClick={() => setEquipe(equipe.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn(caixa, "grid shrink-0 gap-2 text-sm")} aria-label="Resumo">
          <h2 className="text-h3 text-brand">Resumo</h2>
          {problema && <p className="text-muted-foreground">{problema}</p>}
          {resultado ? (
            <>
              <div className="grid gap-1">
                <Linha rotulo="Produção total" valor={`R$ ${formatNumero(resultado.producaoTotal)}`} />
                <Linha rotulo="Diárias equivalentes" valor={formatNumero(resultado.diariasEquivalentes)} />
                <Linha rotulo="Valor por diária" valor={`R$ ${formatNumero(resultado.valorPorDiaria)}`} />
                <Linha rotulo="Total a pagar" valor={`R$ ${formatNumero(resultado.totalAPagar)}`} forte />
                <Linha rotulo="Complemento" valor={`R$ ${formatNumero(resultado.complemento)}`} forte />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {resultado.abaixoDoPiso ? (
                  <Badge variant="warning">
                    <TriangleAlert /> Abaixo do piso
                  </Badge>
                ) : (
                  <Badge variant="success">
                    <CircleCheck /> Acima do piso
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">Piso: R$ {formatNumero(parametros.piso, 4)} por diária.</span>
              </div>
            </>
          ) : (
            !problema && <p className="text-muted-foreground">Corrija os números marcados para ver o resumo.</p>
          )}
        </section>

        <section className={cn(caixa, "shrink-0")} aria-label="Observação">
          <Field label="Observação">
            <Input size="sm" value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={bloqueado} />
          </Field>
        </section>

        <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
          {!fechado && (
            <Button onClick={salvar} loading={ocupado} disabled={ocupado}>
              Salvar boletim
            </Button>
          )}
          {inicial && !fechado && (
            <Button variant="outline" onClick={() => mudar("fechar")} disabled={ocupado}>
              <Lock /> Fechar boletim
            </Button>
          )}
          {inicial && fechado && (
            <Button variant="outline" onClick={() => mudar("reabrir")} disabled={ocupado}>
              <Unlock /> Reabrir para corrigir
            </Button>
          )}
          {inicial && (
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer /> Imprimir
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={forte ? "text-base font-semibold tabular-nums" : "tabular-nums"}>{valor}</span>
    </div>
  );
}

/** Posição da linha no cálculo: só entram as linhas que têm algum valor digitado, na ordem de `tipos`. */
function indiceDe(tipos: TipoForm[], qtds: Record<number, Qtd>, id: number): number {
  let i = 0;
  for (const t of tipos) {
    if (!qtds[t.id]) continue;
    if (t.id === id) return i;
    i++;
  }
  return -1;
}

function valorDaLinha(tipos: TipoForm[], qtds: Record<number, Qtd>, id: number, resultado: ResultadoBoletim | null): string {
  const i = indiceDe(tipos, qtds, id);
  return resultado && i >= 0 ? formatNumero(resultado.linhas[i].valor) : "0,00";
}

function LinhaQtd({
  tipo,
  q,
  erros,
  set,
  desabilitado,
  resultado,
  indice,
}: {
  tipo: TipoForm;
  q: Qtd;
  erros: Record<string, string>;
  set: (id: number, campo: keyof Qtd, valor: string) => void;
  desabilitado: boolean;
  resultado: ResultadoBoletim | null;
  indice: number;
}) {
  const campo = (c: keyof Qtd, rotulo: string) => (
    <TableCell className="w-32">
      <Input
        size="sm"
        inputMode="decimal"
        aria-label={`${rotulo} de ${tipo.nome}`}
        aria-invalid={Boolean(erros[`${tipo.id}.${c}`])}
        title={erros[`${tipo.id}.${c}`]}
        className="text-right tabular-nums"
        value={q[c]}
        onChange={(e) => set(tipo.id, c, e.target.value)}
        disabled={desabilitado}
      />
    </TableCell>
  );
  const erroLinha = (["d", "r", "t"] as const).map((c) => erros[`${tipo.id}.${c}`]).find(Boolean);
  return (
    <TableRow>
      <TableCell>
        {tipo.nome} <span className="text-muted-foreground">(R$ {formatNumero(tipo.preco, 4)})</span>
        {erroLinha && <span className="block text-[13px] font-medium text-destructive">{erroLinha}</span>}
      </TableCell>
      {campo("d", "Descarga")}
      {campo("r", "Remoção")}
      {campo("t", "Transferência")}
      <TableCell className="text-right tabular-nums">{resultado && indice >= 0 ? formatNumero(resultado.linhas[indice].valor) : "0,00"}</TableCell>
    </TableRow>
  );
}
