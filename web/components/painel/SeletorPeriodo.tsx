import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Filtro } from "@/lib/painel/consultas";

interface Props {
  filtro: Filtro;
  /** Meses da folha (YYYY-MM) para o seletor de mês. */
  meses: string[];
}

const ATALHOS: { rotulo: string; periodo: string; tipo: Filtro["tipo"] }[] = [
  { rotulo: "Safra", periodo: "safra", tipo: "safra" },
  { rotulo: "Entressafra", periodo: "entressafra", tipo: "entressafra" },
  { rotulo: "Tudo", periodo: "tudo", tipo: "tudo" },
];

/** Seletor de período sem JavaScript no cliente: links para safra, entressafra e tudo, e um formulário GET para mês ou semana. */
export function SeletorPeriodo({ filtro, meses }: Props) {
  return (
    <div className="flex flex-col gap-4" role="group" aria-label="Período da análise">
      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((a) => (
          <Button key={a.periodo} asChild size="sm" variant={filtro.tipo === a.tipo ? "default" : "outline"}>
            <Link href={`/painel?periodo=${a.periodo}`} aria-current={filtro.tipo === a.tipo ? "true" : undefined}>
              {a.rotulo}
            </Link>
          </Button>
        ))}
      </div>
      <form method="get" action="/painel" className="flex flex-wrap items-end gap-3">
        <Field label="Mês">
          <Select name="periodo" defaultValue={filtro.tipo === "mes" ? filtro.anoMes : ""} size="sm">
            <option value="">Escolher</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Semana (qualquer dia dela)">
          <Input type="date" name="semana" size="sm" />
        </Field>
        <Button type="submit" size="sm" variant="secondary">
          Aplicar
        </Button>
      </form>
    </div>
  );
}
