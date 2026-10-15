"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Search } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { dataBR } from "@/lib/agendamento/datas";
import { formatBRL, formatNumero } from "@/lib/money";

import { chamar, postJson } from "./api";
import { HistoricoPlaca } from "./HistoricoPlaca";

interface Fornecedor {
  id: number;
  codigo: string | null;
  razaoSocial: string;
}
type Vaga = { data: string; horario: string };
type Resultado =
  | { agendado: true; agendamentoId: number; vaga: Vaga }
  | { agendado: false; naoRecebimentoId: number; proxima: Vaga | null };

/** O que o XML da nota trouxe: tudo o que dá para preencher no pedido. */
export interface NotaDoXml {
  numero: string | null;
  serie?: string | null;
  emitenteNome: string | null;
  emitenteCnpj: string | null;
  emitidaEm?: string | null;
  valorTotal?: string | null;
  pesoBrutoKg?: string | null;
  pesoLiquidoKg?: string | null;
  volumes?: string | null;
  especie?: string | null;
  placa: string | null;
  transportadora?: string | null;
  pedidoFornecedor?: string | null;
  acondicionamentoSugerido?: "batido" | "paletizado" | "big_bag" | null;
  itens?: { descricao: string | null; quantidade: string | null; unidade: string | null; valorUnitario?: string | null }[];
}

interface Props {
  /** Dados lidos do XML: preenchem fornecedor, placa, acondicionamento, peso e a lista de itens do pedido. */
  nota?: NotaDoXml | null;
  /** O próprio XML, enviado junto para a nota ficar gravada no pedido criado na hora. */
  arquivo?: File | null;
  /** Chave de 44 números lida pela câmera ou digitada: o servidor busca a nota completa por ela. */
  chave?: string | null;
  /** Fornecedor da nota: CNPJ e placa já preenchidos quando a conferência não achou agendamento. */
  cnpj?: string;
  nomeEmitente?: string;
  placaInicial?: string;
  /** A portaria não tem acesso à descarga: sem o link. */
  podeAbrirDescarga?: boolean;
}

