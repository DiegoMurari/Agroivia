import { Banknote, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { BarrasHorizontais, GraficoCargas, GraficoDivergente, GraficoEmpilhado, type ColunaDivergente, type ColunaEmpilhada, type ColunaSimples } from "@/components/painel/GraficosImpacto";
import { TabelaMeses } from "@/components/painel/TabelaMeses";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { getDb, schema } from "@/lib/db";
import { comparar, deInteiro, dividir, formatBRL, formatNumero, multiplicar, paraTexto, subtrair } from "@/lib/money";
import { demandaPorArmazem, filtroDaUrl, lerParametros, resumoBoletins, resumoCooperativaBoletins, resumoHistorico } from "@/lib/painel/consultas";
import { SEM_DADO, fraseDaResposta } from "@/lib/painel/frase";
import { PrevisaoSemana } from "@/components/painel/PrevisaoSemana";
import { ProjecaoChapas } from "@/components/painel/ProjecaoChapas";
import { projetar } from "@/lib/painel/projecao";
import { previsaoDaSemana } from "@/lib/painel/semana-chapas";
import { agruparFornecedores } from "@/lib/painel/agrupar-fornecedores";
import { hojeISO } from "@/lib/relogio";
import { faixaDaNormaNoPeriodo } from "@/lib/painel/faixa-norma";
import { indicadoresOperacao, ROTULO_MOTIVO } from "@/lib/painel/operacao";
import { cargasPorDia, custoDoPeriodo, diasDeMaiorMovimento, fornecedoresPorPeso } from "@/lib/painel/indicadores";

const ORIGEM = { teste: "Teste", operacao: "Operação", historico: "Histórico" } as const;
type Busca = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Busca }) {
  const busca = await searchParams;
  // Sem nenhum filtro na URL vale todo o histórico: a tela não tem períodos prontos
  const comFiltro = Boolean(um(busca.de) || um(busca.ate) || um(busca.periodo) || um(busca.semana));
  const filtro = comFiltro ? filtroDaUrl(um(busca.periodo), um(busca.semana), um(busca.de), um(busca.ate)) : ({ tipo: "tudo" } as const);
  const db = getDb();
  const piso = lerParametros(db).piso;
  const hist = resumoHistorico(db, filtro);
  const demanda = demandaPorArmazem(db, filtro);
  const novos = resumoBoletins(db, filtro);
  const cooperativa = resumoCooperativaBoletins(db, filtro);
  const r = hist.resumo;
  const cargas = cargasPorDia(db, filtro);
  const custo = custoDoPeriodo(db, filtro, hist);
  const fornecedores = fornecedoresPorPeso(db, filtro);
  const picos = diasDeMaiorMovimento(db, filtro, 10, cargas);
  const faixa = faixaDaNormaNoPeriodo(db, filtro);
  const operacao = indicadoresOperacao(db, filtro);
  const semana = previsaoDaSemana(db, hojeISO(), 9);
  const projecao = projetar(db, hojeISO());
  const logImportacao = db.select().from(schema.histImportacaoLog).all().sort((a, b) => (a.arquivo ?? "").localeCompare(b.arquivo ?? ""));
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const plano = (v: Parameters<typeof paraTexto>[0]) => Number(paraTexto(v)); // só para a altura da barra
  const cargasPorMes = new Map<string, { dias: number; cargas: number }>();
  for (const d of cargas?.dias ?? []) {
    const acc = cargasPorMes.get(d.data.slice(0, 7)) ?? { dias: 0, cargas: 0 };
    acc.dias++;
    acc.cargas += d.total;
    cargasPorMes.set(d.data.slice(0, 7), acc);
  }
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mesCurto = (anoMes: string) => `${MESES[Number.parseInt(anoMes.slice(5, 7), 10) - 1].slice(0, 3)}/${anoMes.slice(2, 4)}`;
  const mesLongo = (anoMes: string) => MESES[Number.parseInt(anoMes.slice(5, 7), 10) - 1];

  const mesesComDadoLista = hist.meses.filter((m) => m.status === "ok" && m.resumo);
  const colunasMeses: ColunaDivergente[] = hist.meses.map((m) =>
    m.status === "ok" && m.resumo
      ? { rotulo: mesCurto(m.anoMes), cima: plano(m.resumo.excessoMedioChapas), baixo: plano(m.resumo.faltaMediaChapas), textoCima: formatNumero(m.resumo.excessoMedioChapas), textoBaixo: formatNumero(m.resumo.faltaMediaChapas) }
      : { rotulo: mesCurto(m.anoMes), cima: null, baixo: null, textoCima: null, textoBaixo: null },
  );
  const maiorExcesso = mesesComDadoLista.reduce<(typeof mesesComDadoLista)[number] | null>((a, m) => (a === null || comparar(m.resumo!.excessoMedioChapas, a.resumo!.excessoMedioChapas) > 0 ? m : a), null);
  const tituloMeses = maiorExcesso ? `Em ${mesLongo(maiorExcesso.anoMes)} sobraram ${formatNumero(maiorExcesso.resumo!.excessoMedioChapas)} funcionários por dia` : "Excesso e falta de funcionários por mês";

  const colunasCargas: ColunaSimples[] = [...cargasPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, a]) => {
      const media = dividir(deInteiro(a.cargas), deInteiro(a.dias));
      return { rotulo: mesCurto(mes), valor: plano(media), texto: formatNumero(media) };
    });
  const maiorCarga = colunasCargas.reduce<ColunaSimples | null>((a, c) => (a === null || (c.valor ?? 0) > (a.valor ?? 0) ? c : a), null);
  const tituloCargas = maiorCarga ? `O movimento chegou a ${maiorCarga.texto} cargas por dia em ${maiorCarga.rotulo}` : "Cargas por dia";

  const colunasCusto: ColunaEmpilhada[] = hist.meses.map((m) =>
    m.status === "ok" && m.resumo
      ? {
          rotulo: mesCurto(m.anoMes),
          base: plano(subtrair(m.resumo.custoTotal, m.resumo.excessoReaisTotal)),
          topo: plano(m.resumo.excessoReaisTotal),
          textoTotal: formatBRL(m.resumo.custoTotal),
        }
      : { rotulo: mesCurto(m.anoMes), base: null, topo: null, textoTotal: null },
  );
  const tituloCusto = custo ? `${formatBRL(custo.complementoTotal)} foram pagos sem produção no período` : "Custo por mês";

  const foraDasMedias = hist.meses.filter((m) => m.status !== "ok");
  const justificadasMedias = r ? dividir(r.producaoTotal, multiplicar(piso, deInteiro(r.diasConsiderados))) : null;
  const frase = r ? fraseDaResposta(r, piso, hist.rotulo) : null;

  const tabelaMesesNumeros = (
    <Table>
      <TableCaption className="sr-only">Excesso e falta médios por mês, em funcionários por dia.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead className="text-right">Excesso</TableHead>
          <TableHead className="text-right">Falta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {colunasMeses.map((c) => (
          <TableRow key={c.rotulo}>
            <TableCell>{c.rotulo}</TableCell>
            <TableCell className="text-right tabular-nums">{c.textoCima ?? "sem dado"}</TableCell>
            <TableCell className="text-right tabular-nums">{c.textoBaixo ?? "sem dado"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  const tabelaSimples = (cabecalho: string, linhas: { rotulo: string; texto: string | null }[]) => (
    <Table>
      <TableCaption className="sr-only">{cabecalho} por mês.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead className="text-right">{cabecalho}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l) => (
          <TableRow key={l.rotulo}>
            <TableCell>{l.rotulo}</TableCell>
            <TableCell className="text-right tabular-nums">{l.texto ?? "sem dado"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <PageWrapper title="Painel gerencial" size="wide">
      <div className="flex flex-col gap-8">
        {projecao && <ProjecaoChapas projecao={projecao} />}

        <section aria-labelledby="problema" className="flex flex-col gap-4">
          <h2 id="problema" className="sr-only">
            Excesso, falta e dinheiro pago sem produção
          </h2>
          {r ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
              <Card className="gap-1 p-6">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp aria-hidden className="size-5 text-excess" /> Excesso médio
                </p>
                <p className="text-display font-semibold tabular-nums text-excess">{formatNumero(r.excessoMedioChapas)}</p>
                <p className="text-sm text-muted-foreground">funcionários por dia, a mais do que a produção paga</p>
              </Card>
              <Card className="gap-1 p-6">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown aria-hidden className="size-5 text-lack" /> Falta média
                </p>
                <p className="text-display font-semibold tabular-nums text-lack">{formatNumero(r.faltaMediaChapas)}</p>
                <p className="text-sm text-muted-foreground">funcionários por dia, a menos do que a produção pede</p>
              </Card>
              <Card className="gap-1 p-6">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Banknote aria-hidden className="size-5 text-brand" /> Dinheiro pago sem produção
                </p>
                <p className="text-display font-semibold tabular-nums text-brand">{formatBRL(r.excessoReaisTotal)}</p>
                <p className="text-sm text-muted-foreground">no período, {hist.rotulo}</p>
              </Card>
              </div>
            </>
          ) : (
            <EmptyState icon={<TriangleAlert />} title="Sem dado" description={SEM_DADO} />
          )}
        </section>

        <section aria-labelledby="historico" className="flex flex-col gap-4">
          <h2 id="historico" className="sr-only">
            Gráficos do período
          </h2>
          <Card className="p-5">
            <Tabs defaultValue="meses">
              <TabsList aria-label="Gráfico">
                <TabsTrigger value="meses">Excesso e falta</TabsTrigger>
                {colunasCargas.length > 0 && cargas && <TabsTrigger value="cargas">Cargas por dia</TabsTrigger>}
                {custo && <TabsTrigger value="custo">Custo por mês</TabsTrigger>}
              </TabsList>
              <TabsContent value="meses">
                <GraficoDivergente titulo={tituloMeses} unidade="funcionários por dia" colunas={colunasMeses} tabela={tabelaMesesNumeros} />
              </TabsContent>
              {colunasCargas.length > 0 && cargas && (
                <TabsContent value="cargas">
                  <GraficoCargas
                    titulo={tituloCargas}
                    unidade="cargas por dia"
                    colunas={colunasCargas}
                    media={plano(cargas.mediaPorDia)}
                    textoMedia={formatNumero(cargas.mediaPorDia)}
                    tabela={tabelaSimples("Cargas por dia", colunasCargas.map((c) => ({ rotulo: c.rotulo, texto: c.texto })))}
                  />
                </TabsContent>
              )}
              {custo && (
                <TabsContent value="custo">
                  <GraficoEmpilhado
                    titulo={tituloCusto}
                    colunas={colunasCusto}
                    tabela={tabelaSimples("Custo estimado", colunasCusto.map((c) => ({ rotulo: c.rotulo, texto: c.textoTotal })))}
                  />
                </TabsContent>
              )}
            </Tabs>
          </Card>
        </section>

        <PrevisaoSemana dias={semana} />

        <section aria-labelledby="movimento" className="grid gap-4 lg:grid-cols-2">
          <h2 id="movimento" className="sr-only">
            Fornecedores e dias de maior movimento
          </h2>
          <Card className="gap-4 p-6">
            {fornecedores ? (
              <BarrasHorizontais
                titulo="Fornecedores com maior volume"
                linhas={agruparFornecedores(fornecedores.fornecedores).slice(0, 8).map((f) => ({ rotulo: f.nome, valor: plano(f.pesoKg), texto: `${formatNumero(dividir(f.pesoKg, "1000"), 0)} t` }))}
              />
            ) : (
              <EmptyState title="Sem peso conhecido neste período" />
            )}
          </Card>
          <Card className="p-6">
            {picos ? (
              <BarrasHorizontais
                titulo="Dias de maior movimento"
                linhas={picos.dias.slice(0, 8).map((d) => ({ rotulo: `${d.data.split("-").reverse().join("/")} ${DIAS[d.diaDaSemana].slice(0, 3)}`, valor: d.cargas, texto: `${d.cargas} cargas` }))}
              />
            ) : (
              <EmptyState title="Sem recebimento neste período" />
            )}
          </Card>
        </section>

        <section aria-label="Análises" className="flex flex-col gap-3">
          <Card className="p-5">
            <Tabs defaultValue="meses">
              <TabsList aria-label="Análise" className="flex-wrap">
                <TabsTrigger value="meses">Mês a mês</TabsTrigger>
                <TabsTrigger value="armazem">Por armazém</TabsTrigger>
                <TabsTrigger value="boletins">Boletins novos</TabsTrigger>
                <TabsTrigger value="regua">Régua</TabsTrigger>
                <TabsTrigger value="operacao">Operação</TabsTrigger>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="como">Como calculamos</TabsTrigger>
              </TabsList>
              <TabsContent value="meses">
            {hist.meses.length > 0 ? <TabelaMeses meses={hist.meses} /> : <EmptyState title="Nenhum mês neste período" />}
            {hist.fimDeSemanaFora > 0 && <p className="pt-3 text-sm text-muted-foreground">{hist.fimDeSemanaFora} dias de folha em sábado ou domingo ficam fora da comparação.</p>}
          </TabsContent>

          <TabsContent value="armazem">
            {demanda ? (
              <div className="flex flex-col gap-3">
                <Alert variant="info" title="Premissa, não medição">
                  {demanda.premissa}
                </Alert>
                <Table>
                  <TableCaption className="sr-only">Demanda por armazém no histórico, com o efetivo rateado como premissa.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Armazém</TableHead>
                      <TableHead className="text-right">Diárias justificadas por dia</TableHead>
                      <TableHead className="text-right">Parte da demanda</TableHead>
                      <TableHead className="text-right">Efetivo rateado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demanda.armazens.map((a) => (
                      <TableRow key={a.armazemId}>
                        <TableCell className="font-medium">{a.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(a.diariasPorDia)}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.participacao ? `${formatNumero(a.participacao.times(100), 1)}%` : "sem boletim"}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.efetivoRateado ? formatNumero(a.efetivoRateado) : "fora da comparação"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState title="Sem dado por armazém neste período" />
            )}
          </TabsContent>

          <TabsContent value="boletins">
            {novos.length > 0 ? (
              <Table>
                <TableCaption className="sr-only">Excesso e falta medidos nos boletins fechados, por armazém e origem.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Armazém</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                    <TableHead className="text-right">Excesso (funcionários/dia)</TableHead>
                    <TableHead className="text-right">Falta (funcionários/dia)</TableHead>
                    <TableHead className="text-right">Complemento (R$/dia)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {novos.map((n) => (
                    <TableRow key={`${n.armazemId}-${n.origem}`}>
                      <TableCell className="font-medium">{n.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ORIGEM[n.origem]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{n.resumo.diasConsiderados}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumero(n.resumo.excessoMedioChapas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumero(n.resumo.faltaMediaChapas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumero(n.resumo.excessoReaisMedio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Nenhum boletim fechado neste período" />
            )}
            {cooperativa.length > 0 && (
              <div className="pt-4">
                <h3 className="pb-2 text-h3 text-brand">Cooperativa inteira</h3>
                <Table>
                  <TableCaption className="sr-only">Soma dos boletins do dia, inclusive o boletim único de Todas as áreas.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead className="text-right">Efetivo médio</TableHead>
                      <TableHead className="text-right">Excesso (funcionários/dia)</TableHead>
                      <TableHead className="text-right">Falta (funcionários/dia)</TableHead>
                      <TableHead className="text-right">Complemento (R$/dia)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cooperativa.map((c) => (
                      <TableRow key={c.origem}>
                        <TableCell>
                          <Badge variant="outline">{ORIGEM[c.origem]}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.resumo.diasConsiderados}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(c.resumo.efetivoMedio)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(c.resumo.excessoMedioChapas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(c.resumo.faltaMediaChapas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(c.resumo.excessoReaisMedio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="regua">
            {faixa ? (
              <div className="flex flex-col gap-2">
                <p className="text-h3">
                  Pela norma, a necessidade média fica entre {formatNumero(faixa.minimoMedioChapas)} e {formatNumero(faixa.maximoMedioChapas)} funcionários por dia com recebimento.
                </p>
                <p>
                  Pico: {faixa.diaDePico.data.split("-").reverse().join("/")}, com {faixa.diaDePico.cargas} cargas e necessidade de {faixa.diaDePico.minimoChapas} a {faixa.diaDePico.maximoChapas} funcionários.{" "}
                  {faixa.cargasComAcondicionamento} de {faixa.totalCargas} cargas têm o acondicionamento conhecido pelo XML.
                </p>
                <p className="text-muted-foreground">{faixa.aviso}</p>
              </div>
            ) : (
              <EmptyState title="Sem carga neste período" />
            )}
          </TabsContent>

          <TabsContent value="operacao">
            {operacao.length > 0 ? (
              <div className="flex flex-col gap-4">
                {operacao.map((o) => (
                  <div key={o.origem} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ORIGEM[o.origem]}</Badge>
                      <span className="text-sm text-muted-foreground">{o.agendamentos} agendamentos não cancelados</span>
                    </div>
                    <dl className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <dt className="text-sm text-muted-foreground">Espera média</dt>
                        <dd className="text-h3 tabular-nums text-brand">{o.esperaMediaMin ? `${formatNumero(o.esperaMediaMin, 1)} min` : "Sem dado"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Descarga média</dt>
                        <dd className="text-h3 tabular-nums text-brand">{o.descargaMediaMin ? `${formatNumero(o.descargaMediaMin, 1)} min` : "Sem dado"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Colaboradores por recebimento</dt>
                        <dd className="text-h3 tabular-nums text-brand">{o.colaboradoresPorRecebimento ? formatNumero(o.colaboradoresPorRecebimento) : "Sem dado"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Utilização dos horários</dt>
                        <dd className="text-h3 tabular-nums text-brand">{o.utilizacao.percentual ? `${formatNumero(o.utilizacao.percentual, 1)}%` : "Sem dado"}</dd>
                      </div>
                    </dl>
                    <p className="text-sm">
                      Não recebimentos: {o.naoRecebimentos.total}
                      {o.naoRecebimentos.porMotivo.length > 0 && ` (${o.naoRecebimentos.porMotivo.map((m) => `${m.motivo ? ROTULO_MOTIVO[m.motivo] : "sem motivo"}: ${m.quantidade}`).join("; ")})`}.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem agendamentos de teste ou de operação neste período" />
            )}
          </TabsContent>

          <TabsContent value="dados">
            {logImportacao.length > 0 ? (
              <Table>
                <TableCaption className="sr-only">Resultado da última importação do histórico.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="text-right">Linhas lidas</TableHead>
                    <TableHead className="text-right">Sem marca</TableHead>
                    <TableHead className="text-right">Marcadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logImportacao.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.arquivo}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.linhasLidas}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.linhasOk}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.linhasMarcadas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Histórico ainda não importado" />
            )}
          </TabsContent>
              <TabsContent value="como">
                <div className="flex flex-col gap-3 pt-3">
              {frase && (
                <>
                  <p>{frase.principal}</p>
                  <p>{frase.detalhe}</p>
                  <p className="text-muted-foreground">{frase.pico}</p>
                  <p className="text-muted-foreground">{frase.ressalva}</p>
                </>
              )}
              {r && justificadasMedias && (
                <p className="text-muted-foreground">
                  Efetivo médio de {formatNumero(r.efetivoMedio)} funcionários contra {formatNumero(justificadasMedias)} diárias justificadas, em {r.diasConsiderados} dias úteis comparados ({hist.mesesComDado}{" "}
                  {hist.mesesComDado === 1 ? "mês" : "meses"} com dado). {r.semProducao} dias sem recebimento e {r.inconsistentes} linhas da folha inconsistentes ficaram fora.
                </p>
              )}
              <ul className="list-disc pl-5">
                <li>Diárias justificadas = produção do dia ÷ piso de R$ {formatNumero(piso, 4)}. Saldo = efetivo menos diárias justificadas: positivo é excesso, negativo é falta.</li>
                <li>Em reais: excesso = piso × efetivo − produção (o complemento do boletim); falta = produção − piso × efetivo.</li>
                <li>Efetivo = funcionários presentes menos a operação de café, da folha (a folha não tem armazém).</li>
                <li>Produção estimada só do recebimento de compras: fertilizante pelo peso ÷ 50 kg, demais grupos pela quantidade, ao preço do tipo de item. Corretivos de solo e linhas acima de 100 t ficam fora. Só os armazéns com boletim entram.</li>
                <li>Carregamento de cooperado, remoção e transferência não estão nos dados: o excesso é um teto e a falta é um piso.</li>
                <li>Sábados e domingos, e dias sem recebimento, ficam fora da comparação.</li>
              </ul>
            </div>
              </TabsContent>
            </Tabs>
          </Card>
        </section>
      </div>
    </PageWrapper>
  );
}

