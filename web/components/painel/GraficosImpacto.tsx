/**
 * Gráficos de impacto do painel (D52), em SVG com tokens, sem biblioteca e sem JavaScript no cliente.
 * Usados por app/painel/page.tsx: GraficoDivergente (excesso para cima, falta para baixo), GraficoCargas
 * (barras com linha da média) e GraficoEmpilhado (produção paga e complemento). Os números vêm prontos
 * (cálculo em lib/money); aqui só viram coordenadas. O título de cada gráfico diz a conclusão.
 */
import type { ReactNode } from "react";

const ALTURA = 250;
const LARGURA_COLUNA = 76;
/** Largura de cada coluna: 76 px com poucas, menos quando são muitas (o gráfico cabe na tela em vez de rolar). */
const larguraColuna = (n: number) =>
  Math.max(22, Math.min(LARGURA_COLUNA, Math.floor(1080 / Math.max(n, 1))));
/** Em gráficos estreitos, mostra só um rótulo de mês a cada tantos. */
const passoRotulo = (lc: number) => Math.max(1, Math.ceil(50 / lc));
const TOPO = 36;
const BASE = 40;
const ESQ = 44;

const num = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Moldura({
  titulo,
  legenda,
  resumo,
  tabela,
  children,
  largura,
}: {
  titulo: string;
  legenda: { nome: string; cor: string }[];
  resumo: string;
  tabela: ReactNode;
  children: ReactNode;
  largura: number;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <span className="text-h3 text-brand">{titulo}</span>
        <span className="flex flex-wrap gap-4 text-sm" aria-hidden="true">
          {legenda.map((l) => (
            <span key={l.nome} className="inline-flex items-center gap-2">
              <svg width="12" height="12" aria-hidden="true">
                <rect width="12" height="12" rx="3" fill={l.cor} />
              </svg>
              {l.nome}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`${titulo}. ${resumo}`}
          width="100%"
          height={ALTURA}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          style={{ minWidth: largura }}
        >
          {children}
        </svg>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-brand">
          Ver os números
        </summary>
        <div className="pt-3">{tabela}</div>
      </details>
    </figure>
  );
}

function Hachura({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={id}
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="8" height="8" fill="var(--muted)" />
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="8"
          stroke="var(--border)"
          strokeWidth="3"
        />
      </pattern>
    </defs>
  );
}

export interface ColunaDivergente {
  rotulo: string;
  /** Excesso (para cima) e falta (para baixo), só para a altura. Nulo = mês sem dado. */
  cima: number | null;
  baixo: number | null;
  textoCima: string | null;
  textoBaixo: string | null;
}

export function GraficoDivergente({
  titulo,
  unidade,
  colunas,
  tabela,
}: {
  titulo: string;
  unidade: string;
  colunas: ColunaDivergente[];
  tabela: ReactNode;
}) {
  const lc = larguraColuna(colunas.length);
  const largura = ESQ + colunas.length * lc + 12;
  const escala = Math.max(
    1e-9,
    ...colunas.flatMap((c) => [c.cima ?? 0, c.baixo ?? 0]),
  );
  const zero = TOPO + (ALTURA - TOPO - BASE) / 2;
  const meio = zero - TOPO;
  const larg = Math.min(26, Math.floor((lc - 14) / 2));
  const resumo = colunas
    .map((c) =>
      c.cima === null
        ? `${c.rotulo}: sem dado`
        : `${c.rotulo}: excesso ${c.textoCima}, falta ${c.textoBaixo}`,
    )
    .join("; ");
  const grade = [1, 0.5, 0, -0.5, -1];
  return (
    <Moldura
      titulo={titulo}
      legenda={[
        { nome: "Excesso", cor: "var(--excess)" },
        { nome: "Falta", cor: "var(--lack)" },
      ]}
      resumo={`${resumo}. Unidade: ${unidade}.`}
      tabela={tabela}
      largura={largura}
    >
      <Hachura id="hachura-div" />
      {grade.map((g) => (
        <g key={g}>
          <line
            x1={ESQ}
            x2={largura - 6}
            y1={zero - g * meio}
            y2={zero - g * meio}
            stroke={g === 0 ? "var(--foreground)" : "var(--border)"}
            strokeWidth={g === 0 ? 1.5 : 1}
            strokeDasharray={g === 0 ? undefined : "3 4"}
          />
          <text
            x={ESQ - 6}
            y={zero - g * meio + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {num(Math.abs(g) * escala)}
          </text>
        </g>
      ))}
      {colunas.map((c, i) => {
        const x = ESQ + i * lc + 6;
        if (c.cima === null || c.baixo === null) {
          return (
            <g key={c.rotulo}>
              <rect
                x={x}
                y={TOPO}
                width={lc - 12}
                height={ALTURA - TOPO - BASE}
                rx="6"
                fill="url(#hachura-div)"
                opacity="0.7"
              />
              <text
                x={x + (lc - 12) / 2}
                y={zero + 4}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
                stroke="var(--background)"
                strokeWidth="4"
                paintOrder="stroke"
              >
                sem dado
              </text>
              {i % passoRotulo(lc) === 0 && (
                <text
                  x={x + (lc - 12) / 2}
                  y={ALTURA - 8}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--muted-foreground)"
                >
                  {c.rotulo}
                </text>
              )}
            </g>
          );
        }
        const hc = (c.cima / escala) * meio;
        const hb = (c.baixo / escala) * meio;
        const cx = x + (lc - 12) / 2;
        return (
          <g key={c.rotulo}>
            <rect
              x={cx - larg - 1}
              y={zero - Math.max(hc, 2)}
              width={larg}
              height={Math.max(hc, 2)}
              rx="5"
              fill="var(--excess)"
            />
            {lc >= 50 && (
              <text
                x={cx - larg / 2 - 1}
                y={zero - Math.max(hc, 2) - 6}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--foreground)"
              >
                {c.textoCima}
              </text>
            )}
            <rect
              x={cx + 1}
              y={zero}
              width={larg}
              height={Math.max(hb, 2)}
              rx="5"
              fill="var(--lack)"
            />
            {lc >= 50 && (
              <text
                x={cx + larg / 2 + 1}
                y={zero + Math.max(hb, 2) + 14}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--foreground)"
              >
                {c.textoBaixo}
              </text>
            )}
            {i % passoRotulo(lc) === 0 && (
              <text
                x={cx}
                y={ALTURA - 8}
                textAnchor="middle"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {c.rotulo}
              </text>
            )}
          </g>
        );
      })}
    </Moldura>
  );
}

