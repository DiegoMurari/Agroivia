import { eq } from "drizzle-orm";

import { dec, deInteiro, dividir, menorQue, multiplicar, paraTexto, paraTextoCasas, somar, subtrair, ZERO, type Valor } from "@/lib/money";

import type { AcondicionamentoNf, NaoRecebimentoMotivo, ValidacaoStatus } from "../enums";
import type { Db } from "../index";
import * as s from "../schema";

/**
 * Dados de demonstração (origem = teste), determinísticos e relativos ao dia D (a data de DEMO_AGORA,
 * uma segunda-feira). Fornecedores, chapas e produtos são escolhidos do cadastro pela posição:
 * este arquivo não cita nome nem CNPJ real. As NF são sintéticas (chave de 44 dígitos inventada).
 *
 * Dia D: 08:00 com 1 batido (cheio), 10:00 com 2 unitizados (cheio), 13:00 com 1 unitizado
 * (sobra uma vaga), 15:00 com um cancelado e a vaga aberta. D+1 e D+2: alguns agendados.
 * 15 dias úteis antes de D: descargas concluídas, não recebimentos, pendências, cancelados e boletins.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const ORIGEM = "teste" as const;
const GRADE = ["08:00", "10:00", "13:00", "15:00"] as const;
const DIAS_ANTERIORES = 15;
const PISO = "90.1731";
const FATOR_MEIA = "0.5";

// ───────────── gerador com semente fixa e datas ─────────────

function gerador(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dois = (n: number) => String(n).padStart(2, "0");

/** Soma dias a uma data YYYY-MM-DD (conta de calendário, sem fuso). */
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

/** Instante ISO com -03:00 a partir da data, do horário HH:MM e de um deslocamento em minutos. */
function instante(data: string, hora: string, maisMinutos = 0): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + maisMinutos;
  return `${data}T${dois(Math.floor(total / 60))}:${dois(total % 60)}:00-03:00`;
}

// ───────────── leitura do cadastro ─────────────

interface Cadastro {
  fornecedores: { id: number; razaoSocial: string; cnpj: string | null }[];
  chapas: { id: number }[];
  armazem: Map<string, number>;
  empilhadeira: Map<number, number>;
  produtos: Record<"FER" | "AGR" | "MAQ", { id: number; descricao: string | null; unidade: string | null }[]>;
  tipoItem: Map<string, { id: number; preco: string }>;
  feriados: Set<string>;
}

function lerCadastro(tx: Tx): Cadastro {
  const fornecedores = tx.select({ id: s.fornecedor.id, razaoSocial: s.fornecedor.razaoSocial, cnpj: s.fornecedor.cnpj }).from(s.fornecedor).all();
  const chapas = tx.select({ id: s.chapa.id }).from(s.chapa).all();
  if (fornecedores.length < 12 || chapas.length < 15) {
    throw new Error(
      `Seed de demonstração precisa dos cadastros (achou ${fornecedores.length} fornecedores e ${chapas.length} funcionários). ` +
        "Confira PACOTE_DIR e rode o db:rebuild de novo.",
    );
  }
  const armazens = tx.select().from(s.armazem).all();
  const armazem = new Map(armazens.map((a) => [a.nome, a.id]));
  const empilhadeira = new Map<number, number>();
  for (const e of tx.select().from(s.equipamento).all()) {
    if (e.nome === "Empilhadeira a gás") empilhadeira.set(e.armazemId, e.id);
  }
  const todos = tx.select({ id: s.produto.id, descricao: s.produto.descricao, unidade: s.produto.unidade, grupo: s.produto.grupo }).from(s.produto).all();
  const doGrupo = (grupo: string) => todos.filter((p) => p.grupo === grupo).slice(0, 40);
  const tipoItem = new Map(tx.select().from(s.tipoItem).all().map((t) => [t.nome, { id: t.id, preco: t.precoUnitario }]));
  const feriados = new Set(tx.select().from(s.feriado).all().map((f) => f.data));
  return {
    fornecedores,
    chapas,
    armazem,
    empilhadeira,
    produtos: { FER: doGrupo("FER"), AGR: doGrupo("AGR"), MAQ: doGrupo("MAQ") },
    tipoItem,
    feriados,
  };
}

