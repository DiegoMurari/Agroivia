/**
 * Barras agrupadas em SVG, sem biblioteca e sem JavaScript no cliente (componente de servidor).
 * Usado pela página /painel (excesso e falta por mês; cargas por mês). As cores vêm dos tokens chart-1 e chart-2.
 * Os números só viram coordenadas aqui; o cálculo continua em lib/money. Toda série leva nome na legenda e valor no rótulo.
 */
import type { ReactNode } from "react";

export interface SerieBarras {
  nome: string;
  /** Token CSS, por exemplo "var(--chart-1)". */
  cor: string;
}

export interface CategoriaBarras {
  rotulo: string;
  /** Um valor por série, na mesma ordem. Null = sem dado: a barra não é desenhada e o rótulo diz "sem dado". */
  valores: (number | null)[];
  /** Texto de cada valor (já formatado em pt-BR). */
  textos: (string | null)[];
}

interface Props {
  titulo: string;
  descricao: string;
  unidade: string;
  series: SerieBarras[];
  categorias: CategoriaBarras[];
  vazio?: ReactNode;
}

const LARGURA_CATEGORIA = 84;
const ALTURA = 220;
const MARGEM = { topo: 16, base: 44, esquerda: 8, direita: 8 };

export function GraficoBarras({ titulo, descricao, unidade, series, categorias, vazio }: Props) {
  const presentes = categorias.flatMap((c) => c.valores.filter((v): v is number => v !== null));
  // Todos zero é dado válido (barras de altura mínima com rótulo 0); só a ausência de valores é "sem dado".
  const maximo = Math.max(1e-9, ...presentes);
  if (categorias.length === 0 || presentes.length === 0) return <>{vazio ?? <p className="text-sm text-muted-foreground">Sem dado para o gráfico.</p>}</>;

  const largura = MARGEM.esquerda + MARGEM.direita + categorias.length * LARGURA_CATEGORIA;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  const larguraBarra = (LARGURA_CATEGORIA - 14) / series.length;
  const resumo = categorias
    .map((c) => `${c.rotulo}: ${series.map((s, i) => `${s.nome} ${c.textos[i] ?? "sem dado"}`).join(", ")}`)
    .join("; ");

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-col gap-1">
        <span className="text-h3">{titulo}</span>
        <span className="text-sm text-muted-foreground">{descricao}</span>
        <span className="flex flex-wrap gap-4 text-sm" aria-hidden="true">
          {series.map((s) => (
            <span key={s.nome} className="inline-flex items-center gap-2">
              <svg width="12" height="12" aria-hidden="true">
                <rect width="12" height="12" rx="2" fill={s.cor} />
              </svg>
              {s.nome}
            </span>
          ))}
          <span className="text-muted-foreground">Unidade: {unidade}</span>
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg role="img" aria-label={`${titulo}. ${resumo}`} width={largura} height={ALTURA} viewBox={`0 0 ${largura} ${ALTURA}`} className="max-w-none">
          <line
            x1={MARGEM.esquerda}
            x2={largura - MARGEM.direita}
            y1={MARGEM.topo + alturaUtil}
            y2={MARGEM.topo + alturaUtil}
            stroke="var(--border)"
          />
          {categorias.map((c, ci) => {
            const x0 = MARGEM.esquerda + ci * LARGURA_CATEGORIA + 7;
            return (
              <g key={c.rotulo}>
                {c.valores.map((v, si) => {
                  const x = x0 + si * larguraBarra;
                  if (v === null) {
                    return (
                      <text key={series[si].nome} x={x + larguraBarra / 2} y={MARGEM.topo + alturaUtil - 4} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">
                        sem dado
                      </text>
                    );
                  }
                  const h = (v / maximo) * alturaUtil;
                  return (
                    <g key={series[si].nome}>
                      <rect x={x} y={MARGEM.topo + alturaUtil - h} width={larguraBarra - 2} height={Math.max(h, 1)} rx="2" fill={series[si].cor} />
                      <text x={x + (larguraBarra - 2) / 2} y={MARGEM.topo + alturaUtil - h - 4} textAnchor="middle" fontSize="10" fill="var(--foreground)">
                        {c.textos[si]}
                      </text>
                    </g>
                  );
                })}
                <text x={x0 + (series.length * larguraBarra) / 2} y={MARGEM.topo + alturaUtil + 16} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                  {c.rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
