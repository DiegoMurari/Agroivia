"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Plus, Search, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";

import { chamar, postJson } from "./api";

interface Fornecedor {
  id: number;
  codigo: string | null;
  razaoSocial: string;
  cnpj: string | null;
}
interface Produto {
  id: number;
  item: string;
  descricao: string | null;
  unidade: string | null;
}
interface Item {
  produtoId: number | null;
  descricao: string;
  quantidade: string;
  unidade: string;
  pesoKg: string;
}

/** Botão "Nova compra" que abre o formulário em passos: 1 Fornecedor, 2 Itens, 3 Link gerado. */
export function NovaCompra() {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Fornecedor[]>([]);
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [novo, setNovo] = useState(false);
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [pedido, setPedido] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function buscarFornecedor() {
    const r = await chamar<Fornecedor[]>(`/api/agendamento/fornecedores?q=${encodeURIComponent(busca)}`);
    setAchados(r.data ?? []);
  }
  async function buscarProduto() {
    const r = await chamar<Produto[]>(`/api/agendamento/produtos?q=${encodeURIComponent(buscaProduto)}`);
    setProdutos(r.data ?? []);
  }
  function mudarItem(i: number, campo: keyof Item, valor: string) {
    setItens((atual) => atual.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  }

  async function criar() {
    setErro(null);
    if (!fornecedor && !(novo && razao.trim())) {
      setErro("Escolha um fornecedor do cadastro ou informe a razão social do novo.");
      return;
    }
    setEnviando(true);
    const r = await postJson<{ id: number; token: string }>("/api/agendamento/compras", {
      ...(fornecedor ? { fornecedorId: fornecedor.id } : { fornecedorNovo: { razaoSocial: razao, cnpj } }),
      numeroPedido: pedido || undefined,
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        descricao: i.descricao,
        quantidade: i.quantidade || null,
        unidade: i.unidade || null,
        pesoKg: i.pesoKg || null,
      })),
    });
    setEnviando(false);
    if (!r.ok || !r.data) {
      setErro(r.mensagem ?? "Não foi possível criar a compra.");
      return;
    }
    setLink(`${window.location.origin}/agendamento/agendar/${r.data.token}`);
    setPasso(3);
    router.refresh();
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  function limpar() {
    setPasso(1);
    setErro(null);
    setLink(null);
    setFornecedor(null);
    setNovo(false);
    setRazao("");
    setCnpj("");
    setPedido("");
    setItens([]);
    setBusca("");
    setAchados([]);
    setCopiado(false);
  }

  function fechar() {
    setAberto(false);
    if (link) limpar();
  }

  function continuar() {
    setErro(null);
    if (!fornecedor && !(novo && razao.trim())) {
      setErro("Escolha um fornecedor da lista ou informe a razão social do novo.");
      return;
    }
    setPasso(2);
  }

  const passos = ["Fornecedor", "Itens", "Link"];
  return (
    <>
      <Button onClick={() => setAberto(true)}>
        <Plus /> Nova compra
      </Button>
      <Dialog
        open={aberto}
        onClose={fechar}
        title="Nova compra"
        className="max-w-2xl"
        footer={
          passo === 1 ? (
            <>
              <Button variant="outline" onClick={fechar}>Cancelar</Button>
              <Button onClick={continuar}>Continuar</Button>
            </>
          ) : passo === 2 ? (
            <>
              <Button variant="outline" onClick={() => setPasso(1)}>Voltar</Button>
              <Button onClick={criar} loading={enviando}>Gerar link</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={limpar}>Criar outra compra</Button>
              <Button onClick={fechar}>Concluir</Button>
            </>
          )
        }
      >
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Passos">
          {passos.map((nome, i) => (
            <li key={nome} aria-current={passo === i + 1 ? "step" : undefined} className={passo === i + 1 ? "font-medium text-brand" : "text-muted-foreground"}>
              {i + 1} {nome}
            </li>
          ))}
        </ol>

        {erro && <Alert variant="destructive" title="Não foi possível continuar">{erro}</Alert>}

        {passo === 1 && (
          <div className="space-y-3">
            <Field label="Fornecedor" description="Busque por razão social, código ou CNPJ.">
              <div className="flex gap-2">
                <Input
                  value={fornecedor ? fornecedor.razaoSocial : busca}
                  onChange={(e) => {
                    setFornecedor(null);
                    setBusca(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && buscarFornecedor()}
                  disabled={novo}
                />
                <Button variant="outline" onClick={buscarFornecedor} disabled={novo}>
                  <Search /> Buscar
                </Button>
              </div>
            </Field>
            {!fornecedor && achados.length > 0 && !novo && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
                {achados.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="w-full px-3 py-2 text-left hover:bg-accent" onClick={() => setFornecedor(f)}>
                      {f.razaoSocial} <span className="text-muted-foreground">{f.codigo ?? "sem código"} {f.cnpj ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={novo}
                onChange={(e) => {
                  setNovo(e.target.checked);
                  setFornecedor(null);
                }}
              />
              Fornecedor novo, fora do cadastro
            </label>
            {novo && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Razão social" required>
                  <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
                </Field>
                <Field label="CNPJ">
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} inputMode="numeric" />
                </Field>
              </div>
            )}
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <Field label="Número do pedido de compra (se já tiver)">
              <Input value={pedido} onChange={(e) => setPedido(e.target.value)} />
            </Field>
            <div className="space-y-2">
              <Field label="Itens (opcional)" description="Sem itens, a conferência da nota é manual.">
                <div className="flex gap-2">
                  <Input value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarProduto()} />
                  <Button variant="outline" onClick={buscarProduto}>
                    <Search /> Buscar item
                  </Button>
                </div>
              </Field>
              {produtos.length > 0 && (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
                  {produtos.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                        onClick={() => {
                          setItens((a) => [...a, { produtoId: p.id, descricao: `${p.item} ${p.descricao ?? ""}`.trim(), quantidade: "", unidade: p.unidade ?? "", pesoKg: "" }]);
                          setProdutos([]);
                          setBuscaProduto("");
                        }}
                      >
                        <Plus className="size-4" /> {p.item} {p.descricao}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {itens.map((it, i) => (
                <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_6rem_5rem_6rem_auto]">
                  <Field label="Item">
                    <Input value={it.descricao} onChange={(e) => mudarItem(i, "descricao", e.target.value)} />
                  </Field>
                  <Field label="Quantidade">
                    <Input value={it.quantidade} onChange={(e) => mudarItem(i, "quantidade", e.target.value)} inputMode="decimal" />
                  </Field>
                  <Field label="Unidade">
                    <Input value={it.unidade} onChange={(e) => mudarItem(i, "unidade", e.target.value)} />
                  </Field>
                  <Field label="Peso (kg)">
                    <Input value={it.pesoKg} onChange={(e) => mudarItem(i, "pesoKg", e.target.value)} inputMode="decimal" />
                  </Field>
                  <Button variant="ghost" size="icon" aria-label="Remover item" onClick={() => setItens((a) => a.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {passo === 3 && link && (
          <div className="space-y-3">
            <Alert variant="success" title="Link gerado">Envie ao fornecedor. Ele vale para um único agendamento.</Alert>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={link} aria-label="Link do fornecedor" onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copiar} variant="outline">
                {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
