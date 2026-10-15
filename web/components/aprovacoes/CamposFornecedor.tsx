"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Input";
import { TIPOS_MERCADORIA } from "@/lib/aprovacoes/tipos";

export interface ValoresFornecedor {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  email: string;
  telefone: string;
  responsavel: string;
  endereco: string;
  tiposMercadoria: string[];
}

export const VAZIO: ValoresFornecedor = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "", email: "", telefone: "", responsavel: "", endereco: "", tiposMercadoria: [],
};

interface Props {
  valores: ValoresFornecedor;
  aoMudar: (v: ValoresFornecedor) => void;
  erros: Record<string, string>;
}

/** Campos do formulário B2B, usados no cadastro e na edição dos dados. */
export function CamposFornecedor({ valores, aoMudar, erros }: Props) {
  const texto = (campo: keyof ValoresFornecedor, label: string, extra: { required?: boolean; type?: string; ajuda?: string; autoComplete?: string } = {}) => (
    <Field label={label} required={extra.required} error={erros[campo]} description={extra.ajuda}>
      <Input
        name={campo}
        type={extra.type ?? "text"}
        autoComplete={extra.autoComplete}
        value={valores[campo] as string}
        onChange={(e) => aoMudar({ ...valores, [campo]: e.target.value })}
      />
    </Field>
  );
  const alternar = (tipo: string, marcado: boolean) =>
    aoMudar({ ...valores, tiposMercadoria: marcado ? [...valores.tiposMercadoria, tipo] : valores.tiposMercadoria.filter((t) => t !== tipo) });

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {texto("razaoSocial", "Razão social", { required: true })}
      {texto("nomeFantasia", "Nome fantasia")}
      {texto("cnpj", "CNPJ", { required: true, ajuda: "14 números, com ou sem pontos." })}
      {texto("inscricaoEstadual", "Inscrição estadual")}
      {texto("email", "E-mail", { required: true, type: "email", autoComplete: "email" })}
      {texto("telefone", "Telefone", { type: "tel" })}
      {texto("responsavel", "Responsável")}
      {texto("endereco", "Endereço")}
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Tipos de mercadoria que você fornece</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TIPOS_MERCADORIA.map((t) => (
            <Checkbox key={t} label={t} checked={valores.tiposMercadoria.includes(t)} onChange={(e) => alternar(t, e.target.checked)} />
          ))}
        </div>
        {erros.tiposMercadoria && (
          <p role="alert" className="text-sm text-destructive">
            {erros.tiposMercadoria}
          </p>
        )}
      </fieldset>
    </div>
  );
}