// ───────────── agendamento com NF ─────────────

interface Carga {
  acondicionamento: AcondicionamentoNf;
  grupo: "FER" | "AGR" | "MAQ";
  armazem: string;
  pesoKg: number;
  especie: string;
}

const CARGAS: Record<"batido" | "paletizado" | "big_bag" | "maquina", Omit<Carga, "pesoKg">> = {
  batido: { acondicionamento: "batido", grupo: "FER", armazem: "Adubo", especie: "SACO" },
  paletizado: { acondicionamento: "paletizado", grupo: "AGR", armazem: "Insumos", especie: "PALETE" },
  big_bag: { acondicionamento: "big_bag", grupo: "FER", armazem: "Adubo", especie: "BIG BAG" },
  maquina: { acondicionamento: "paletizado", grupo: "MAQ", armazem: "Pátio de Máquinas", especie: "VOLUME" },
};

interface NovoAgendamento {
  data: string;
  horario: string;
  carga: Carga;
  criadoEm: string;
  validacao?: ValidacaoStatus;
  validacaoObs?: string;
  autorizado?: boolean;
}

function criarSemeador(tx: Tx, cad: Cadastro, rnd: () => number) {
  let sequencia = 0;
  const inteiro = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  const escolher = <T>(lista: readonly T[]): T => lista[Math.floor(rnd() * lista.length)];

  function placa(): string {
    const letra = () => String.fromCharCode(65 + inteiro(0, 25));
    return `${letra()}${letra()}${letra()}${inteiro(0, 9)}${letra()}${inteiro(0, 9)}${inteiro(0, 9)}`;
  }

  function fornecedorDaVez() {
    return cad.fornecedores[(sequencia * 37 + 11) % cad.fornecedores.length];
  }

  function carga(tipo: keyof typeof CARGAS): Carga {
    const faixa = { batido: [8000, 27000], paletizado: [1200, 14000], big_bag: [9000, 28000], maquina: [600, 4500] }[tipo];
    return { ...CARGAS[tipo], pesoKg: inteiro(faixa[0] / 100, faixa[1] / 100) * 100 };
  }

  function criarNf(fornecedor: Cadastro["fornecedores"][number], c: Carga, data: string, placaCaminhao: string, criadaEm: string) {
    sequencia++;
    const cnpj = (fornecedor.cnpj ?? "").replace(/\D/g, "").padStart(14, "0").slice(-14);
    const numero = 100000 + sequencia;
    const chave = `35${data.slice(2, 4)}${data.slice(5, 7)}${cnpj}55001${String(numero).padStart(9, "0")}1${String(inteiro(0, 99999999)).padStart(8, "0")}${sequencia % 10}`;
    const reaisPorKg = { FER: 3, AGR: 48, MAQ: 22 }[c.grupo];
    const nf = tx
      .insert(s.notaFiscal)
      .values({
        chaveAcesso: chave,
        numero: String(numero),
        serie: "1",
        emitenteCnpj: cnpj,
        emitenteNome: fornecedor.razaoSocial,
        fornecedorId: fornecedor.id,
        emitidaEm: instante(somarDias(data, -1), "16:00"),
        valorTotal: `${c.pesoKg * reaisPorKg}.${dois(inteiro(0, 99))}`,
        pesoBrutoKg: String(c.pesoKg + inteiro(1, 9) * 10),
        pesoLiquidoKg: String(c.pesoKg),
        volumes: String(c.acondicionamento === "batido" ? c.pesoKg / 50 : Math.max(1, Math.round(c.pesoKg / 1000))),
        especie: c.especie,
        placa: placaCaminhao,
        pedidoFornecedor: `PF-${4000 + sequencia}`,
        formaEntrada: "manual",
        origem: ORIGEM,
        criadaEm,
      })
      .returning({ id: s.notaFiscal.id })
      .get();

    const produto = cad.produtos[c.grupo].length ? escolher(cad.produtos[c.grupo]) : null;
    tx.insert(s.notaFiscalItem)
      .values({
        notaFiscalId: nf.id,
        codigoFornecedor: `F${1000 + sequencia}`,
        descricao: produto?.descricao ?? `Item de demonstração (${c.grupo})`,
        quantidade: String(c.acondicionamento === "batido" ? c.pesoKg / 50 : Math.max(1, Math.round(c.pesoKg / 1000))),
        unidade: produto?.unidade ?? "UN",
        valorUnitario: `${reaisPorKg * 50}.00`,
        produtoId: produto?.id ?? null,
      })
      .run();
    return nf.id;
  }

  function criarAgendamento(novo: NovoAgendamento) {
    const fornecedor = fornecedorDaVez();
    const placaCaminhao = placa();
    const validacao = novo.validacao ?? "aguardando";
    const validado = validacao !== "aguardando";
    const autorizado = novo.autorizado ?? false;
    const nfId = criarNf(fornecedor, novo.carga, novo.data, placaCaminhao, novo.criadoEm);

    const compra = tx
      .insert(s.compra)
      .values({
        fornecedorId: fornecedor.id,
        numeroPedido: String(30000 + sequencia),
        descricao: `Compra de demonstração ${sequencia}`,
        token: `demo-usado-${sequencia}`,
        status: "confirmada",
        criadaPor: "Compras",
        criadaEm: novo.criadoEm,
        preenchidaEm: novo.criadoEm,
        origem: ORIGEM,
      })
      .returning({ id: s.compra.id })
      .get();

    const agendamento = tx
      .insert(s.agendamento)
      .values({
        compraId: compra.id,
        fornecedorId: fornecedor.id,
        data: novo.data,
        horario: novo.horario,
        placa: placaCaminhao,
        transportadora: `Transportadora de demonstração ${1 + (sequencia % 6)}`,
        acondicionamentoOcupacao: novo.carga.acondicionamento === "batido" ? "batido" : "unitizado",
        pesoDeclaradoKg: String(novo.carga.pesoKg),
        validacaoStatus: validacao,
        validacaoObs: novo.validacaoObs,
        validadoPor: validado ? "Compras" : null,
        validadoEm: validado ? novo.criadoEm : null,
        autorizadoPor: autorizado ? `Responsável ${novo.carga.armazem}` : null,
        autorizadoEm: autorizado ? novo.criadoEm : null,
        origem: ORIGEM,
        criadoEm: novo.criadoEm,
        atualizadoEm: novo.criadoEm,
      })
      .returning({ id: s.agendamento.id })
      .get();

    tx.insert(s.agendamentoNf).values({ agendamentoId: agendamento.id, notaFiscalId: nfId, acondicionamento: novo.carga.acondicionamento }).run();
    evento(agendamento.id, "agendado", "Fornecedor", novo.criadoEm);
    if (validado) evento(agendamento.id, "validado", "Compras", novo.criadoEm, { validacao });
    if (autorizado) evento(agendamento.id, "autorizado", `Responsável ${novo.carga.armazem}`, novo.criadoEm);
    return { id: agendamento.id, fornecedorId: fornecedor.id, placa: placaCaminhao };
  }

  function evento(agendamentoId: number, tipo: string, autor: string, criadoEm: string, detalhe?: unknown) {
    tx.insert(s.evento)
      .values({ agendamentoId, tipo, autor, criadoEm, detalhe: detalhe === undefined ? null : JSON.stringify(detalhe) })
      .run();
  }

  return { inteiro, escolher, carga, criarAgendamento, evento, placa, fornecedorDaVez };
}

