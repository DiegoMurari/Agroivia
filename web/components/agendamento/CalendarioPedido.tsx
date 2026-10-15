"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CircleCheck, FileText, FileUp, Lock, TriangleAlert } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { dataBR } from "@/lib/agendamento/datas";
import type { NfeLida } from "@/lib/agendamento/nf-xml";
import type { DiaDoCalendario, HorarioDoDia } from "@/lib/agendamento/ocupacao";
import type { NotaDoPedido } from "@/lib/agendamento/pedido";
import type { AcondicionamentoNf } from "@/lib/db/enums";
import type { TempoDoDia } from "@/lib/tempo";

import { cn } from "@/lib/utils";

import { chamar } from "./api";
import { CalendarioDias } from "./CalendarioDias";

/** Calendário de "Criar pedido" do fornecedor (D49) e formulário do pedido. Também serve para editar. */

export interface PedidoInicial {
  id: number;
  data: string;
  horario: string;
  numero: string;
  tipoValor: string | null;
  tipoOutros: string | null;
  observacao: string | null;
  recusaComentario: string | null;
  estado: string;
  /** Notas já anexadas: ficam valendo a menos que o fornecedor anexe outras. */
  notas: NotaDoPedido[];
}

interface Props {
  /** Hoje, `YYYY-MM-DD`, pelo relógio do servidor. */
  hoje: string;
  tipos: { valor: string; rotulo: string }[];
  /** Previsão do tempo por data (vazia sem rede). */
  tempo?: Record<string, TempoDoDia>;
  inicial?: PedidoInicial;
  /** Dentro de um popup (edição em Meus pedidos): abre direto no formulário e o calendário só aparece em "Trocar data". */
  popup?: boolean;
  /** Popup: chamado quando o pedido foi gravado e o fornecedor fecha o aviso. */
  aoConcluir?: () => void;
}

interface Previa {
  nome: string;
  nf: NfeLida;
  jaAgendadaEm: number | null;
  /** PDF do DANFE ou XML da NF-e. */
  formato: "xml" | "pdf";
  /** Todos os dados da nota foram lidos (no PDF: a chave achou a nota completa). */
  completa: boolean;
}

/** Tipo de carga quando a nota não diz a espécie: o mesmo padrão do PDF. O fornecedor troca se for carga solta. */
const ACOND_PADRAO: AcondicionamentoNf = "paletizado";

/** Chave de acesso em grupos de 4, como o DANFE imprime. */
const formatarChave = (c: string) => c.replace(/(\d{4})(?=\d)/g, "$1 ");

/** Dados lidos da nota: o fornecedor só confere, não digita. */
function ResumoNf({ nf }: { nf: NfeLida }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Chave de acesso: </dt><dd className="inline font-mono text-xs break-all">{formatarChave(nf.chaveAcesso)}</dd></div>
      <div><dt className="inline text-muted-foreground">Emitente: </dt><dd className="inline">{nf.emitenteNome ?? "-"}</dd></div>
      <div><dt className="inline text-muted-foreground">Peso líquido: </dt><dd className="inline">{nf.pesoLiquidoKg ? `${nf.pesoLiquidoKg.replace(".", ",")} kg` : "não informado"}</dd></div>
      {nf.itens.length > 0 && <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Itens: </dt><dd className="inline">{nf.itens.map((it) => it.descricao).join("; ")}</dd></div>}
    </dl>
  );
}

const ROTULO_ACOND: Record<AcondicionamentoNf, string> = { batido: "Carga solta", paletizado: "Em paletes", big_bag: "Big bag" };

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function mesDe(data: string): string {
  return data.slice(0, 7);
}

function mudarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CalendarioPedido({ hoje, tipos, tempo = {}, inicial, popup = false, aoConcluir }: Props) {
  const router = useRouter();
  const [mes, setMes] = useState(mesDe(inicial?.data ?? hoje));
  const [cache, setCache] = useState<Record<string, { dias: DiaDoCalendario[] | null; erro: string | null }>>({});
  const [tentativa, setTentativa] = useState(0);
  const formulario = useRef<HTMLElement | null>(null);
  const emVoo = useRef<Set<string>>(new Set());
  const rolar = useRef(false);
  const mesHoje = mesDe(hoje);
  const dias = cache[mes]?.dias ?? null;
  const erroCalendario = cache[mes]?.erro ?? null;
  const proximos = [...(cache[mesHoje]?.dias ?? []), ...(cache[mudarMes(mesHoje, 1)]?.dias ?? [])]
    .filter((d) => d.data >= hoje && (d.estado === "livre" || d.estado === "parcial"))
    .slice(0, 5);
  const [data, setData] = useState<string | null>(inicial?.data ?? null);
  const [escolhendoData, setEscolhendoData] = useState(!popup);
  const [horario, setHorario] = useState(inicial?.horario ?? "");
  const [horarios, setHorarios] = useState<HorarioDoDia[]>([]);
  const [tipo, setTipo] = useState(inicial?.tipoValor ?? "");
  const [tipoOutros, setTipoOutros] = useState(inicial?.tipoOutros ?? "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [acond, setAcond] = useState<(AcondicionamentoNf | "")[]>([]);
  const [pdfs, setPdfs] = useState<{ file: File; chave: string; peso: string; acond: AcondicionamentoNf; previa: Previa }[]>([]);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState<"enviar" | "rascunho" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<{ numero: string; rascunho: boolean } | null>(null);
  const [proxima, setProxima] = useState<{ data: string; horario: string } | null>(null);

  const batido = acond.includes("batido") || pdfs.some((p) => p.acond === "batido");
  const acondOcupacao = batido ? "batido" : "unitizado";
  const pdfsOk = pdfs.every((p) => p.chave.replace(/\D/g, "").length === 44);
  const temNotas = previas.length + pdfs.length > 0;
  const notasCompletas = acond.every((a) => a !== "") && pdfsOk;
  const bloqueadas = [...previas, ...pdfs.map((p) => p.previa)].filter((p) => p.jaAgendadaEm !== null);
  const editando = Boolean(inicial);
  // na edição, manter as notas atuais é permitido: só exige NF nova se o pedido ainda não tem nenhuma
  const notaObrigatoria = !editando;

  useEffect(() => {
    // só busca os meses que faltam; um mês já carregado não é apagado por uma falha
    for (const m of new Set([mes, mesHoje, mudarMes(mesHoje, 1)])) {
      if (emVoo.current.has(m) || cache[m]) continue;
      emVoo.current.add(m);
      void (async () => {
        const r = await chamar<DiaDoCalendario[]>(`/api/fornecedor/disponibilidade?mes=${m}&acond=unitizado`);
        emVoo.current.delete(m);
        setCache((c) => ({ ...c, [m]: r.ok && r.data ? { dias: r.data, erro: null } : { dias: c[m]?.dias ?? null, erro: r.mensagem ?? "Não foi possível carregar o calendário." } }));
      })();
    }
  }, [mes, mesHoje, tentativa, cache]);

  useEffect(() => {
    if (!data || !rolar.current) return;
    rolar.current = false;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formulario.current?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
  }, [data]);

  useEffect(() => {
    if (!data) return;
    let ativo = true;
    void (async () => {
      const r = await chamar<HorarioDoDia[]>(`/api/fornecedor/disponibilidade?data=${data}&acond=${acondOcupacao}`);
      if (!ativo) return;
      const lista = r.data ?? [];
      setHorarios(lista);
      // na edição o próprio pedido ocupa o horário: ele continua escolhido
      setHorario((h) => (lista.some((x) => x.horario === h && (x.livre || (inicial && inicial.data === data && inicial.horario === h))) ? h : ""));
    })();
    return () => {
      ativo = false;
    };
  }, [data, acondOcupacao, inicial]);

  /** XML e PDF entram pelo mesmo campo: o servidor lê a nota e já devolve chave, peso e tipo de carga. */
  async function anexar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const novos = Array.from(lista);
    const xmls = novos.filter((f) => /\.xml$/i.test(f.name));
    const novosPdfs = novos.filter((f) => /\.pdf$/i.test(f.name));
    if (xmls.length + novosPdfs.length !== novos.length) {
      setErro("Anexe o XML da NF-e ou o PDF do DANFE.");
      return;
    }
    setErro(null);
    setLendo(true);
    try {
      if (xmls.length > 0) {
        const todos = [...arquivos, ...xmls];
        const form = new FormData();
        todos.forEach((f) => form.append("arquivos", f));
        const r = await chamar<Previa[]>("/api/fornecedor/nf-ler", { method: "POST", body: form });
        if (!r.ok || !r.data) {
          setErro(r.mensagem ?? "Não foi possível ler os arquivos.");
          return;
        }
        const repetida = r.data.find((p) => pdfs.some((x) => x.chave === p.nf.chaveAcesso));
        if (repetida) {
          setErro(`A nota ${repetida.nf.numero ?? repetida.nf.chaveAcesso} já foi anexada em PDF. Anexe cada nota uma única vez.`);
          return;
        }
        setArquivos(todos);
        setPrevias(r.data);
        setAcond((antes) => r.data!.map((p, i) => antes[i] || p.nf.acondicionamentoSugerido || ACOND_PADRAO));
      }
      if (novosPdfs.length > 0) {
        const form = new FormData();
        novosPdfs.forEach((f) => form.append("arquivos", f));
        const r = await chamar<Previa[]>("/api/fornecedor/nf-ler", { method: "POST", body: form });
        if (!r.ok || !r.data) {
          setErro(r.mensagem ?? "Não foi possível ler os arquivos.");
          return;
        }
        const ja = new Set([...previas.map((p) => p.nf.chaveAcesso), ...pdfs.map((p) => p.chave)]);
        const repetida = r.data.find((p) => p.nf.chaveAcesso !== "" && ja.has(p.nf.chaveAcesso));
        if (repetida) {
          setErro(`A nota ${repetida.nf.numero ?? repetida.nf.chaveAcesso} já foi anexada. Anexe cada nota uma única vez.`);
          return;
        }
        setPdfs((a) => [
          ...a,
          ...r.data!.map((p, i) => ({ file: novosPdfs[i], chave: p.nf.chaveAcesso, peso: p.nf.pesoLiquidoKg ?? "", acond: p.nf.acondicionamentoSugerido ?? ACOND_PADRAO, previa: p })),
        ]);
      }
    } finally {
      setLendo(false);
    }
  }

  function removerXml(i: number) {
    setArquivos((a) => a.filter((_, j) => j !== i));
    setPrevias((p) => p.filter((_, j) => j !== i));
    setAcond((a) => a.filter((_, j) => j !== i));
  }

  async function gravar(modo: "enviar" | "rascunho") {
    if (!data) return;
    setErro(null);
    setProxima(null);
    setEnviando(modo);
    const form = new FormData();
    arquivos.forEach((f) => form.append("arquivos", f));
    pdfs.forEach((p) => form.append("arquivos", p.file));
    form.append("acondicionamentos", JSON.stringify([...acond, ...pdfs.map((p) => p.acond)]));
    form.append("manuais", JSON.stringify(pdfs.map((p) => ({ chaveAcesso: p.chave, pesoLiquidoKg: p.peso || null }))));
    form.append("data", data);
    form.append("horario", horario);
    form.append("tipoMercadoria", tipo);
    form.append("tipoOutros", tipoOutros);
    form.append("observacao", observacao);
    form.append("enviar", modo === "enviar" ? "1" : "0");
    const r = await chamar<{ agendamentoId: number; numero: string }>(editando ? `/api/fornecedor/pedidos/${inicial!.id}` : "/api/fornecedor/pedidos", { method: "POST", body: form });
    setEnviando(null);
    if (r.ok && r.data) {
      setConcluido({ numero: r.data.numero, rascunho: modo === "rascunho" });
      router.refresh();
      return;
    }
    setErro(r.mensagem ?? "Não foi possível gravar o pedido.");
    const detalhe = r.detalhe as { proxima?: { data: string; horario: string } | null } | undefined;
    if (detalhe?.proxima) setProxima(detalhe.proxima);
    setCache({});
    setTentativa((t) => t + 1);
  }

  function escolherDia(d: string) {
    setData(d);
    setHorario("");
    setMes(mesDe(d));
    if (popup) setEscolhendoData(false);
    else rolar.current = true;
  }

  const podeRascunho = Boolean(data && horario) && (!temNotas || notasCompletas) && bloqueadas.length === 0;
  const podeGravar = podeRascunho && (temNotas || !notaObrigatoria) && Boolean(tipo) && (tipo !== "OUTROS" || tipoOutros.trim() !== "");
  const falta = [
    !horario && "horário",
    notaObrigatoria && !temNotas && "nota fiscal",
    temNotas && !notasCompletas && "tipo de carga de cada nota",
    !tipo && "tipo de mercadoria",
    tipo === "OUTROS" && tipoOutros.trim() === "" && "descrição da mercadoria",
  ].filter(Boolean) as string[];
  const diaSel = [...(cache[mesDe(data ?? hoje)]?.dias ?? [])].find((d) => d.data === data);

  if (concluido) {
    return (
      <div className="space-y-4">
        <Alert variant="success" title={concluido.rascunho ? "Rascunho salvo" : "Agendamento enviado"}>
          <p className="text-h3 tabular-nums text-brand">{concluido.numero}</p>
          {concluido.rascunho
            ? "O rascunho não ocupa vaga. Termine e envie quando quiser."
            : "Compras vai analisar e você recebe o aviso em Meus pedidos."}
        </Alert>
        {popup ? (
          <Button onClick={aoConcluir}>Fechar</Button>
        ) : (
          <Button asChild>
            <Link href="/fornecedor/pedidos">Ir para Meus pedidos</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(!popup || escolhendoData) && <CalendarioDias
        mes={mes}
        hoje={hoje}
        dias={dias}
        proximos={popup ? [] : proximos}
        tempo={tempo}
        escolhido={data}
        erro={erroCalendario}
        podeVoltar={mes > mesHoje}
        onMes={(delta) => setMes(mudarMes(mes, delta))}
        onHoje={() => setMes(mesHoje)}
        onEscolher={escolherDia}
        onTentarDeNovo={() => { setCache({}); setTentativa((t) => t + 1); }}
      />}

      {data && (
        <section ref={formulario} className={cn("scroll-mt-20 space-y-6", !popup && "rounded-2xl border bg-card p-4 shadow-card sm:p-5")} aria-labelledby="titulo-pedido">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="titulo-pedido" className="text-h3 text-brand">
              {inicial && !popup ? `Editar pedido ${inicial.numero}` : `Descarga em ${dataBR(data)}`}
            </h2>
            {inicial && <Badge variant="outline">{inicial.estado}</Badge>}
            {inicial && !popup && <span className="text-sm text-muted-foreground">Descarga em {dataBR(data)}</span>}
            {popup && !escolhendoData && <Button variant="outline" size="sm" onClick={() => setEscolhendoData(true)}>Trocar data</Button>}
            {diaSel && <Badge variant="info">{diaSel.livres === 1 ? "1 horário livre" : `${diaSel.livres} horários livres`}</Badge>}
          </div>

          {inicial?.recusaComentario && (
            <Alert variant="destructive" title="Compras recusou este pedido">
              {inicial.recusaComentario} Corrija o que foi pedido e envie de novo.
            </Alert>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Horário</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {horarios.map((h) => {
                const proprio = Boolean(inicial && inicial.data === data && inicial.horario === h.horario);
                const livre = h.livre || proprio;
                const marcado = horario === h.horario;
                return (
                  <div key={h.horario} className="space-y-1">
                    <Button variant={marcado ? "default" : "outline"} className="w-full" disabled={!livre} aria-pressed={marcado} onClick={() => setHorario(h.horario)}>
                      {livre ? <CalendarCheck /> : <Lock />} {h.horario}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {livre ? (proprio ? "Seu horário atual" : h.ocupados === 0 ? "Livre" : "1 vaga") : h.motivo === "reservado_batido" ? "Carga solta no horário" : h.motivo === "passado" ? "Já passou" : "Lotado"}
                    </p>
                  </div>
                );
              })}
            </div>
            {tempo[data]?.alertaChuva && batido && (
              <Alert variant="warning" title="Chuva provável neste dia">Carga solta descarrega em área coberta: confirme com Compras.</Alert>
            )}
            {batido && <Alert variant="info" title="Carga solta">Carga solta ocupa o horário inteiro. Só aparecem livres os horários sem outro caminhão.</Alert>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de mercadoria" required>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Escolha</option>
                {tipos.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                ))}
              </Select>
            </Field>
            {tipo === "OUTROS" && (
              <Field label="Qual mercadoria?" description="Descreva o que está sendo entregue." required>
                <Input value={tipoOutros} onChange={(e) => setTipoOutros(e.target.value)} maxLength={80} />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Observação" description="Algo que o recebimento precise saber. Opcional.">
                <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Nota fiscal {notaObrigatoria ? "(obrigatória)" : ""}</h3>
            {editando && inicial!.notas.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {temNotas ? "As notas abaixo serão trocadas pelas que você anexou." : "Estas notas continuam no pedido. Anexe arquivos só se quiser trocá-las."}
                </p>
                {inicial!.notas.map((n) => (
                  <div key={n.chave} className={cn("space-y-2 rounded-xl border bg-muted/30 p-4", temNotas && "opacity-60")}>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <FileText className="size-4" /> NF {n.numero ?? "sem número"}
                      {temNotas ? <Badge variant="warning"><TriangleAlert /> Será trocada</Badge> : <Badge variant="info"><CircleCheck /> Nota atual</Badge>}
                    </div>
                    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Chave de acesso: </dt><dd className="inline font-mono text-xs break-all">{formatarChave(n.chave)}</dd></div>
                      <div><dt className="inline text-muted-foreground">Emitente: </dt><dd className="inline">{n.emitenteNome ?? "-"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Peso líquido: </dt><dd className="inline">{n.pesoLiquidoKg ? `${n.pesoLiquidoKg.replace(".", ",")} kg` : "não informado"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Tipo de carga: </dt><dd className="inline">{ROTULO_ACOND[n.acondicionamento as AcondicionamentoNf] ?? n.acondicionamento}</dd></div>
                      {n.itens.length > 0 && <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Itens: </dt><dd className="inline">{n.itens.join("; ")}</dd></div>}
                    </dl>
                  </div>
                ))}
              </div>
            )}
            <Field label="XML da NF-e ou PDF do DANFE" description="Anexe a nota e a chave, o peso e o tipo de carga são preenchidos sozinhos. Até 2 MB por arquivo. Pode anexar mais de uma nota.">
              <Input type="file" accept=".xml,.pdf,text/xml,application/xml,application/pdf" multiple onChange={(e) => { void anexar(e.target.files); e.target.value = ""; }} />
            </Field>
            {lendo && <p role="status" className="text-sm text-muted-foreground">Lendo a nota...</p>}
            {previas.map((p, i) => (
              <div key={p.nf.chaveAcesso} className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium break-all">
                    <FileUp className="size-4" /> NF {p.nf.numero ?? "sem número"} <span className="text-sm text-muted-foreground">{p.nome} · {tamanho(arquivos[i]?.size ?? 0)}</span>
                    <Badge variant="success"><CircleCheck /> Lida automaticamente</Badge>
                  </div>
                  <Button variant="ghost" size="sm" aria-label={`Remover ${p.nome}`} onClick={() => removerXml(i)}>Remover</Button>
                </div>
                <ResumoNf nf={p.nf} />
                {p.jaAgendadaEm !== null && (
                  <Alert variant="destructive" title="Nota já usada">Esta NF já está em outro pedido. Remova o arquivo para continuar.</Alert>
                )}
                <Field label="Tipo de carga desta nota" description={p.nf.acondicionamentoSugerido ? "Preenchido pela espécie da nota. Confirme." : "A nota não diz a espécie. Deixei Em paletes; troque se a carga for solta."} required>
                  <Select value={acond[i] ?? ""} onChange={(e) => setAcond((a) => a.map((v, j) => (j === i ? (e.target.value as AcondicionamentoNf) : v)))}>
                    <option value="">Escolha</option>
                    {(Object.keys(ROTULO_ACOND) as AcondicionamentoNf[]).map((k) => (
                      <option key={k} value={k}>{ROTULO_ACOND[k]}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            ))}
            {pdfs.map((p, i) => {
              const lida = p.previa.nf.chaveAcesso !== "";
              return (
                <div key={`${p.file.name}-${i}`} className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium break-all">
                      <FileText className="size-4" /> {lida && p.previa.nf.numero ? `NF ${p.previa.nf.numero}` : "DANFE"} <span className="text-sm font-normal text-muted-foreground">{p.file.name} · {tamanho(p.file.size)}</span>
                      {lida ? <Badge variant="success"><CircleCheck /> Chave lida do PDF</Badge> : <Badge variant="warning"><TriangleAlert /> Chave não encontrada</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" aria-label={`Remover ${p.file.name}`} onClick={() => setPdfs((a) => a.filter((_, j) => j !== i))}>Remover</Button>
                  </div>
                  {lida && <ResumoNf nf={p.previa.nf} />}
                  {!lida && <Alert variant="warning" title="Não consegui ler a chave neste PDF">Digite os 44 números que ficam abaixo do código de barras do DANFE.</Alert>}
                  {p.previa.jaAgendadaEm !== null && (
                    <Alert variant="destructive" title="Nota já usada">Esta NF já está em outro pedido. Remova o arquivo para continuar.</Alert>
                  )}
                  <div className="grid items-start gap-3 sm:grid-cols-3">
                    {!lida && (
                      <Field label="Chave de acesso (44 dígitos)" required error={p.chave && p.chave.replace(/\D/g, "").length !== 44 ? "A chave precisa ter 44 dígitos." : undefined}>
                        <Input value={p.chave} inputMode="numeric" onChange={(e) => setPdfs((a) => a.map((x, j) => (j === i ? { ...x, chave: e.target.value } : x)))} />
                      </Field>
                    )}
                    {!p.previa.nf.pesoLiquidoKg && (
                      <Field label="Peso líquido (kg)" description="O PDF não traz o peso. Opcional.">
                        <Input value={p.peso} inputMode="decimal" onChange={(e) => setPdfs((a) => a.map((x, j) => (j === i ? { ...x, peso: e.target.value } : x)))} />
                      </Field>
                    )}
                    <Field label="Tipo de carga" description={p.previa.nf.acondicionamentoSugerido ? "Preenchido pela espécie da nota. Confirme." : "Deixei Em paletes; troque se a carga for solta."} required>
                      <Select value={p.acond} onChange={(e) => setPdfs((a) => a.map((x, j) => (j === i ? { ...x, acond: e.target.value as AcondicionamentoNf } : x)))}>
                        {(Object.keys(ROTULO_ACOND) as AcondicionamentoNf[]).map((k) => (
                          <option key={k} value={k}>{ROTULO_ACOND[k]}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          {erro && (
            <Alert variant="destructive" title="Não foi possível gravar o pedido">
              {erro}
              {proxima && ` A próxima data disponível é ${dataBR(proxima.data)} às ${proxima.horario}.`}
              {proxima && (
                <Button className="mt-3 w-full sm:w-auto" size="sm" variant="outline" onClick={() => { setMes(mesDe(proxima.data)); setData(proxima.data); setHorario(proxima.horario); setErro(null); setProxima(null); }}>
                  Escolher {dataBR(proxima.data)} às {proxima.horario}
                </Button>
              )}
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" loading={enviando === "enviar"} disabled={!podeGravar || enviando !== null} onClick={() => gravar("enviar")}>
              Enviar para aprovação
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" loading={enviando === "rascunho"} disabled={!podeRascunho || enviando !== null} onClick={() => gravar("rascunho")}>
              Salvar rascunho
            </Button>
          </div>
          {!podeGravar && falta.length > 0 && <p className="text-sm text-muted-foreground">Falta: {falta.join(", ")}.</p>}
        </section>
      )}
    </div>
  );
}
