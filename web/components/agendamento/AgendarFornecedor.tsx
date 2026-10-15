"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, FileUp, Lock } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { dataBR } from "@/lib/agendamento/datas";
import type { NfeLida } from "@/lib/agendamento/nf-xml";
import type { DiaDisponivel } from "@/lib/agendamento/ocupacao";
import type { AcondicionamentoNf } from "@/lib/db/enums";

import { chamar } from "./api";

interface Previa {
  nome: string;
  nf: NfeLida;
  jaAgendadaEm: number | null;
}

interface Props {
  token: string;
  diasBatido: DiaDisponivel[];
  diasUnitizado: DiaDisponivel[];
}

const ROTULO_ACOND: Record<AcondicionamentoNf, string> = { batido: "Batido (a granel)", paletizado: "Paletizado", big_bag: "Big bag" };

export function AgendarFornecedor({ token, diasBatido, diasUnitizado }: Props) {
  const router = useRouter();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [acond, setAcond] = useState<(AcondicionamentoNf | "")[]>([]);
  const [escolha, setEscolha] = useState<{ data: string; horario: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [proxima, setProxima] = useState<{ data: string; horario: string } | null>(null);
  const [pdfs, setPdfs] = useState<{ file: File; chave: string; peso: string; acond: AcondicionamentoNf }[]>([]);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function anexar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const todos = [...arquivos, ...Array.from(lista)];
    setErro(null);
    setProxima(null);
    setLendo(true);
    const form = new FormData();
    todos.forEach((f) => form.append("arquivos", f));
    const r = await chamar<Previa[]>("/api/agendamento/nf-ler", { method: "POST", body: form });
    setLendo(false);
    if (!r.ok || !r.data) {
      setErro(r.mensagem ?? "Não foi possível ler os arquivos.");
      return;
    }
    setArquivos(todos);
    setPrevias(r.data);
    setAcond((antes) => r.data!.map((p, i) => antes[i] || p.nf.acondicionamentoSugerido || ""));
    setEscolha(null);
  }

  function remover(i: number) {
    const restantes = arquivos.filter((_, j) => j !== i);
    setArquivos(restantes);
    setPrevias((p) => p.filter((_, j) => j !== i));
    setAcond((a) => a.filter((_, j) => j !== i));
    setEscolha(null);
  }

  const pdfsOk = pdfs.every((p) => p.chave.replace(/\D/g, "").length === 44);
  const completo = previas.length + pdfs.length > 0 && acond.every((a) => a !== "") && pdfsOk;
  const batido = acond.includes("batido") || pdfs.some((p) => p.acond === "batido");
  const dias = batido ? diasBatido : diasUnitizado;
  const bloqueadas = previas.filter((p) => p.jaAgendadaEm !== null);

  async function confirmar() {
    if (!escolha) return;
    setErro(null);
    setProxima(null);
    setEnviando(true);
    const form = new FormData();
    arquivos.forEach((f) => form.append("arquivos", f));
    pdfs.forEach((p) => form.append("arquivos", p.file));
    form.append("acondicionamentos", JSON.stringify([...acond, ...pdfs.map((p) => p.acond)]));
    form.append("manuais", JSON.stringify(pdfs.map((p) => ({ chaveAcesso: p.chave, pesoLiquidoKg: p.peso || null }))));
    form.append("data", escolha.data);
    form.append("horario", escolha.horario);
    const r = await chamar<{ agendamentoId: number }>(`/api/agendamento/agendar/${token}`, { method: "POST", body: form });
    setEnviando(false);
    if (r.ok) {
      router.refresh();
      return;
    }
    setErro(r.mensagem ?? "Não foi possível confirmar o agendamento.");
    const detalhe = r.detalhe as { proxima?: { data: string; horario: string } | null } | undefined;
    if (detalhe?.proxima) setProxima(detalhe.proxima);
    setEscolha(null);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-h3 text-brand">1. Anexe o XML de cada nota fiscal</h2>
        <Field label="Arquivos XML da NF-e" description="Pode anexar mais de uma nota para o mesmo caminhão.">
          <Input type="file" accept=".xml,text/xml,application/xml" multiple onChange={(e) => { void anexar(e.target.files); e.target.value = ""; }} />
        </Field>
        {lendo && <p className="text-sm text-muted-foreground">Lendo os arquivos...</p>}
        {previas.map((p, i) => (
          <div key={p.nf.chaveAcesso} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium break-all">
                <FileUp className="size-4" /> NF {p.nf.numero ?? "sem número"} <span className="text-sm text-muted-foreground">{p.nome}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remover(i)}>
                Remover
              </Button>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="inline text-muted-foreground">Emitente: </dt><dd className="inline">{p.nf.emitenteNome ?? "-"} {p.nf.emitenteCnpj ?? ""}</dd></div>
              <div><dt className="inline text-muted-foreground">Chave: </dt><dd className="inline font-mono text-xs break-all">{p.nf.chaveAcesso}</dd></div>
              <div><dt className="inline text-muted-foreground">Peso líquido: </dt><dd className="inline">{p.nf.pesoLiquidoKg ? `${p.nf.pesoLiquidoKg.replace(".", ",")} kg` : "não informado"}</dd></div>
              <div><dt className="inline text-muted-foreground">Volumes e espécie: </dt><dd className="inline">{p.nf.volumes ?? "-"} {p.nf.especie ?? ""}</dd></div>
              <div><dt className="inline text-muted-foreground">Placa: </dt><dd className="inline">{p.nf.placa ?? "não informada"}</dd></div>
              <div><dt className="inline text-muted-foreground">Itens: </dt><dd className="inline">{p.nf.itens.map((it) => it.descricao).join("; ")}</dd></div>
            </dl>
            {p.jaAgendadaEm !== null && (
              <Alert variant="destructive" title="Nota já agendada">
                Esta NF já está em outro agendamento ativo. Remova o arquivo para continuar.
              </Alert>
            )}
            <Field label="Acondicionamento desta nota" description={p.nf.acondicionamentoSugerido ? "Sugerido pela espécie do XML. Confirme." : "O XML não diz. Escolha."} required>
              <Select value={acond[i] ?? ""} onChange={(e) => setAcond((a) => a.map((v, j) => (j === i ? (e.target.value as AcondicionamentoNf) : v)))}>
                <option value="">Escolha</option>
                {(Object.keys(ROTULO_ACOND) as AcondicionamentoNf[]).map((k) => (
                  <option key={k} value={k}>{ROTULO_ACOND[k]}</option>
                ))}
              </Select>
            </Field>
          </div>
        ))}
        <Field label="Ou anexe o DANFE em PDF" description="Digite a chave de 44 dígitos do DANFE. O XML é preferível.">
          <Input type="file" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfs((a) => [...a, { file: f, chave: "", peso: "", acond: "paletizado" }]); e.target.value = ""; }} />
        </Field>
        {pdfs.map((p, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2 font-medium">
              <span className="min-w-0 break-all">{p.file.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setPdfs((a) => a.filter((_, j) => j !== i))}>Remover</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Chave de acesso (44 dígitos)" required error={p.chave && p.chave.replace(/\D/g, "").length !== 44 ? "A chave precisa ter 44 dígitos." : undefined}>
                <Input value={p.chave} inputMode="numeric" onChange={(e) => setPdfs((a) => a.map((x, j) => (j === i ? { ...x, chave: e.target.value } : x)))} />
              </Field>
              <Field label="Peso líquido (kg)">
                <Input value={p.peso} inputMode="decimal" onChange={(e) => setPdfs((a) => a.map((x, j) => (j === i ? { ...x, peso: e.target.value } : x)))} />
              </Field>
              <Field label="Acondicionamento" required>
                <Select value={p.acond} onChange={(e) => setPdfs((a) => a.map((x, j) => (j === i ? { ...x, acond: e.target.value as AcondicionamentoNf } : x)))}>
                  {(Object.keys(ROTULO_ACOND) as AcondicionamentoNf[]).map((k) => (
                    <option key={k} value={k}>{ROTULO_ACOND[k]}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        ))}
        {batido && (
          <Alert variant="info" title="Carga batida">
            Carga batida reserva o horário inteiro. Só aparecem livres os horários sem outro caminhão.
          </Alert>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-h3 text-brand">2. Escolha a data e o horário</h2>
        {!completo || bloqueadas.length > 0 ? (
          <p className="text-sm text-muted-foreground">Anexe as notas e escolha o acondicionamento de cada uma para ver os horários.</p>
        ) : (
          <div className="space-y-3">
            {dias.map((d) => (
              <div key={d.data} className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 text-sm">
                  <span className="font-medium">{dataBR(d.data)} <span className="text-muted-foreground">{d.diaSemana}</span></span>
                  <span className="text-muted-foreground">Capacidade do dia: {d.capacidade}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {d.horarios.map((h) => {
                    const marcado = escolha?.data === d.data && escolha.horario === h.horario;
                    return (
                      <div key={h.horario} className="space-y-1">
                        <Button
                          variant={marcado ? "default" : "outline"}
                          className="w-full"
                          disabled={!h.livre}
                          aria-pressed={marcado}
                          onClick={() => setEscolha({ data: d.data, horario: h.horario })}
                        >
                          {h.livre ? <CalendarCheck /> : <Lock />} {h.horario}
                        </Button>
                        <p className="text-xs text-muted-foreground">{h.excecao ? `Exceção, ${h.excecao}. ` : ""}{h.livre ? `${h.ocupados} no horário` : h.motivo === "reservado_batido" ? "Reservado a carga batida" : h.motivo === "passado" ? "Já passou" : "Horário cheio"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {erro && (
        <Alert variant="destructive" title="Não foi possível agendar">
          {erro}
          {proxima && ` A próxima data disponível é ${dataBR(proxima.data)} às ${proxima.horario}.`}
          {proxima && (
            <Button className="mt-3 w-full sm:w-auto" size="sm" variant="outline" onClick={() => { setEscolha(proxima); setErro(null); }}>
              Escolher {dataBR(proxima.data)} às {proxima.horario}
            </Button>
          )}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button className="w-full sm:w-auto" size="lg" onClick={confirmar} loading={enviando} disabled={!completo || !escolha || bloqueadas.length > 0}>
          Confirmar agendamento
        </Button>
        {escolha && <Badge variant="info">{dataBR(escolha.data)} às {escolha.horario}</Badge>}
      </div>
    </div>
  );
}