type Semeador = ReturnType<typeof criarSemeador>;

// ───────────── dia D e dias seguintes ─────────────

function seedDiaD(tx: Tx, cad: Cadastro, sem: Semeador, diaD: string): number {
  const sexta = instante(somarDias(diaD, -3), "10:00");
  const adubo = cad.armazem.get("Adubo")!;

  // 08:00: um batido, conforme e autorizado, com o destino já definido (horário cheio)
  const a1 = sem.criarAgendamento({ data: diaD, horario: "08:00", carga: sem.carga("batido"), criadoEm: sexta, validacao: "conforme", autorizado: true });
  tx.insert(s.agendamentoArmazem).values({ agendamentoId: a1.id, armazemId: adubo, ordem: 1 }).run();
  sem.evento(a1.id, "destino_definido", "Responsável Adubo", sexta, { armazens: ["Adubo"] });

  // 10:00: dois unitizados (cheio); um deles com divergência
  sem.criarAgendamento({
    data: diaD,
    horario: "10:00",
    carga: sem.carga("paletizado"),
    criadoEm: sexta,
    validacao: "divergente",
    validacaoObs: "Quantidade da NF maior que a do pedido.",
  });
  sem.criarAgendamento({ data: diaD, horario: "10:00", carga: sem.carga("big_bag"), criadoEm: sexta });

  // 13:00: um unitizado (sobra uma vaga)
  sem.criarAgendamento({ data: diaD, horario: "13:00", carga: sem.carga("paletizado"), criadoEm: sexta });

  // 15:00: um cancelado, com a vaga aberta
  const canceladoEm = instante(somarDias(diaD, -3), "16:30");
  const a5 = sem.criarAgendamento({ data: diaD, horario: "15:00", carga: sem.carga("big_bag"), criadoEm: sexta });
  tx.update(s.agendamento)
    .set({ status: "cancelado", motivoCancelamento: "Caminhão quebrou na estrada.", canceladoPor: "Fornecedor", canceladoEm, atualizadoEm: canceladoEm })
    .where(sqlId(a5.id))
    .run();
  sem.evento(a5.id, "cancelado", "Fornecedor", canceladoEm, { motivo: "Caminhão quebrou na estrada." });
  tx.insert(s.vagaLiberada).values({ data: diaD, horario: "15:00", origemAgendamentoId: a5.id }).run();

  // D+1 e D+2 (pulando fim de semana e feriado): dois ou três cada
  let criados = 5;
  let data = diaD;
  for (const quantos of [3, 2]) {
    data = proximoDiaUtil(data, cad.feriados);
    const tipos = ["batido", "paletizado", "big_bag"] as const;
    for (let i = 0; i < quantos; i++) {
      sem.criarAgendamento({ data, horario: GRADE[i], carga: sem.carga(tipos[i]), criadoEm: sexta });
      criados++;
    }
  }
  return criados;
}

