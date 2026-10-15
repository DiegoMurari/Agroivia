"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, CalendarClock, CircleCheck, ClipboardCheck, DoorOpen, Gauge, History, Hash, Layers, LogIn, LogOut, Megaphone, Package, PackageCheck, ShieldAlert, ShieldCheck, TimerReset, Timer, Truck, Weight, Warehouse, type LucideIcon } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { resumoNf } from "@/lib/agendamento/resumo";
import { HistoricoPlaca } from "./HistoricoPlaca";
import { AvisarAtraso } from "./AvisarAtraso";
import { dataBR } from "@/lib/agendamento/datas";
import { cn } from "@/lib/utils";
import { numeroDoAgendamento } from "@/lib/agendamento/numero";
import type { DetalheDescarga } from "@/lib/agendamento/descarga";

import { postJson } from "./api";

interface Props {
  detalhe: DetalheDescarga;
  armazens: { id: number; nome: string }[];
  equipamentos: { id: number; armazemId: number; nome: string | null; disponivel: number }[];
  /** Instante do servidor (relógio da demo). O cronômetro parte dele, nunca do relógio do navegador. */
  agora: string;
  atraso: { atrasado: boolean; minutos: number };
  avisos: { id: number; mensagem: string | null; criadoEm: string }[];
  alertasDia: { tipo: string; mensagem: string }[];
  elegivelPrioridade: boolean;
  atrasoAvisado: { previsao: string; motivo: string; por: string; avisadoEm: string } | null;
}

const ROTULO_STATUS: Record<string, string> = {
  agendado: "Agendado",
  chegou: "Chegou",
  em_descarga: "Em descarga",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_recebido: "Não recebido",
};
const ROTULO_VALIDACAO: Record<string, string> = { aguardando: "Aguardando pedido", conforme: "Conforme", divergente: "Divergente" };

function hora(iso: string | null): string {
  return iso ? iso.slice(11, 16) : "-";
}

