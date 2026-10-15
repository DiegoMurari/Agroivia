import { eq } from "drizzle-orm";

import { criarBoletim, fecharBoletim } from "@/lib/boletim/servico";

import type { Db } from "../index";
import * as s from "../schema";

/**
 * Uso retroativo (D54): reconstitui, a partir do histórico real importado (`hist_*`), como o sistema teria sido
 * usado entre `INICIO` e o dia anterior a `dia`. Cada "caminhão histórico" (fornecedor + dia de recebimento, D21)
 * vira um agendamento concluído, com o fornecedor, o pedido de compra, a NF e os itens reais, e os armazéns de destino
 * que o próprio histórico indica. Do dia `dia` em diante, só a semana seguinte, como agendamentos futuros.
 *
 * O que vem do histórico: fornecedor, pedido, NF, itens, peso, armazém e a data do recebimento.
 * O que é reconstituído (nunca foi registrado): horário marcado, chegada, entrada, saída, placa e chapas por descarga.
 * Esses valores saem de uma função determinística e a observação do agendamento diz isso. Toda linha leva origem = teste.
 *
 * Boletins: um por armazém que faz boletim, nos dias com folha de chapas, com os chapas da folha e a produção
 * estimada do histórico (D29, D46). Passam pelo mesmo serviço do boletim, então a conta é a da planilha.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const ORIGEM = "teste" as const;
const GRADE = ["08:00", "10:00", "13:00", "15:00"] as const;
const INICIO = "2026-06-01";
const DIAS_A_FRENTE = 7;
const GRUPOS_QUE_PEDEM_AGENDA = new Set(["FER", "AGR", "MAQ", "IRG", "ALI", "SEM"]);
const OBS = "Reconstituído do histórico real: horários, placa e funcionários são simulados.";

// ───────────── utilidades ─────────────

const dois = (n: number) => String(n).padStart(2, "0");

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function instante(data: string, hora: string, maisMinutos = 0): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + maisMinutos;
  const extraDia = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return `${extraDia ? somarDias(data, extraDia) : data}T${dois(Math.floor(t / 60))}:${dois(t % 60)}:00-03:00`;
}

/** Número pseudoaleatório estável a partir de um texto (mesma entrada, mesma saída). */
function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
const entre = (chave: string, min: number, max: number) => min + Math.floor(hash(chave) * (max - min + 1));

function placaDe(chave: string): string {
  const letra = (i: number) => String.fromCharCode(65 + entre(`${chave}L${i}`, 0, 25));
  return `${letra(0)}${letra(1)}${letra(2)}${entre(`${chave}a`, 0, 9)}${letra(3)}${entre(`${chave}b`, 0, 9)}${entre(`${chave}c`, 0, 9)}`;
}

// ───────────── leitura do histórico ─────────────

interface Linha {
  pedido: string | null;
  codPn: string;
  nomePn: string | null;
  cnpj: string | null;
  data: string;
  nfNumero: string | null;
  chave: string | null;
  dataDocumento: string | null;
  codItem: string | null;
  descricao: string | null;
  qtd: string | null;
  unidade: string | null;
  pesoKg: number | null;
  grupo: string | null;
  armazemId: number | null;
}

interface Caminhao {
  codPn: string;
  data: string;
  linhas: Linha[];
}

const ARMAZEM_DO_GRUPO: Record<string, number> = { FER: 2, MAQ: 3, AGR: 1, SEM: 1, IRG: 1 };

function lerCaminhoes(db: Db, de: string, ate: string): Caminhao[] {
  const linhas = db.$client
    .prepare(
      `select pedido_compra pedido, cod_pn codPn, nome_pn nomePn, fornecedor_cnpj cnpj, data_recebimento data, nf_numero nfNumero,
              chave_acesso chave, data_documento dataDocumento, cod_item codItem, desc_item descricao, qtd, unidade,
              cast(peso_kg as real) pesoKg, grupo, armazem_id armazemId
         from hist_movimentacao
        where considerada = 1 and data_recebimento between ? and ?
        order by data_recebimento, cod_pn, id`,
    )
    .all(de, ate) as Linha[];
  const porChave = new Map<string, Caminhao>();
  for (const l of linhas) {
    const k = `${l.data}|${l.codPn}`;
    let c = porChave.get(k);
    if (!c) porChave.set(k, (c = { codPn: l.codPn, data: l.data, linhas: [] }));
    c.linhas.push(l);
  }
  // só entra na agenda o caminhão que precisa dela: mais de 500 kg, ou de grupo que o dossiê trata como carga
  return [...porChave.values()].filter((c) => {
    const kg = c.linhas.reduce((t, l) => t + (l.pesoKg ?? 0), 0);
    return kg > 500 || c.linhas.some((l) => l.grupo && GRUPOS_QUE_PEDEM_AGENDA.has(l.grupo));
  });
}