function proximoDiaUtil(data: string, feriados: Set<string>, passo = 1): string {
  let d = somarDias(data, passo);
  while (diaDaSemana(d) === 0 || diaDaSemana(d) === 6 || feriados.has(d)) d = somarDias(d, passo);
  return d;
}

const sqlId = (id: number) => eq(s.agendamento.id, id);

function seedComprasComLink(tx: Tx, cad: Cadastro, diaD: string): number {
  const criadaEm = instante(somarDias(diaD, -3), "09:00");
  const grupos = ["FER", "AGR", "MAQ"] as const;
  grupos.forEach((grupo, i) => {
    const fornecedor = cad.fornecedores[(i * 53 + 5) % cad.fornecedores.length];
    const compra = tx
      .insert(s.compra)
      .values({
        fornecedorId: fornecedor.id,
        numeroPedido: String(31001 + i),
        descricao: `Compra de demonstração para o link ${i + 1}`,
        token: `demo-compra-${i + 1}`,
        status: "criada",
        criadaPor: "Compras",
        criadaEm,
        origem: ORIGEM,
      })
      .returning({ id: s.compra.id })
      .get();
    const itens = cad.produtos[grupo].slice(0, 2);
    if (itens.length === 0) return;
    tx.insert(s.compraItem)
      .values(
        itens.map((p, j) => ({
          compraId: compra.id,
          produtoId: p.id,
          descricao: p.descricao,
          quantidade: String(grupo === "MAQ" ? 1 + j : 200 + 100 * j),
          unidade: p.unidade,
          pesoKg: String(grupo === "MAQ" ? 900 + 300 * j : 10000 + 5000 * j),
        })),
      )
      .run();
  });
  return grupos.length;
}