export interface ColunaSimples {
  rotulo: string;
  valor: number | null;
  texto: string | null;
}

export function GraficoCargas({
  titulo,
  unidade,
  colunas,
  media,
  textoMedia,
  tabela,
}: {
  titulo: string;
  unidade: string;
  colunas: ColunaSimples[];
  media: number;
  textoMedia: string;
  tabela: ReactNode;
}) {
  const lc = larguraColuna(colunas.length);
  const largura = ESQ + colunas.length * lc + 90;
  const fimBarras = largura - 84;
  const comValor = colunas.filter((c) => c.valor !== null);
  const escala = Math.max(
    1e-9,
    media,
    ...comValor.map((c) => c.valor as number),
  );
  const util = ALTURA - TOPO - BASE;
  const y = (v: number) => TOPO + util - (v / escala) * util;
  const maior = comValor.reduce(
    (a, c) => ((c.valor as number) > (a?.valor as number) ? c : a),
    comValor[0],
  );
  const menor = comValor.reduce(
    (a, c) => ((c.valor as number) < (a?.valor as number) ? c : a),
    comValor[0],
  );
  const resumo = colunas
    .map((c) => `${c.rotulo}: ${c.texto ?? "sem dado"}`)
    .join("; ");
  return (
    <Moldura
      titulo={titulo}
      legenda={[
        { nome: "Cargas por dia", cor: "var(--brand)" },
        { nome: "Média do período", cor: "var(--muted-foreground)" },
      ]}
      resumo={`${resumo}. Média do período: ${textoMedia}. Unidade: ${unidade}.`}
      tabela={tabela}
      largura={largura}
    >
      <Hachura id="hachura-car" />
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line
            x1={ESQ}
            x2={fimBarras}
            y1={y(g * escala)}
            y2={y(g * escala)}
            stroke="var(--border)"
            strokeDasharray={g === 0 ? undefined : "3 4"}
          />
          <text
            x={ESQ - 6}
            y={y(g * escala) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {num(g * escala)}
          </text>
        </g>
      ))}
      {colunas.map((c, i) => {
        const x = ESQ + i * lc + Math.min(10, lc / 6);
        const w = lc - 2 * Math.min(10, lc / 6);
        return (
          <g key={c.rotulo}>
            {c.valor === null ? (
              <>
                <rect
                  x={x}
                  y={TOPO}
                  width={w}
                  height={util}
                  rx="6"
                  fill="url(#hachura-car)"
                  opacity="0.7"
                />
                <text
                  x={x + w / 2}
                  y={TOPO + util / 2}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--muted-foreground)"
                  stroke="var(--background)"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  sem dado
                </text>
              </>
            ) : (
              <>
                <rect
                  x={x}
                  y={y(c.valor)}
                  width={w}
                  height={Math.max(TOPO + util - y(c.valor), 2)}
                  rx="6"
                  fill="var(--brand)"
                />
                {(c === maior || c === menor) && (
                  <text
                    x={x + w / 2}
                    y={y(c.valor) - 6}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--foreground)"
                  >
                    {c.texto}
                  </text>
                )}
              </>
            )}
            {i % passoRotulo(lc) === 0 && (
              <text
                x={x + w / 2}
                y={ALTURA - 8}
                textAnchor="middle"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {c.rotulo}
              </text>
            )}
          </g>
        );
      })}
      <line
        x1={ESQ}
        x2={fimBarras + 6}
        y1={y(media)}
        y2={y(media)}
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text
        x={fimBarras + 10}
        y={y(media) + 4}
        textAnchor="start"
        fontSize="12"
        fontWeight="600"
        fill="var(--foreground)"
      >
        média {textoMedia}
      </text>
    </Moldura>
  );
}