export function Portaria({ cnpj, nomeEmitente, placaInicial = "", nota = null, arquivo = null, chave = null, podeAbrirDescarga = true }: Props = {}) {
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Fornecedor[]>([]);
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [placa, setPlaca] = useState(placaInicial);
  const [acond, setAcond] = useState(nota?.acondicionamentoSugerido === "paletizado" || nota?.acondicionamentoSugerido === "big_bag" ? "unitizado" : nota?.acondicionamentoSugerido === "batido" ? "batido" : "unitizado");
  const [peso, setPeso] = useState(() => (nota ? (nota.pesoLiquidoKg ?? nota.pesoBrutoKg ?? "") : ""));
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!cnpj) return;
    let ativo = true;
    void (async () => {
      const r = await chamar<Fornecedor[]>(`/api/agendamento/fornecedores?q=${encodeURIComponent(cnpj)}`);
      if (ativo && r.data && r.data.length === 1) setFornecedor(r.data[0]);
      else if (ativo && r.data && r.data.length > 1) setAchados(r.data);
      else if (ativo) setBusca(nomeEmitente ?? "");
    })();
    return () => {
      ativo = false;
    };
  }, [cnpj, nomeEmitente]);

  async function buscar() {
    const r = await chamar<Fornecedor[]>(`/api/agendamento/fornecedores?q=${encodeURIComponent(busca)}`);
    setAchados(r.data ?? []);
  }

  async function enviar() {
    if (!fornecedor) return;
    setErro(null);
    setRes(null);
    setOcupado(true);
    let r;
    if (arquivo || (nota && chave)) {
      // com o XML (ou a chave, que traz o XML): o pedido nasce com a nota gravada
      const form = new FormData();
      form.append("fornecedorId", String(fornecedor.id));
      form.append("placa", placa);
      form.append("acondicionamento", acond);
      form.append("pesoKg", peso);
      if (arquivo) form.append("arquivo", arquivo);
      else if (chave) form.append("chave", chave);
      r = await chamar<Resultado>("/api/agendamento/portaria", { method: "POST", body: form });
    } else r = await postJson<Resultado>("/api/agendamento/portaria", { fornecedorId: fornecedor.id, placa: placa || null, acondicionamento: acond, pesoKg: peso || null });
    setOcupado(false);
    if (r.ok && r.data) setRes(r.data);
    else setErro(r.mensagem ?? "Não foi possível registrar.");
  }

  return (
    <div className="space-y-5">
      {nota && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="mb-3 flex items-center gap-2 text-base font-semibold">
            <FileText className="size-5 text-brand" aria-hidden="true" /> Pedido preenchido com os dados do XML
          </p>
          <dl className="grid gap-x-6 gap-y-2 text-base sm:grid-cols-2">
            <Dado rotulo="Nota fiscal" valor={nota.numero ? `${nota.numero}${nota.serie ? ` · série ${nota.serie}` : ""}` : null} />
            <Dado rotulo="Emitida em" valor={nota.emitidaEm ? dataBR(nota.emitidaEm.slice(0, 10)) : null} />
            <Dado rotulo="Fornecedor" valor={nota.emitenteNome} />
            <Dado rotulo="CNPJ" valor={nota.emitenteCnpj} />
            <Dado rotulo="Valor total" valor={nota.valorTotal ? formatBRL(nota.valorTotal) : null} />
            <Dado rotulo="Pedido do fornecedor" valor={nota.pedidoFornecedor ?? null} />
            <Dado rotulo="Peso bruto" valor={nota.pesoBrutoKg ? `${formatNumero(nota.pesoBrutoKg, 2)} kg` : null} />
            <Dado rotulo="Peso líquido" valor={nota.pesoLiquidoKg ? `${formatNumero(nota.pesoLiquidoKg, 2)} kg` : null} />
            <Dado rotulo="Volumes" valor={nota.volumes ? `${formatNumero(nota.volumes, 0)}${nota.especie ? ` · ${nota.especie}` : ""}` : (nota.especie ?? null)} />
            <Dado rotulo="Transportadora" valor={nota.transportadora ?? null} />
          </dl>
          {nota.itens && nota.itens.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-1 text-sm font-medium text-muted-foreground">Itens ({nota.itens.length})</p>
              <ul className="divide-y text-base">
                {nota.itens.map((i, n) => (
                  <li key={n} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5">
                    <span className="break-words">{i.descricao ?? "item sem descrição"}</span>
                    <span className="tabular-nums text-muted-foreground">{i.quantidade ? `${formatNumero(i.quantidade, 2)} ${i.unidade ?? ""}` : "-"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <Field label="Fornecedor" description="Busque por razão social, código ou CNPJ.">
        <div className="flex gap-2">
          <Input
            value={fornecedor ? fornecedor.razaoSocial : busca}
            onChange={(e) => {
              setFornecedor(null);
              setBusca(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
          />
          <Button variant="outline" onClick={buscar}>
            <Search /> Buscar
          </Button>
        </div>
      </Field>
      {!fornecedor && achados.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {achados.map((f) => (
            <li key={f.id}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-accent" onClick={() => setFornecedor(f)}>
                {f.razaoSocial} <span className="text-muted-foreground">{f.codigo ?? "sem código"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Placa">
          <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Acondicionamento da carga" description="Batido reserva o horário inteiro.">
          <Select value={acond} onChange={(e) => setAcond(e.target.value)}>
            <option value="unitizado">Paletizado ou big bag</option>
            <option value="batido">Batido</option>
          </Select>
        </Field>
      </div>
      <Field label="Peso declarado (kg)" description={nota ? "Veio da nota. Corrija se a balança marcar outro valor." : "Opcional."}>
        <Input value={peso} inputMode="decimal" onChange={(e) => setPeso(e.target.value)} />
      </Field>
      <HistoricoPlaca placa={placa} />
      {erro && <Alert variant="destructive" title="Não foi possível registrar">{erro}</Alert>}
      <Button size="lg" disabled={!fornecedor || ocupado || res !== null} onClick={enviar}>
        Verificar vaga hoje
      </Button>
      {res?.agendado && (
        <Alert variant="success" title="Agendado na hora">
          Vaga hoje às {res.vaga.horario}. Chegada já registrada.{" "}
          {podeAbrirDescarga && <Link className="underline" href={`/agendamento/descarga/${res.agendamentoId}`}>Abrir a descarga</Link>}
        </Alert>
      )}
      {res && !res.agendado && (
        <Alert variant="warning" title="Sem vaga hoje">
          Registrado como não recebimento (sem agendamento e sem vaga).{" "}
          {res.proxima ? `Próxima data disponível: ${dataBR(res.proxima.data)} às ${res.proxima.horario}.` : "Não há vaga nos próximos dias."}
        </Alert>
      )}
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium break-words">{valor}</dd>
    </div>
  );
}