// ───────────── 15 dias úteis anteriores ─────────────

interface Concluido {
  id: number;
  data: string;
  horario: string;
  fornecedorId: number;
}

function concluir(tx: Tx, cad: Cadastro, sem: Semeador, data: string, horario: string, tipo: keyof typeof CARGAS, doisArmazens: boolean, chapasDoDia: number[]): Concluido {
  const criadoEm = instante(somarDias(data, -2), "11:00");
  const c = sem.carga(tipo);
  const ag = sem.criarAgendamento({ data, horario, carga: c, criadoEm, validacao: "conforme", autorizado: true });

  const chegada = sem.inteiro(-20, 10);
  const espera = sem.inteiro(5, 60);
  const chegadaEm = instante(data, horario, chegada);
  sem.evento(ag.id, "chegou", "Portaria", chegadaEm);

  const destinos = doisArmazens ? [c.armazem, c.armazem === "Insumos" ? "Adubo" : "Insumos"] : [c.armazem];
  let cursor = chegada + espera;
  let ultimaSaida = chegadaEm;
  destinos.forEach((nome, i) => {
    const armazemId = cad.armazem.get(nome)!;
    const batido = c.acondicionamento === "batido" && i === 0;
    const duracao = batido ? sem.inteiro(40, 50) : c.acondicionamento === "big_bag" && i === 0 ? sem.inteiro(26, 34) : sem.inteiro(12, 18);
    const chapasQtd = batido ? 5 : 1;
    const entradaEm = instante(data, horario, cursor);
    const saidaEm = instante(data, horario, cursor + duracao);
    const linha = tx
      .insert(s.agendamentoArmazem)
      .values({
        agendamentoId: ag.id,
        armazemId,
        ordem: i + 1,
        entradaEm,
        saidaEm,
        chapasQtd,
        pesoKg: String(destinos.length === 1 ? c.pesoKg : i === 0 ? c.pesoKg - 500 : 500),
        responsavel: `Responsável ${nome}`,
      })
      .returning({ id: s.agendamentoArmazem.id })
      .get();
    const empilhadeira = cad.empilhadeira.get(armazemId);
    if (!batido && empilhadeira) tx.insert(s.descargaEquipamento).values({ agendamentoArmazemId: linha.id, equipamentoId: empilhadeira }).run();
    const quem = chapasDoDia.slice(i * 5, i * 5 + chapasQtd);
    if (quem.length) tx.insert(s.descargaChapa).values(quem.map((chapaId) => ({ agendamentoArmazemId: linha.id, chapaId }))).run();
    sem.evento(ag.id, "entrada", `Responsável ${nome}`, entradaEm, { armazem: nome });
    sem.evento(ag.id, "saida", `Responsável ${nome}`, saidaEm, { armazem: nome, chapas: chapasQtd });
    cursor += duracao + 5;
    ultimaSaida = saidaEm;
  });

  tx.update(s.agendamento).set({ status: "concluido", chegadaEm, liberacaoEm: ultimaSaida, atualizadoEm: ultimaSaida }).where(sqlId(ag.id)).run();
  sem.evento(ag.id, "concluido", "Sistema", ultimaSaida);
  return { id: ag.id, data, horario, fornecedorId: ag.fornecedorId };
}