// ───────────── gravação ─────────────

interface Contexto {
  fornecedor: Map<string, { id: number; razaoSocial: string }>;
  produto: Map<string, number>;
  chapaIds: number[];
  empilhadeira: Map<number, number>;
  armazemIds: Set<number>;
  nf: Map<string, number>;
  sequencia: number;
  hoje: string;
}

function acondicionamentoDe(c: Caminhao): { nf: "batido" | "paletizado" | "big_bag"; ocupacao: "batido" | "unitizado" } {
  const fer = c.linhas.some((l) => l.grupo === "FER");
  if (fer) return hash(`${c.codPn}${c.data}`) < 0.5 ? { nf: "batido", ocupacao: "batido" } : { nf: "big_bag", ocupacao: "unitizado" };
  return { nf: "paletizado", ocupacao: "unitizado" };
}

function armazensDe(c: Caminhao): number[] {
  const ids = new Set<number>();
  for (const l of c.linhas) {
    const id = l.armazemId ?? (l.grupo ? ARMAZEM_DO_GRUPO[l.grupo] : undefined) ?? 4;
    ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

function evento(tx: Tx, agendamentoId: number, tipo: string, autor: string, criadoEm: string, detalhe?: unknown) {
  tx.insert(s.evento)
    .values({ agendamentoId, tipo, autor, criadoEm, detalhe: detalhe === undefined ? null : JSON.stringify(detalhe) })
    .run();
}

function gravarCaminhao(tx: Tx, ctx: Contexto, c: Caminhao, horario: string, estado: "concluido" | "agendado", pico: boolean) {
  const fornecedor = ctx.fornecedor.get(c.codPn);
  if (!fornecedor) return false;
  ctx.sequencia++;
  const chaveSeed = `${c.codPn}${c.data}`;
  const criadoEm = instante(somarDias(c.data, -3), "10:00", entre(`${chaveSeed}c`, 0, 240));
  const acond = acondicionamentoDe(c);
  const pesoTotal = c.linhas.reduce((t, l) => t + (l.pesoKg ?? 0), 0);
  const placa = placaDe(chaveSeed);
  const armazens = armazensDe(c).filter((id) => ctx.armazemIds.has(id));
  if (armazens.length === 0) armazens.push(1);

  // pedido de compra real (o primeiro do caminhão) com os itens do histórico
  const pedido = c.linhas.find((l) => l.pedido)?.pedido ?? null;
  const compra = tx
    .insert(s.compra)
    .values({
      fornecedorId: fornecedor.id,
      numeroPedido: pedido,
      descricao: `Compra ${pedido ?? ""} (histórico real)`.trim(),
      token: `retro-${ctx.sequencia}`,
      status: "confirmada",
      criadaPor: "Compras",
      criadaEm: criadoEm,
      preenchidaEm: criadoEm,
      origem: ORIGEM,
    })
    .returning({ id: s.compra.id })
    .get();
  const itensCompra = c.linhas.filter((l) => l.descricao).slice(0, 40);
  if (itensCompra.length)
    tx.insert(s.compraItem)
      .values(
        itensCompra.map((l) => ({
          compraId: compra.id,
          produtoId: l.codItem ? (ctx.produto.get(l.codItem) ?? null) : null,
          descricao: l.descricao,
          quantidade: l.qtd,
          unidade: l.unidade,
          pesoKg: l.pesoKg !== null ? String(l.pesoKg) : null,
        })),
      )
      .run();

  const divergente = hash(`${chaveSeed}d`) < 0.04;
  const agendamento = tx
    .insert(s.agendamento)
    .values({
      compraId: compra.id,
      fornecedorId: fornecedor.id,
      data: c.data,
      horario,
      placa,
      transportadora: null,
      acondicionamentoOcupacao: acond.ocupacao,
      pesoDeclaradoKg: pesoTotal > 0 ? String(Math.round(pesoTotal * 100) / 100) : null,
      status: "agendado",
      validacaoStatus: divergente ? "divergente" : "conforme",
      validacaoObs: divergente ? "Peso da NF diferente do pedido. Carga recebida para resolver depois." : null,
      validadoPor: "Compras",
      validadoEm: criadoEm,
      autorizadoPor: "Gestor de armazém",
      autorizadoEm: criadoEm,
      excecaoOcupacao: pico ? "pico_historico" : null,
      excecaoMotivo: pico ? "Dia de pico no histórico real: mais caminhões do que a grade comporta." : null,
      observacao: OBS,
      origem: ORIGEM,
      criadoEm,
      atualizadoEm: criadoEm,
    })
    .returning({ id: s.agendamento.id })
    .get();

  // notas fiscais reais do caminhão (a mesma chave nunca se repete)
  const porChave = new Map<string, Linha[]>();
  for (const l of c.linhas) if (l.chave && /^\d{44}$/.test(l.chave)) porChave.set(l.chave, [...(porChave.get(l.chave) ?? []), l]);
  for (const [chave, itens] of porChave) {
    let nfId = ctx.nf.get(chave);
    if (nfId === undefined) {
      const base = itens[0];
      const kg = itens.reduce((t, l) => t + (l.pesoKg ?? 0), 0);
      const nf = tx
        .insert(s.notaFiscal)
        .values({
          chaveAcesso: chave,
          numero: base.nfNumero,
          serie: null,
          emitenteCnpj: base.cnpj,
          emitenteNome: base.nomePn ?? fornecedor.razaoSocial,
          fornecedorId: fornecedor.id,
          emitidaEm: base.dataDocumento ? `${base.dataDocumento}T10:00:00-03:00` : null,
          pesoLiquidoKg: kg > 0 ? String(Math.round(kg * 100) / 100) : null,
          placa,
          pedidoFornecedor: base.pedido,
          formaEntrada: "manual",
          origem: ORIGEM,
          criadaEm: criadoEm,
        })
        .returning({ id: s.notaFiscal.id })
        .get();
      nfId = nf.id;
      ctx.nf.set(chave, nfId);
      tx.insert(s.notaFiscalItem)
        .values(
          itens.slice(0, 60).map((l) => ({
            notaFiscalId: nf.id,
            codigoFornecedor: l.codItem,
            descricao: l.descricao,
            quantidade: l.qtd,
            unidade: l.unidade,
            produtoId: l.codItem ? (ctx.produto.get(l.codItem) ?? null) : null,
          })),
        )
        .run();
    }
    tx.insert(s.agendamentoNf).values({ agendamentoId: agendamento.id, notaFiscalId: nfId, acondicionamento: acond.nf }).onConflictDoNothing().run();
  }

  evento(tx, agendamento.id, "agendado", "Fornecedor", criadoEm);
  evento(tx, agendamento.id, "validado", "Compras", criadoEm, { validacao: divergente ? "divergente" : "conforme" });
  evento(tx, agendamento.id, "autorizado", "Gestor de armazém", criadoEm);
  evento(tx, agendamento.id, "destino_definido", "Gestor de armazém", criadoEm, { armazens });

  if (estado === "agendado") {
    armazens.forEach((armazemId, i) => tx.insert(s.agendamentoArmazem).values({ agendamentoId: agendamento.id, armazemId, ordem: i + 1 }).run());
    return true;
  }

  // ── execução reconstituída ──
  const chegada = entre(`${chaveSeed}h`, -15, hash(`${chaveSeed}t`) < 0.12 ? 45 : 10);
  const espera = entre(`${chaveSeed}e`, 5, 45);
  const chegadaEm = instante(c.data, horario, chegada);
  evento(tx, agendamento.id, "chegou", "Portaria", chegadaEm);
  let cursor = chegada + espera;
  let ultimaSaida = chegadaEm;
  const primeiraChapa = Math.floor(hash(`${chaveSeed}p`) * ctx.chapaIds.length);
  armazens.forEach((armazemId, i) => {
    const batido = acond.nf === "batido" && i === 0;
    const duracao = batido ? entre(`${chaveSeed}x${i}`, 40, 55) : acond.nf === "big_bag" && i === 0 ? entre(`${chaveSeed}x${i}`, 26, 36) : entre(`${chaveSeed}x${i}`, 12, 22);
    const chapasQtd = pesoTotal > 0 && pesoTotal <= 500 ? 0 : batido ? 5 : 1;
    const entradaEm = instante(c.data, horario, cursor);
    const saidaEm = instante(c.data, horario, cursor + duracao);
    const linha = tx
      .insert(s.agendamentoArmazem)
      .values({
        agendamentoId: agendamento.id,
        armazemId,
        ordem: i + 1,
        entradaEm,
        saidaEm,
        chapasQtd,
        pesoKg: armazens.length === 1 && pesoTotal > 0 ? String(Math.round(pesoTotal * 100) / 100) : null,
        responsavel: "Gestor de armazém",
      })
      .returning({ id: s.agendamentoArmazem.id })
      .get();
    const empilhadeira = ctx.empilhadeira.get(armazemId);
    if (!batido && chapasQtd > 0 && empilhadeira) tx.insert(s.descargaEquipamento).values({ agendamentoArmazemId: linha.id, equipamentoId: empilhadeira }).run();
    const quem = Array.from({ length: chapasQtd }, (_, k) => ctx.chapaIds[(primeiraChapa + i * 5 + k) % ctx.chapaIds.length]);
    if (quem.length) tx.insert(s.descargaChapa).values([...new Set(quem)].map((chapaId) => ({ agendamentoArmazemId: linha.id, chapaId }))).run();
    evento(tx, agendamento.id, "entrada", "Gestor de armazém", entradaEm, { armazem: armazemId });
    evento(tx, agendamento.id, "saida", "Gestor de armazém", saidaEm, { armazem: armazemId, chapas: chapasQtd });
    cursor += duracao + 5;
    ultimaSaida = saidaEm;
  });
  tx.update(s.agendamento).set({ status: "concluido", chegadaEm, liberacaoEm: ultimaSaida, atualizadoEm: ultimaSaida }).where(eq(s.agendamento.id, agendamento.id)).run();
  evento(tx, agendamento.id, "concluido", "Sistema", ultimaSaida);

  if (divergente) {
    const abertaEm = ultimaSaida;
    const recente = c.data >= somarDias(ctx.hoje, -7);
    tx.insert(s.pendencia)
      .values({
        agendamentoId: agendamento.id,
        tipo: "divergencia_nf_pedido",
        descricao: "Peso da NF diferente do pedido. Carga recebida para resolver depois.",
        status: recente ? "aberta" : "resolvida",
        abertaPor: "Gestor de armazém",
        abertaEm,
        resolvidaPor: recente ? null : "Compras",
        resolvidaEm: recente ? null : instante(somarDias(c.data, 2), "10:00"),
        resolucao: recente ? null : "Nota de devolução parcial emitida pelo fornecedor.",
      })
      .run();
    evento(tx, agendamento.id, "pendencia_aberta", "Gestor de armazém", abertaEm);
  }
  return true;
}

// ───────────── boletins dos dias com folha ─────────────

const TIPO_DO_ARMAZEM: Record<number, string> = { 1: "Agroquímico", 2: "Fertilizantes", 3: "Máquinas / equipamentos" };

function seedBoletins(db: Db, de: string, ate: string, agoraISO: string): number {
  const dias = db.$client
    .prepare("select data, presentes from hist_chapas_dia where considerada = 1 and data between ? and ? and presentes > 0 order by data")
    .all(de, ate) as { data: string; presentes: number }[];
  const matriculas = db.select({ matricula: s.chapa.matricula }).from(s.chapa).where(eq(s.chapa.ativo, true)).all().map((c) => c.matricula);
  const tipos = new Map(db.select().from(s.tipoItem).all().map((t) => [t.nome, t.id]));
  const producao = db.$client.prepare(
    `select ca.armazem_id armazemId, sum(cast(ca.quantidade_boletim as real)) qtd
       from hist_carga_armazem ca join hist_carga c on c.id = ca.hist_carga_id
      where c.data = ? and ca.armazem_id in (1, 2, 3) group by ca.armazem_id`,
  );
  let criados = 0;
  for (const dia of dias) {
    const linhas = (producao.all(dia.data) as { armazemId: number; qtd: number | null }[]).filter((p) => p.qtd && p.qtd > 0 && TIPO_DO_ARMAZEM[p.armazemId]);
    if (linhas.length === 0 || matriculas.length === 0) continue;
    // a folha não diz o armazém: os chapas se dividem pela produção do dia (ao menos um por armazém)
    const presentes = Math.min(dia.presentes, 20, matriculas.length);
    const alvo = linhas.slice(0, Math.max(1, Math.min(linhas.length, presentes)));
    const total = alvo.reduce((t, p) => t + (p.qtd ?? 0), 0);
    let usados = 0;
    const inicio = Math.floor(hash(`bol${dia.data}`) * matriculas.length);
    alvo.forEach((p, i) => {
      const resto = presentes - usados;
      const faltam = alvo.length - i - 1;
      const qtd = i === alvo.length - 1 ? resto : Math.max(1, Math.min(resto - faltam, Math.round((presentes * (p.qtd ?? 0)) / total)));
      const equipe = Array.from({ length: qtd }, (_, k) => matriculas[(inicio + usados + k) % matriculas.length]);
      usados += qtd;
      const tipoId = tipos.get(TIPO_DO_ARMAZEM[p.armazemId]);
      if (!tipoId || equipe.length === 0) return;
      const b = criarBoletim(
        db,
        {
          armazemId: p.armazemId,
          data: dia.data,
          linhas: [{ tipoItemId: tipoId, descarga: String(Math.round(p.qtd ?? 0)) }],
          equipe: equipe.map((matricula, k) => ({ matricula, tipo: qtd > 2 && k === equipe.length - 1 && hash(`${dia.data}${p.armazemId}m`) < 0.25 ? ("meia" as const) : ("completa" as const) })),
          responsavel: "Gestor de armazém",
          observacao: "Reconstituído do histórico real (produção estimada, D29).",
        },
        agoraISO,
      );
      fecharBoletim(db, b.id, agoraISO);
      criados++;
    });
  }
  return criados;
}

// ───────────── ponto de entrada ─────────────

export function seedRetroativo(db: Db, dia: string): string {
  const ate = somarDias(dia, DIAS_A_FRENTE);
  const caminhoes = lerCaminhoes(db, INICIO, ate);
  const fornecedor = new Map(
    db
      .select({ id: s.fornecedor.id, codigo: s.fornecedor.codigo, razaoSocial: s.fornecedor.razaoSocial })
      .from(s.fornecedor)
      .all()
      .filter((f) => f.codigo)
      .map((f) => [f.codigo as string, { id: f.id, razaoSocial: f.razaoSocial }]),
  );
  const produto = new Map(db.select({ id: s.produto.id, item: s.produto.item }).from(s.produto).all().map((p) => [p.item, p.id]));
  const empilhadeira = new Map<number, number>();
  for (const e of db.select().from(s.equipamento).all()) if (e.nome === "Empilhadeira a gás") empilhadeira.set(e.armazemId, e.id);
  const ctx: Contexto = {
    fornecedor,
    produto,
    chapaIds: db.select({ id: s.chapa.id }).from(s.chapa).all().map((c) => c.id),
    empilhadeira,
    armazemIds: new Set(db.select({ id: s.armazem.id }).from(s.armazem).all().map((a) => a.id)),
    nf: new Map(),
    sequencia: 0,
    hoje: dia,
  };

  // um dia por vez: o horário vai para a grade, em rodízio (batido sozinho no horário, unitizados até dois)
  const porDia = new Map<string, Caminhao[]>();
  for (const c of caminhoes) porDia.set(c.data, [...(porDia.get(c.data) ?? []), c]);
  let gravados = 0;
  let picos = 0;
  db.transaction(
    (tx) => {
      for (const [data, lista] of [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const ocupacao = new Map<string, { batido: boolean; n: number }>();
        const estado = data < dia ? ("concluido" as const) : ("agendado" as const);
        for (const c of lista) {
          const batido = acondicionamentoDe(c).ocupacao === "batido";
          let escolhido: string | null = null;
          for (const h of GRADE) {
            const o = ocupacao.get(h) ?? { batido: false, n: 0 };
            if (!o.batido && (batido ? o.n === 0 : o.n < 2)) {
              escolhido = h;
              break;
            }
          }
          const pico = escolhido === null;
          const horario = escolhido ?? GRADE[Math.floor(hash(`${c.codPn}${c.data}g`) * GRADE.length)];
          const o = ocupacao.get(horario) ?? { batido: false, n: 0 };
          ocupacao.set(horario, { batido: o.batido || batido, n: o.n + 1 });
          if (gravarCaminhao(tx, ctx, c, horario, estado, pico)) {
            gravados++;
            if (pico) picos++;
          }
        }
      }
    },
    { behavior: "immediate" },
  );

  const boletins = seedBoletins(db, INICIO, somarDias(dia, -1), `${dia}T07:00:00-03:00`);
  return `${gravados} recebimentos reais reconstituídos de ${INICIO} a ${ate} (${picos} em horário acima da grade), ${boletins} boletins`;
}