/** Cartão de uma etapa da descarga, no mesmo estilo de Cadastros: branco, ícone em círculo azul-claro e título azul. */
function Bloco({ icone: Icone, titulo, i = 0, children }: { icone: LucideIcon; titulo: string; i?: number; children: React.ReactNode }) {
  return (
    <section data-bloco={i} className="grid gap-3 rounded-xl border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-3 text-h3 text-brand">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <Icone className="size-5" aria-hidden="true" />
        </span>
        {titulo}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Um dado do resumo: ícone, rótulo e valor, em bloco colorido. */
function Dado({ icone: Icone, rotulo, valor, destaque }: { icone: LucideIcon; rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cn("group flex items-center gap-3 rounded-xl border p-3 transition-[transform,box-shadow] duration-200 ease-out-expo hover:-translate-y-0.5 hover:shadow-elevated", destaque ? "border-brand/30 bg-brand/10" : "bg-muted/40")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
        <p className="truncate text-base font-semibold">{valor}</p>
      </div>
    </div>
  );
}

const ICONE_EVENTO: Record<string, LucideIcon> = {
  agendado: CalendarClock,
  validado: ShieldCheck,
  autorizado: ClipboardCheck,
  destino_definido: Warehouse,
  chegou: Truck,
  entrada: LogIn,
  saida: LogOut,
  concluido: CircleCheck,
  desfeito: TimerReset,
  cancelado: ShieldAlert,
  atraso: Megaphone,
};

function Cronometro({ desde, agora }: { desde: string; agora: string }) {
  // parte do instante do servidor (relógio da demo); o navegador só mede o tempo decorrido
  const [seg, setSeg] = useState(() => Math.max(0, Math.floor((Date.parse(agora) - Date.parse(desde)) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setSeg((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(seg / 60)).padStart(2, "0");
  const ss = String(seg % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 font-mono tabular-nums" aria-label="Tempo em descarga">
      <Timer className="size-4" /> {mm}:{ss}
    </span>
  );
}

export function Descarga({ detalhe: d, armazens, equipamentos, agora, atraso, avisos, alertasDia, atrasoAvisado, elegivelPrioridade }: Props) {
  const router = useRouter();
  const ag = d.agendamento;
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [placa, setPlaca] = useState(ag.placa ?? "");
  const [balanca, setBalanca] = useState("");
  const [valStatus, setValStatus] = useState(ag.validacaoStatus === "aguardando" ? d.validacao.sugestao : ag.validacaoStatus);
  const [valObs, setValObs] = useState(ag.validacaoObs ?? d.validacao.alertas.map((a) => a.mensagem).join(" "));
  const [destino, setDestino] = useState<number[]>(
    (d.armazens.length ? d.armazens.map((a) => a.armazemId) : d.sugestaoArmazemIds).filter((x) => armazens.some((a) => a.id === x)),
  );
  const [saida, setSaida] = useState<Record<number, { chapas: string; equip: number[]; peso: string }>>({});
  const [pendDescricao, setPendDescricao] = useState("");
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [fortData, setFortData] = useState("");
  const [fortHorario, setFortHorario] = useState("");
  const [fortMotivo, setFortMotivo] = useState("");
  const [prioData, setPrioData] = useState("");
  const [prioHorario, setPrioHorario] = useState("");
  const [prioMotivo, setPrioMotivo] = useState("");
  const [nrMotivo, setNrMotivo] = useState("divergencia_nota_pedido");
  const [nrDescricao, setNrDescricao] = useState("");

  async function agir(corpo: Record<string, unknown>) {
    setErro(null);
    setOcupado(true);
    const r = await postJson(`/api/agendamento/descarga/${ag.id}`, corpo);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.mensagem ?? "Não foi possível registrar.");
      return false;
    }
    router.refresh();
    return true;
  }

  const encerrado = ag.status === "cancelado" || ag.status === "nao_recebido";
  const concluido = ag.status === "concluido";
  const aberta = !encerrado && !concluido;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {numeroDoAgendamento(ag.id, ag.criadoEm)} · {dataBR(ag.data)} às {ag.horario}
              </p>
              <p className="text-h3 break-words text-brand">{d.fornecedor.razaoSocial}</p>
            </div>
          </div>
          <Badge variant={concluido ? "success" : encerrado ? "destructive" : ag.status === "agendado" ? "outline" : "info"}>
            {concluido ? <CircleCheck /> : <Truck />} {ROTULO_STATUS[ag.status]}
          </Badge>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Dado icone={Hash} rotulo="Placa" valor={ag.placa ?? "não informada"} destaque />
          <Dado icone={Weight} rotulo="Peso declarado" valor={ag.pesoDeclaradoKg ? `${ag.pesoDeclaradoKg.replace(".", ",")} kg` : "-"} />
          <Dado icone={Layers} rotulo="Ocupação" valor={ag.acondicionamentoOcupacao === "batido" ? "Carga solta" : "Paletes ou big bag"} />
          <Dado icone={DoorOpen} rotulo="Chegada" valor={hora(ag.chegadaEm)} />
          <Dado icone={PackageCheck} rotulo="Liberação" valor={hora(ag.liberacaoEm)} />
          <Dado icone={Gauge} rotulo="Peso da balança" valor={ag.pesoBalancaKg ? `${ag.pesoBalancaKg.replace(".", ",")} kg` : "-"} />
        </dl>
      </section>

      {erro && <Alert variant="destructive" title="Não foi possível registrar">{erro}</Alert>}

      {ag.chapasPrevistas !== null && (
        <p className="text-sm" data-testid="previsto">
          Previsto pela norma: <strong>{ag.chapasPrevistas} funcionário(s)</strong>
          {ag.empilhadeiraPrevista ? " e empilhadeira" : ", sem empilhadeira"}
          {ag.duracaoPrevistaMin ? `, cerca de ${ag.duracaoPrevistaMin} min` : ""}.
        </p>
      )}
      {atrasoAvisado && (
        <Alert variant="warning" title="Atraso avisado">
          {atrasoAvisado.por === "fornecedor" ? "O fornecedor" : "A portaria"} avisou às {atrasoAvisado.avisadoEm.slice(11, 16)}: previsão de chegada {atrasoAvisado.previsao}. Motivo: {atrasoAvisado.motivo}.
        </Alert>
      )}
      {alertasDia.map((a, i) => (
        <Alert key={i} variant="warning" title={a.tipo === "colaborador" ? "Falta de colaborador" : a.tipo === "equipamento" ? "Falta de equipamento" : "Falta de espaço"}>
          {a.mensagem}
        </Alert>
      ))}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Bloco icone={Boxes} titulo="Carga" i={1}>
        {d.nfs.map((n) => (
          <div key={n.id} className="rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{resumoNf(n)}</span>
            </div>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {n.itens.map((i, k) => (
                <li key={k}>{i.descricao}: {i.quantidade?.replace(".", ",") ?? "?"} {i.unidade ?? ""}</li>
              ))}
            </ul>
            {d.arquivos.filter((a) => a.notaFiscalId === n.id).map((a) => (
              <a key={a.id} className="mt-2 inline-block text-brand underline" href={`/api/agendamento/arquivos/${a.id}`}>Baixar {a.nome}</a>
            ))}
          </div>
        ))}
        {d.itensCompra.length > 0 && (
          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="font-medium">Itens do pedido de compra{d.compra?.numeroPedido ? ` ${d.compra.numeroPedido}` : ""}</div>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {d.itensCompra.map((i) => (
                <li key={i.id}>{i.descricao}: {i.quantidade?.replace(".", ",") ?? "?"} {i.unidade ?? ""} {i.pesoKg ? `(${i.pesoKg.replace(".", ",")} kg)` : ""}</li>
              ))}
            </ul>
          </div>
        )}
      </Bloco>

      <Bloco icone={ShieldCheck} titulo="Validação NF x pedido (Compras)" i={2}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Situação: <Badge variant={ag.validacaoStatus === "conforme" ? "success" : ag.validacaoStatus === "divergente" ? "warning" : "outline"}>{ROTULO_VALIDACAO[ag.validacaoStatus]}</Badge>
          {ag.validadoPor && <span className="text-muted-foreground">por {ag.validadoPor}, {hora(ag.validadoEm)}</span>}
        </div>
        {d.validacao.alertas.map((a, i) => (
          <Alert key={i} variant="warning" title={`Alerta de ${a.tipo}`}>{a.mensagem}</Alert>
        ))}
        {d.itensCompra.length === 0 && <Alert variant="info">A compra não tem itens: a validação é manual.</Alert>}
        {aberta && <Alert variant="info" title="Como decidir uma divergência">
          Se veio tudo errado, não receba: registre não recebimento por divergência entre nota e pedido (em Desvios). Se veio pouco errado, receba com pendência:
          autorize a carga e a pendência abre sozinha. Ela se resolve com a nota de devolução do que veio errado ou faltando. Na maioria dos casos, Compras barra antes da chegada.
        </Alert>}
        {aberta && (
          <div className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
            <Field label="Resultado">
              <Select value={valStatus} onChange={(e) => setValStatus(e.target.value as typeof valStatus)}>
                <option value="conforme">Conforme</option>
                <option value="divergente">Divergente</option>
                <option value="aguardando">Aguardando pedido</option>
              </Select>
            </Field>
            <Field label="Observação">
              <Input value={valObs} onChange={(e) => setValObs(e.target.value)} />
            </Field>
            <Button variant="outline" disabled={ocupado} onClick={() => agir({ acao: "validar", status: valStatus, obs: valObs })}>Registrar validação</Button>
          </div>
        )}
      </Bloco>

      {(aberta || ag.autorizadoEm) && <Bloco icone={ClipboardCheck} titulo="Autorização e destino (responsável)" i={3}>
        {ag.autorizadoEm ? (
          <p className="text-sm">Autorizada por {ag.autorizadoPor} às {hora(ag.autorizadoEm)}.</p>
        ) : (
          aberta && (
            <div className="space-y-2">
              {ag.validacaoStatus === "divergente" && <Alert variant="warning" title="Validação divergente">Use só se a divergência for pequena. Autorizar aceita a carga e abre uma pendência, a resolver com a nota de devolução parcial. Se veio tudo errado, registre não recebimento em Desvios.</Alert>}
              <Button className="w-full sm:w-auto" disabled={ocupado} onClick={() => agir({ acao: "autorizar" })}>Autorizar carga</Button>
            </div>
          )
        )}
        {aberta && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Armazéns de destino</legend>
            {d.sugestaoArmazemIds.length > 0 && <p className="text-xs text-muted-foreground">Sugestão pelo grupo dos itens da compra já marcada.</p>}
            <div className="grid gap-3 sm:grid-cols-4">
              {armazens.map((a) => (
                <Checkbox
                  key={a.id}
                  label={a.nome}
                  checked={destino.includes(a.id)}
                  onChange={(e) => setDestino((atual) => (e.target.checked ? [...atual, a.id] : atual.filter((x) => x !== a.id)))}
                />
              ))}
            </div>
            <Button variant="outline" disabled={ocupado || destino.length === 0} onClick={() => agir({ acao: "destino", armazemIds: destino })}>Definir destino</Button>
          </fieldset>
        )}
      </Bloco>}

      {(ag.chegadaEm || ag.status === "agendado") && <Bloco icone={Truck} titulo="Chegada (portaria)" i={4}>
        {ag.chegadaEm ? (
          <p className="text-sm">Chegou às {hora(ag.chegadaEm)}. Placa {ag.placa ?? "-"}.</p>
        ) : (
          ag.status === "agendado" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Placa">
                <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} autoCapitalize="characters" />
              </Field>
              <Field label={d.exigePesoBalanca ? `Peso da balança (kg), obrigatório acima de ${d.limitePesoKg} kg` : "Peso da balança (kg)"} required={d.exigePesoBalanca}>
                <Input value={balanca} onChange={(e) => setBalanca(e.target.value)} inputMode="decimal" />
              </Field>
              <div className="sm:col-span-3"><HistoricoPlaca placa={placa} excluirId={ag.id} /></div>
              <Button size="lg" className="w-full sm:w-auto" disabled={ocupado} onClick={() => agir({ acao: "chegada", placa, pesoBalancaKg: balanca })}>
                <Truck /> Registrar chegada
              </Button>
            </div>
          )
        )}
      </Bloco>}

      <Bloco icone={Warehouse} titulo="Descarga por armazém" i={5}>
        {d.armazens.length === 0 && (
          <p className="text-sm text-muted-foreground">{encerrado ? "Esta carga não foi descarregada." : "Defina o destino para registrar entrada e saída."}</p>
        )}
        {d.armazens.map((a) => {
          const s = saida[a.armazemId] ?? { chapas: "", equip: [], peso: "" };
          const equips = equipamentos.filter((e) => e.armazemId === a.armazemId);
          return (
            <div key={a.id} className="space-y-3 rounded-xl border bg-muted/40 p-4 transition-shadow duration-200 hover:shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="text-base font-medium">{a.nome}</span>
                <span className="text-sm text-muted-foreground">
                  Entrada {hora(a.entradaEm)} · Saída {hora(a.saidaEm)}
                  {a.chapasQtd !== null && ` · ${a.chapasQtd} ${a.chapasQtd === 1 ? "funcionário" : "funcionários"}`}
                </span>
              </div>
              {a.entradaEm && !a.saidaEm && <div className="text-lg"><Cronometro desde={a.entradaEm} agora={agora} /></div>}
              {!a.entradaEm && (ag.status === "chegou" || ag.status === "em_descarga") && (
                <Button size="lg" className="w-full sm:w-auto" disabled={ocupado} onClick={() => agir({ acao: "entrada", armazemId: a.armazemId })}>
                  <LogIn /> Registrar entrada
                </Button>
              )}
              {a.entradaEm && !a.saidaEm && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Funcionários que atuaram">
                      <Input value={s.chapas} onChange={(e) => setSaida({ ...saida, [a.armazemId]: { ...s, chapas: e.target.value } })} inputMode="numeric" />
                    </Field>
                    <Field label="Peso descarregado neste armazém (kg), opcional">
                      <Input value={s.peso} onChange={(e) => setSaida({ ...saida, [a.armazemId]: { ...s, peso: e.target.value } })} inputMode="decimal" />
                    </Field>
                  </div>
                  {equips.length > 0 && (
                    <fieldset className="space-y-1">
                      <legend className="text-sm font-medium">Equipamentos usados</legend>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {equips.map((e) => (
                          <Checkbox
                            key={e.id}
                            label={e.nome ?? `Equipamento ${e.id}`}
                            checked={s.equip.includes(e.id)}
                            onChange={(ev) =>
                              setSaida({ ...saida, [a.armazemId]: { ...s, equip: ev.target.checked ? [...s.equip, e.id] : s.equip.filter((x) => x !== e.id) } })
                            }
                          />
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <Button
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={ocupado || s.chapas.trim() === ""}
                    onClick={() => agir({ acao: "saida", armazemId: a.armazemId, chapasQtd: Number(s.chapas), equipamentoIds: s.equip, pesoKg: s.peso || null })}
                  >
                    <LogOut /> Registrar saída
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Bloco>

      <Bloco icone={Package} titulo="Pendências" i={6}>
        {d.pendencias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência.</p>}
        {d.pendencias.map((p) => (
          <div key={p.id} className="rounded-xl border bg-muted/40 p-3 text-sm">
            <Badge variant={p.status === "aberta" ? "warning" : "success"}>{p.status === "aberta" ? "Aberta" : "Resolvida"}</Badge> {p.descricao}
            {p.resolucao && <p className="mt-1 text-muted-foreground">Resolução: {p.resolucao}</p>}
          </div>
        ))}
        {!encerrado && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Nova pendência">
              <Textarea rows={2} value={pendDescricao} onChange={(e) => setPendDescricao(e.target.value)} />
            </Field>
            <Button
              variant="outline"
              disabled={ocupado || pendDescricao.trim() === ""}
              onClick={async () => {
                if (await agir({ acao: "pendencia", tipo: "outra", descricao: pendDescricao })) setPendDescricao("");
              }}
            >
              Abrir pendência
            </Button>
          </div>
        )}
      </Bloco>

      {(ag.status === "agendado" || ag.status === "chegou") && (
        <Bloco icone={ShieldAlert} titulo="Desvios" i={7}>
          {ag.status === "agendado" && <AvisarAtraso agendamentoId={ag.id} />}
          {atraso.atrasado && (
            <Alert variant="warning" title={`Atrasado há ${atraso.minutos} min`}>
              O fornecedor é avisado na tela do link. Nada muda sem o seu clique.
              <Button className="mt-3 w-full sm:w-auto" size="sm" disabled={ocupado} onClick={() => agir({ acao: "remarcar_atraso" })}>Remarcar para o próximo horário livre</Button>
            </Alert>
          )}
          {ag.status === "agendado" && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Cancelar agendamento (motivo)" description="A vaga fica liberada para outro agendamento.">
                  <Input value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
                </Field>
                <Button className="w-full sm:w-auto" variant="destructive" disabled={ocupado || cancelMotivo.trim() === ""} onClick={() => agir({ acao: "cancelar", motivo: cancelMotivo })}>Cancelar agendamento</Button>
              </div>
              {elegivelPrioridade && (
                <div className="grid gap-3 sm:grid-cols-[10rem_8rem_1fr_auto] sm:items-end">
                  <Field label="Prioridade (defensivo ou fertilizante): data" description="Exceção ao limite do horário (D23).">
                    <Input type="date" value={prioData} onChange={(e) => setPrioData(e.target.value)} />
                  </Field>
                  <Field label="Horário">
                    <Input value={prioHorario} onChange={(e) => setPrioHorario(e.target.value)} placeholder="08:00" />
                  </Field>
                  <Field label="Justificativa (obrigatória)" required>
                    <Input value={prioMotivo} onChange={(e) => setPrioMotivo(e.target.value)} />
                  </Field>
                  <Button className="w-full sm:w-auto" variant="outline" disabled={ocupado || !prioData || !prioHorario || prioMotivo.trim() === ""} onClick={() => agir({ acao: "prioridade", data: prioData, horario: prioHorario, motivo: prioMotivo })}>
                    Aplicar prioridade
                  </Button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[10rem_8rem_1fr_auto] sm:items-end">
                <Field label="Reagendar por caso fortuito: data">
                  <Input type="date" value={fortData} onChange={(e) => setFortData(e.target.value)} />
                </Field>
                <Field label="Horário">
                  <Input value={fortHorario} onChange={(e) => setFortHorario(e.target.value)} placeholder="08:00" />
                </Field>
                <Field label="Motivo do caso fortuito" description="Ignora só o limite de ocupação do horário.">
                  <Input value={fortMotivo} onChange={(e) => setFortMotivo(e.target.value)} />
                </Field>
                <Button className="w-full sm:w-auto" variant="outline" disabled={ocupado || !fortData || !fortHorario || fortMotivo.trim() === ""} onClick={() => agir({ acao: "reagendar", data: fortData, horario: fortHorario, motivo: fortMotivo })}>Reagendar</Button>
              </div>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-[16rem_1fr_auto] sm:items-end">
            <Field label="Não recebimento: motivo">
              <Select value={nrMotivo} onChange={(e) => setNrMotivo(e.target.value)}>
                <option value="divergencia_nota_pedido">Divergência entre nota e pedido</option>
                <option value="caso_fortuito">Caso fortuito</option>
                <option value="outro">Outro</option>
              </Select>
            </Field>
            <Field label={nrMotivo === "outro" ? "Descrição (obrigatória)" : "Descrição"} required={nrMotivo === "outro"}>
              <Input value={nrDescricao} onChange={(e) => setNrDescricao(e.target.value)} />
            </Field>
            <Button className="w-full sm:w-auto" variant="destructive" disabled={ocupado || (nrMotivo === "outro" && nrDescricao.trim() === "")} onClick={() => agir({ acao: "nao_recebimento", motivo: nrMotivo, descricao: nrDescricao })}>Registrar não recebimento</Button>
          </div>
        </Bloco>
      )}

      {avisos.length > 0 && (
        <Bloco icone={Megaphone} titulo="Avisos ao fornecedor" i={8}>
          {avisos.map((a) => (
            <p key={a.id} className="text-sm">{a.criadoEm.slice(11, 16)} · {a.mensagem}</p>
          ))}
        </Bloco>
      )}

      </div>
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      <Bloco icone={History} titulo="Histórico" i={9}>
        <ol className="relative space-y-3 border-l-2 border-brand/20 pl-6">
          {[...d.eventos]
            .sort((x, y) => x.criadoEm.localeCompare(y.criadoEm) || x.id - y.id)
            .map((e) => {
              const Icone = ICONE_EVENTO[e.tipo] ?? Timer;
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[2.2rem] grid size-7 place-items-center rounded-full border-2 border-card bg-brand text-brand-foreground shadow-card">
                    <Icone className="size-3.5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold capitalize">{e.tipo.replace(/_/g, " ")}</p>
                  <p className="text-sm text-muted-foreground">
                    {dataBR(e.criadoEm.slice(0, 10)).slice(0, 5)} às {e.criadoEm.slice(11, 16)} · {e.autor}
                  </p>
                </li>
              );
            })}
        </ol>
      </Bloco>
      </aside>
      </div>
    </div>
  );
}