/** Boletim fechado pela fórmula do PRD, com decimal.js. Devolve nada: grava boletim, linhas e chapas. */
function criarBoletim(tx: Tx, cad: Cadastro, sem: Semeador, armazemNome: string, data: string, chapaIds: number[]) {
  const linhasPorArmazem: Record<string, [tipo: string, min: number, max: number][]> = {
    Adubo: [
      ["Fertilizantes", 900, 2800],
      ["Sacaria malas c/50", 100, 600],
      ["Serviços diversos", 20, 80],
      ["Agroquímico", 10, 60],
      ["Sacaria fardo c/250", 10, 40],
      ["Sacaria malas c/40", 50, 200],
    ],
    Insumos: [
      ["Agroquímico", 300, 1500],
      ["Sementes", 100, 700],
      ["Serviços diversos", 20, 90],
      ["Sacaria malas c/25", 100, 500],
      ["Medicamentos", 50, 300],
      ["Alimentação animal", 100, 600],
    ],
    "Pátio de Máquinas": [
      ["Máquinas / equipamentos", 80, 700],
      ["Peças", 100, 900],
      ["Serviços diversos", 20, 100],
      ["Acessórios agropecuários", 50, 400],
    ],
  };
  const opcoes = linhasPorArmazem[armazemNome];
  const quantas = Math.min(opcoes.length, sem.inteiro(3, 6));
  // A linha principal acompanha o tamanho da equipe, para o valor por diária ficar em torno do piso
  // (dias com complemento e dias sem); as outras linhas são pequenas.
  const linhas = opcoes.slice(0, quantas).map(([tipo, min, max], i) => {
    const item = cad.tipoItem.get(tipo)!;
    const descarga = i === 0 ? chapaIds.length * sem.inteiro(150, 330) : sem.inteiro(Math.ceil(min / 10), Math.ceil(max / 10));
    const remocao = sem.inteiro(0, 3) === 0 ? sem.inteiro(10, Math.max(11, Math.floor(max / 6))) : 0;
    const transferencia = sem.inteiro(0, 5) === 0 ? sem.inteiro(5, 60) : 0;
    const quantidade = deInteiro(descarga + remocao + transferencia);
    return { tipoItemId: item.id, descarga, remocao, transferencia, quantidade, preco: item.preco, valor: multiplicar(quantidade, item.preco) };
  });

  const meias = chapaIds.length > 2 && sem.inteiro(0, 2) === 0 ? 1 : 0;
  const producao = linhas.reduce<Valor>((total, l) => somar(total, l.valor), ZERO);
  const diarias = subtrair(deInteiro(chapaIds.length), multiplicar(deInteiro(meias), FATOR_MEIA));
  const porDiaria = dividir(producao, diarias);
  const abaixoDoPiso = menorQue(porDiaria, PISO);
  const total = abaixoDoPiso ? multiplicar(PISO, diarias) : producao;
  const complemento = abaixoDoPiso ? subtrair(total, producao) : ZERO;
  const fechadoEm = instante(somarDias(data, 1), "07:20");

  const boletim = tx
    .insert(s.boletim)
    .values({
      armazemId: cad.armazem.get(armazemNome)!,
      data,
      status: "fechado",
      producaoTotal: paraTexto(producao),
      diariasEquivalentes: paraTexto(diarias),
      valorPorDiaria: paraTexto(dec(paraTextoCasas(porDiaria, 10))),
      totalAPagar: paraTexto(total),
      complemento: paraTexto(complemento),
      pisoUsado: PISO,
      fatorMeiaUsado: FATOR_MEIA,
      responsavel: `Responsável ${armazemNome}`,
      origem: ORIGEM,
      criadoEm: fechadoEm,
      atualizadoEm: fechadoEm,
      fechadoEm,
    })
    .returning({ id: s.boletim.id })
    .get();

  tx.insert(s.boletimLinha)
    .values(
      linhas.map((l) => ({
        boletimId: boletim.id,
        tipoItemId: l.tipoItemId,
        qtdDescarga: String(l.descarga),
        qtdRemocao: String(l.remocao),
        qtdTransferencia: String(l.transferencia),
        quantidadeTotal: paraTexto(l.quantidade),
        precoUsado: l.preco,
        valor: paraTexto(l.valor),
      })),
    )
    .run();
  tx.insert(s.boletimChapa)
    .values(chapaIds.map((chapaId, i) => ({ boletimId: boletim.id, chapaId, data, tipoDiaria: i < meias ? ("meia" as const) : ("completa" as const) })))
    .run();
}

