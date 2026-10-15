"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, CircleCheck, CircleX, FileUp, Keyboard, Minus, ScanSearch, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import type { Candidato, ItemConferido, ResultadoConferencia, ResultadoItem } from "@/lib/agendamento/conferencia";
import { dataBR } from "@/lib/agendamento/datas";
import { formatNumero } from "@/lib/money";
import { cn } from "@/lib/utils";

import { chamar, postJson } from "./api";
import { LeitorCamera } from "./LeitorCamera";
import { Portaria, type NotaDoXml } from "./Portaria";

/** Conferência da nota fiscal na portaria (D53). Uma coisa por vez, letras grandes, pensada para o celular em pé. */

type Resposta = ResultadoConferencia & { nota: NotaDoXml | null };

interface Props {
  /** Compras e gestor de armazém abrem a descarga; a portaria não tem acesso a ela. */
  podeAbrirDescarga: boolean;
  aguardados: { agendamentoId: number; horario: string; fornecedor: string; placa: string | null }[];
}

const ICONE: Record<ResultadoItem, React.ReactNode> = {
  bate: <CircleCheck className="size-6 shrink-0 text-success" aria-label="Bate" />,
  nao_bate: <CircleX className="size-6 shrink-0 text-destructive" aria-label="Não bate" />,
  aviso: <TriangleAlert className="size-6 shrink-0 text-warning" aria-label="Aviso" />,
  nao_se_aplica: <Minus className="size-6 shrink-0 text-muted-foreground" aria-label="Não se aplica" />,
};

function Faixa({ r }: { r: ResultadoConferencia }) {
  const tom =
    r.veredito === "confere"
      ? { classe: "border-success/40 bg-success/10", icone: <CircleCheck className="size-8 text-success" />, titulo: r.resumo }
      : r.veredito === "confere_com_aviso"
        ? { classe: "border-warning/40 bg-warning/10", icone: <TriangleAlert className="size-8 text-warning" />, titulo: r.resumo }
        : r.veredito === "divergente"
          ? { classe: "border-destructive/40 bg-destructive/10", icone: <CircleX className="size-8 text-destructive" />, titulo: r.resumo }
          : { classe: "border-brand/30 bg-brand/10", icone: <ScanSearch className="size-8 text-brand" />, titulo: r.resumo };
  return (
    <div role={r.veredito === "confere" ? "status" : "alert"} className={cn("flex items-center gap-3 rounded-xl border-2 p-4", tom.classe)}>
      {tom.icone}
      <p className="text-h3 text-foreground">{tom.titulo}</p>
    </div>
  );
}

function Linha({ i }: { i: ItemConferido }) {
  return (
    <li className="space-y-1 py-3">
      <div className="flex items-start gap-3">
        {ICONE[i.resultado]}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-medium">{i.rotulo}</p>
          <dl className="grid gap-x-6 gap-y-0.5 text-base sm:grid-cols-2">
            <div className="min-w-0 break-words"><dt className="text-sm text-muted-foreground">Na nota</dt><dd>{i.naNota ?? "-"}</dd></div>
            <div className="min-w-0 break-words"><dt className="text-sm text-muted-foreground">No agendamento</dt><dd>{i.noAgendamento ?? "-"}</dd></div>
          </dl>
          {i.resultado !== "bate" && i.resultado !== "nao_se_aplica" && <p className="text-base">{i.mensagem}</p>}
        </div>
      </div>
    </li>
  );
}