export interface ColunaEmpilhada {
  rotulo: string;
  /** Produção paga e complemento sem produção, só para a altura. Nulo = sem dado. */
  base: number | null;
  topo: number | null;
  textoTotal: string | null;
}

export function GraficoEmpilhado({
  titulo,
  colunas,
  tabela,
}: {
  titulo: string;
  colunas: ColunaEmpilhada[];
  tabela: ReactNode;
}) {
  const lc = larguraColuna(colunas.length);
  const largura = ESQ + 8 + colunas.length * lc + 12;
  const total = (c: ColunaEmpilhada) => (c.base ?? 0) + (c.topo ?? 0);
  const escala = Math.max(1e-9, ...colunas.map(total));
  const util = ALTURA - TOPO - BASE;
  const resumo = colunas
    .map((c) => `${c.rotulo}: ${c.textoTotal ?? "sem dado"}`)
    .join("; ");
  return (
    <Moldura
      titulo={titulo}
      legenda={[
        { nome: "Produção paga", cor: "var(--brand)" },
        { nome: "Complemento sem produção", cor: "var(--lack)" },
      ]}
      resumo={resumo}
      tabela={tabela}
      largura={largura + 20}
    >
      <Hachura id="hachura-emp" />
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line
            x1={ESQ + 8}
            x2={largura + 14}
            y1={TOPO + util - g * util}
            y2={TOPO + util - g * util}
            stroke="var(--border)"
            strokeDasharray={g === 0 ? undefined : "3 4"}
          />
          <text
            x={ESQ + 2}
            y={TOPO + util - g * util + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {num((g * escala) / 1000)} mil
          </text>
        </g>
      ))}
      {colunas.map((c, i) => {
        const x = ESQ + 8 + i * lc + Math.min(12, lc / 6);
        const w = lc - 2 * Math.min(12, lc / 6);
        const hb = ((c.base ?? 0) / escala) * util;
        const ht = ((c.topo ?? 0) / escala) * util;
        return (
          <g key={c.rotulo}>
            {c.base === null ? (
              <>
                <rect
                  x={x}
                  y={TOPO}
                  width={w}
                  height={util}
                  rx="6"
                  fill="url(#hachura-emp)"
                  opacity="0.7"
                />
                <text
                  x={x + w / 2}
                  y={TOPO + util / 2}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--muted-foreground)"
                  stroke="var(--background)"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  sem dado
                </text>
              </>
            ) : (
              <>
                <rect
                  x={x}
                  y={TOPO + util - hb}
                  width={w}
                  height={Math.max(hb, 1)}
                  rx="4"
                  fill="var(--brand)"
                />
                {ht > 0 && (
                  <rect
                    x={x}
                    y={TOPO + util - hb - ht}
                    width={w}
                    height={ht}
                    rx="4"
                    fill="var(--lack)"
                  />
                )}
                <text
                  x={x + w / 2}
                  y={TOPO + util - hb - ht - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--foreground)"
                >
                  {`${num((c.base ?? 0) / 1000 + (c.topo ?? 0) / 1000)} mil`}
                </text>
              </>
            )}
            {i % passoRotulo(lc) === 0 && (
              <text
                x={x + w / 2}
                y={ALTURA - 8}
                textAnchor="middle"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {c.rotulo}
              </text>
            )}
          </g>
        );
      })}
    </Moldura>
  );
}

/** Lista com uma barra horizontal por linha (fornecedores, dias de maior movimento). */
export function BarrasHorizontais({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { rotulo: string; valor: number; texto: string }[];
}) {
  const maximo = Math.max(1e-9, ...linhas.map((l) => l.valor));
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h3 text-brand">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <li
            key={l.rotulo}
            className="grid grid-cols-[minmax(0,15rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="truncate" title={l.rotulo}>
              {l.rotulo}
            </span>
            <span className="h-3 rounded-full bg-muted" aria-hidden>
              <span
                className="block h-3 rounded-full bg-brand"
                style={{ width: `${Math.max((l.valor / maximo) * 100, 2)}%` }}
              />
            </span>
            <span className="tabular-nums text-brand">{l.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