function seedDiasAnteriores(tx: Tx, cad: Cadastro, sem: Semeador, diaD: string) {
  const dias: string[] = [];
  let data = diaD;
  for (let i = 0; i < DIAS_ANTERIORES; i++) {
    data = proximoDiaUtil(data, cad.feriados, -1);
    dias.unshift(data);
  }

  const concluidos: Concluido[] = [];
  /** Vagas que sobraram em cada dia: [data, horário]. Usadas pelos não recebimentos e cancelados. */
  const livres: [string, string][] = [];
  let contador = 0;
  let boletins = 0;

  dias.forEach((dia, indice) => {
    // Chapas do dia: cada uma em um só boletim (Adubo 3 a 8, Insumos 2 a 5, Pátio 2 a 3).
    const rodizio = cad.chapas.map((_, i) => cad.chapas[(i + indice * 7) % cad.chapas.length].id);
    const nAdubo = sem.inteiro(3, 8);
    const nInsumos = sem.inteiro(2, 5);
    const nPatio = sem.inteiro(2, 3);
    criarBoletim(tx, cad, sem, "Adubo", dia, rodizio.slice(0, nAdubo));
    criarBoletim(tx, cad, sem, "Insumos", dia, rodizio.slice(nAdubo, nAdubo + nInsumos));
    criarBoletim(tx, cad, sem, "Pátio de Máquinas", dia, rodizio.slice(nAdubo + nInsumos, nAdubo + nInsumos + nPatio));
    boletins += 3;

    // De 4 a 7 descargas respeitando a ocupação: por horário, 1 batido ou até 2 unitizados.
    const alvo = sem.inteiro(4, 7);
    let noDia = 0;
    GRADE.forEach((horario, h) => {
      const faltam = alvo - noDia;
      const horariosRestantes = GRADE.length - h;
      if (faltam <= 0) {
        livres.push([dia, horario]);
        return;
      }
      const precisaDeDois = faltam > horariosRestantes;
      const batido = !precisaDeDois && sem.inteiro(0, 3) === 0;
      const tipos: (keyof typeof CARGAS)[] = batido
        ? ["batido"]
        : precisaDeDois || sem.inteiro(0, 1) === 0
          ? [sem.escolher(["paletizado", "big_bag", "maquina"] as const), sem.escolher(["paletizado", "big_bag"] as const)]
          : [sem.escolher(["paletizado", "big_bag", "maquina"] as const)];
      for (const tipo of tipos.slice(0, faltam)) {
        contador++;
        concluidos.push(concluir(tx, cad, sem, dia, horario, tipo, contador % 5 === 0, rodizio));
        noDia++;
      }
      if (!batido && tipos.length === 1) livres.push([dia, horario]);
    });
  });

  // 4 não recebimentos, um por motivo. O "sem agendamento e sem vaga" não tem agendamento.
  const motivos: NaoRecebimentoMotivo[] = ["divergencia_nota_pedido", "caso_fortuito", "outro", "sem_agendamento_sem_vaga"];
  motivos.forEach((motivo, i) => {
    const [dia, horario] = livres[(i * 5 + 2) % livres.length] ?? [dias[i], "15:00"];
    const registradoEm = instante(dia, horario, 15);
    if (motivo === "sem_agendamento_sem_vaga") {
      const fornecedor = sem.fornecedorDaVez();
      tx.insert(s.naoRecebimento)
        .values({ fornecedorId: fornecedor.id, placa: sem.placa(), motivo, descricao: "Chegou sem agendar e o dia estava cheio.", registradoPor: "Portaria", registradoEm, origem: ORIGEM })
        .run();
      return;
    }
    livres.splice((i * 5 + 2) % Math.max(1, livres.length), 1);
    const ag = sem.criarAgendamento({
      data: dia,
      horario,
      carga: sem.carga("paletizado"),
      criadoEm: instante(somarDias(dia, -2), "11:00"),
      validacao: motivo === "divergencia_nota_pedido" ? "divergente" : "conforme",
    });
    tx.update(s.agendamento).set({ status: "nao_recebido", chegadaEm: instante(dia, horario, 5), atualizadoEm: registradoEm }).where(sqlId(ag.id)).run();
    const descricao = { divergencia_nota_pedido: "Produto diferente do pedido.", caso_fortuito: "Queda de energia no armazém.", outro: "Carga chegou molhada." }[motivo];
    tx.insert(s.naoRecebimento)
      .values({ agendamentoId: ag.id, fornecedorId: ag.fornecedorId, placa: ag.placa, motivo, descricao, registradoPor: "Responsável Insumos", registradoEm, origem: ORIGEM })
      .run();
    sem.evento(ag.id, "nao_recebido", "Responsável Insumos", registradoEm, { motivo });
  });

  // 2 pendências de divergência em cargas que entraram: uma aberta, uma resolvida.
  [concluidos[3], concluidos[Math.floor(concluidos.length / 2)]].forEach((c, i) => {
    const abertaEm = instante(c.data, c.horario, 40);
    tx.update(s.agendamento).set({ validacaoStatus: "divergente", validacaoObs: "Peso da NF diferente do pedido." }).where(sqlId(c.id)).run();
    tx.insert(s.pendencia)
      .values({
        agendamentoId: c.id,
        tipo: "divergencia_nf_pedido",
        descricao: "Peso da NF diferente do pedido. Carga recebida para resolver depois.",
        status: i === 0 ? "aberta" : "resolvida",
        abertaPor: "Responsável Insumos",
        abertaEm,
        resolvidaPor: i === 0 ? null : "Compras",
        resolvidaEm: i === 0 ? null : instante(somarDias(c.data, 1), "10:00"),
        resolucao: i === 0 ? null : "Fornecedor emitiu nota complementar.",
      })
      .run();
    sem.evento(c.id, "pendencia_aberta", "Responsável Insumos", abertaEm);
    if (i === 1) sem.evento(c.id, "pendencia_resolvida", "Compras", instante(somarDias(c.data, 1), "10:00"));
  });

  // 2 cancelados com vaga liberada (cancelado não conta na ocupação).
  [dias[4], dias[10]].forEach((dia, i) => {
    const horario = GRADE[i + 1];
    const canceladoEm = instante(somarDias(dia, -1), "15:00");
    const ag = sem.criarAgendamento({ data: dia, horario, carga: sem.carga("big_bag"), criadoEm: instante(somarDias(dia, -3), "11:00") });
    tx.update(s.agendamento)
      .set({ status: "cancelado", motivoCancelamento: "Fornecedor pediu nova data.", canceladoPor: "Fornecedor", canceladoEm, atualizadoEm: canceladoEm })
      .where(sqlId(ag.id))
      .run();
    sem.evento(ag.id, "cancelado", "Fornecedor", canceladoEm);
    tx.insert(s.vagaLiberada).values({ data: dia, horario, origemAgendamentoId: ag.id }).run();
  });

  return { concluidos: concluidos.length, boletins, dias: dias.length };
}

// ───────────── entrada ─────────────

export function seedDemo(db: Db, diaD: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaD)) throw new Error(`Dia D inválido: "${diaD}".`);
  return db.transaction((tx) => {
    const cad = lerCadastro(tx);
    const sem = criarSemeador(tx, cad, gerador(20261005));
    const links = seedComprasComLink(tx, cad, diaD);
    const futuros = seedDiaD(tx, cad, sem, diaD);
    const antes = seedDiasAnteriores(tx, cad, sem, diaD);
    return (
      `${links} compras com link (demo-compra-1 a ${links}), ${futuros} agendamentos do dia D em diante, ` +
      `${antes.concluidos} descargas concluídas e ${antes.boletins} boletins em ${antes.dias} dias úteis, ` +
      "4 não recebimentos, 2 pendências, 3 cancelados com vaga liberada"
    );
  });
}