export function ConferirNota({ podeAbrirDescarga, aguardados }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [modo, setModo] = useState<"camera" | "chave" | "xml">("camera");
  const [ciclo, setCiclo] = useState(0);
  const [chave, setChave] = useState("");
  const [placa, setPlaca] = useState("");
  const [lendo, setLendo] = useState(false);
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [peso, setPeso] = useState("");
  const [gravando, setGravando] = useState(false);
  const [erroCampos, setErroCampos] = useState<Record<string, string>>({});
  const [feito, setFeito] = useState<{ texto: string; galpoes: string[]; agendamentoId: number; recusado?: boolean } | null>(null);

  const digitos = chave.replace(/\D/g, "");

  async function conferir(agendamentoId?: number, chaveDireta?: string) {
    if (lendo) return;
    setErro(null);
    setErroCampos({});
    setObservacao("");
    setR(null);
    setLendo(true);
    const form = new FormData();
    if (arquivo && !chaveDireta) form.append("arquivo", arquivo);
    else form.append("chave", chaveDireta ?? digitos);
    if (placa.trim()) form.append("placa", placa.trim());
    if (agendamentoId) form.append("agendamentoId", String(agendamentoId));
    const res = await chamar<Resposta>("/api/agendamento/portaria/conferir", { method: "POST", body: form });
    setLendo(false);
    if (!res.ok || !res.data) {
      setErro(res.mensagem ?? "Não foi possível conferir a nota.");
      setR(null);
      return;
    }
    setR(res.data);
  }

  /** Câmera ao vivo: leu o código de barras, confere com o banco na hora. */
  function aoLerCamera(lida: string) {
    setChave(lida);
    setArquivo(null);
    void conferir(undefined, lida);
  }

  /** Digitando ou colando a chave: ao chegar nos 44 números, confere sozinho. */
  function aoMudarChave(valor: string) {
    setChave(valor);
    setR(null);
    setErro(null);
    const so = valor.replace(/\D/g, "");
    if (so.length === 44) void conferir(undefined, so);
  }

  async function registrar() {
    if (!r?.agendamentoId) return;
    setErro(null);
    setErroCampos({});
    setGravando(true);
    const res = await postJson<{ veredito: string | null; pendenciaId: number | null; galpoes: string[] }>("/api/agendamento/portaria/chegada", {
      agendamentoId: r.agendamentoId,
      chave: r.chave,
      xml: arquivo ? await arquivo.text() : null,
      placa: placa.trim() || r.nota?.placa || null,
      pesoBalancaKg: peso.trim() || null,
      observacao: observacao.trim() || null,
    });
    setGravando(false);
    if (!res.ok || !res.data) {
      setErro(res.mensagem ?? "Não foi possível registrar a chegada.");
      setErroCampos(res.campos ?? {});
      return;
    }
    setFeito({ texto: res.data.veredito === "divergente" ? "Chegada registrada com divergência. Abri uma pendência para o armazém." : "Chegada registrada.", galpoes: res.data.galpoes, agendamentoId: r.agendamentoId });
  }

  async function recusar() {
    if (!r?.agendamentoId) return;
    if (!observacao.trim()) {
      setErroCampos({ observacao: "Explique por que o recebimento foi recusado." });
      return;
    }
    setErro(null);
    setGravando(true);
    const res = await postJson("/api/agendamento/portaria/recusa", {
      agendamentoId: r.agendamentoId,
      descricao: observacao,
      chave: r.chave,
      xml: arquivo ? await arquivo.text() : null,
      placa: placa.trim() || null,
    });
    setGravando(false);
    if (!res.ok) {
      setErro(res.mensagem ?? "Não foi possível registrar a recusa.");
      return;
    }
    setFeito({ texto: "Recebimento recusado e registrado.", galpoes: [], agendamentoId: r.agendamentoId, recusado: true });
  }

  function outra() {
    setArquivo(null);
    setChave("");
    setPlaca("");
    setR(null);
    setErro(null);
    setErroCampos({});
    setObservacao("");
    setPeso("");
    setFeito(null);
  }

  if (feito) {
    return (
      <div className="space-y-6">
        <div role="status" className="flex items-center gap-3 rounded-xl border-2 border-success/40 bg-success/10 p-4">
          <CircleCheck className="size-8 text-success" />
          <p className="text-h3">{feito.texto}</p>
        </div>
        <p className="text-lg">{feito.recusado ? "O fornecedor recebe o aviso com o motivo e pode agendar de novo." : feito.galpoes.length > 0 ? `Destino: ${feito.galpoes.join(", ")}.` : "O galpão de destino ainda não foi definido."}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="w-full sm:w-auto" onClick={outra}>Conferir outra nota</Button>
          {podeAbrirDescarga && !feito.recusado && (
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href={`/agendamento/descarga/${feito.agendamentoId}`}>Abrir a descarga</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const divergente = r?.veredito === "divergente";
  return (
    <div className="space-y-8">
      <section className="space-y-5" aria-label="Nota fiscal">
        <div role="radiogroup" aria-label="Como ler a nota" className="grid grid-cols-3 gap-2 rounded-xl border bg-muted p-1">
          {([
            { v: "camera", t: "Câmera", i: Camera },
            { v: "chave", t: "Digitar", i: Keyboard },
            { v: "xml", t: "XML", i: FileUp },
          ] as const).map(({ v, t, i: Icone }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={modo === v}
              onClick={() => { setModo(v); setR(null); setErro(null); }}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-lg text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                modo === v ? "bg-card text-brand shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="size-5" aria-hidden="true" /> {t}
            </button>
          ))}
        </div>

        {modo === "camera" && (
          <div className="space-y-3">
            <LeitorCamera ciclo={ciclo} pausado={lendo || r !== null} aoLer={aoLerCamera} />
            {(r !== null || erro) && (
              <Button type="button" variant="outline" onClick={() => { setR(null); setErro(null); setChave(""); setCiclo((n) => n + 1); }}>
                <Camera /> Ler outra nota
              </Button>
            )}
          </div>
        )}

        {modo === "chave" && (
          <Field label="Chave de 44 números" description={`${digitos.length} de 44 números. Ao completar, a conferência começa sozinha.`}>
            <Input value={chave} inputMode="numeric" size="lg" autoFocus onChange={(e) => aoMudarChave(e.target.value)} />
          </Field>
        )}

        {modo === "xml" && (
          <div className="space-y-3">
            <label
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card p-6 text-center transition-colors hover:bg-accent focus-within:outline-2 focus-within:outline-ring",
                arrastando && "border-brand bg-brand/10",
                arquivo && "border-success/60",
              )}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                const f = e.dataTransfer.files?.[0];
                if (f) { setArquivo(f); setR(null); setErro(null); }
              }}
            >
              <FileUp className="size-10 text-brand" aria-hidden="true" />
              <span className="text-h3">{arquivo ? arquivo.name : "Anexe o XML da nota fiscal"}</span>
              <span className="text-base text-muted-foreground">{arquivo ? "Toque para trocar o arquivo" : "Arraste o arquivo aqui ou toque para escolher"}</span>
              <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setR(null); setErro(null); e.target.value = ""; }} />
            </label>
            <Button size="lg" className="w-full text-lg sm:w-auto" loading={lendo} disabled={!arquivo} onClick={() => conferir()}>
              <ScanSearch /> Conferir nota
            </Button>
          </div>
        )}

        <Field label="Placa do caminhão (opcional)">
          <Input value={placa} size="lg" autoCapitalize="characters" onChange={(e) => { setPlaca(e.target.value.toUpperCase()); setR(null); setErro(null); }} />
        </Field>
        {lendo && <p role="status" className="text-base text-muted-foreground">Conferindo com os agendamentos...</p>}
        {erro && !r && (
          <p role="alert" className="flex items-center gap-2 text-base text-destructive"><CircleX className="size-5 shrink-0" /> {erro}</p>
        )}
      </section>

      {r && (
        <section className="space-y-5 rounded-xl border bg-card p-5 shadow-card" aria-label="Resultado da conferência">
          <Faixa r={r} />

          {r.veredito === "escolher" && (
            <div className="space-y-3">
              <p className="text-base">Toque no agendamento desta carga:</p>
              <ul className="space-y-2">
                {r.candidatos.map((c: Candidato) => (
                  <li key={c.agendamentoId}>
                    <button type="button" onClick={() => conferir(c.agendamentoId)} className="w-full rounded-lg border p-4 text-left text-base hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                      <span className="block font-medium">{c.fornecedor}</span>
                      <span className="block text-muted-foreground">{c.numero} · {dataBR(c.data).slice(0, 5)} às {c.horario}{c.placa ? ` · ${c.placa}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.itens.length > 0 && <ul className="divide-y">{r.itens.map((i) => <Linha key={i.chave} i={i} />)}</ul>}

          {r.produtos.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-1 text-sm font-medium text-muted-foreground">Itens do pedido ({r.produtos.length})</p>
              <ul className="divide-y text-base">
                {r.produtos.map((p, n) => (
                  <li key={n} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span>{p.descricao ?? "Sem descrição"}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{p.quantidade ? formatNumero(p.quantidade) : "-"} {p.unidade ?? ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.veredito === "sem_agendamento" && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-base">Sem agendamento: veja se há vaga hoje.</p>
              <Portaria key={r.chave} cnpj={r.cnpjEmitente ?? undefined} nomeEmitente={r.nota?.emitenteNome ?? undefined} placaInicial={placa || r.nota?.placa || ""} nota={r.nota} arquivo={arquivo} chave={r.chave} podeAbrirDescarga={podeAbrirDescarga} />
            </div>
          )}

          {r.agendamentoId && (r.veredito === "confere" || r.veredito === "confere_com_aviso" || divergente) && (
            <div className="space-y-4 border-t pt-4">
              <Field label="Peso da balança (kg)" description="Obrigatório para carga acima de 500 kg." error={erroCampos.pesoBalancaKg}>
                <Input value={peso} inputMode="decimal" size="lg" onChange={(e) => setPeso(e.target.value)} />
              </Field>
              {divergente && (
                <Field label="Observação" description="Explique por que a nota não confere." required error={erroCampos.observacao}>
                  <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} />
                </Field>
              )}
              {erro && <p role="alert" className="flex items-center gap-2 text-base text-destructive"><CircleX className="size-5 shrink-0" /> {erro}</p>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="w-full text-lg sm:w-auto" loading={gravando} onClick={registrar}>
                  {divergente ? "Registrar chegada com divergência" : "Registrar chegada"}
                </Button>
                {divergente && (
                  <Button size="lg" variant="destructive" className="w-full text-lg sm:w-auto" disabled={gravando} onClick={recusar}>
                    Recusar o recebimento
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <details className="rounded-xl border bg-card p-5 shadow-card">
        <summary className="cursor-pointer text-lg font-medium">Aguardados hoje ({aguardados.length})</summary>
        {aguardados.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">Nenhuma descarga aguardando hoje.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {aguardados.map((a) => (
              <li key={a.agendamentoId} className="flex flex-wrap items-baseline gap-x-4 py-2 text-base">
                <span className="w-16 font-medium tabular-nums text-brand">{a.horario}</span>
                <span className="min-w-0 flex-1 break-words">{a.fornecedor}</span>
                {a.placa && <span className="text-muted-foreground">{a.placa}</span>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
