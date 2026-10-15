import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

import { autorizarCarga, definirDestino, registrarChegada, registrarEntrada, registrarSaida } from "@/lib/agendamento/descarga";
import { adicionarChapaNaEquipe, criarEquipe } from "@/lib/equipes/servico";
import { criarPedido, decidirPedido } from "@/lib/agendamento/pedido";
import { cadastrarFornecedor, decidirCadastro, TOKEN_ABERTO } from "@/lib/aprovacoes/cadastro";
import { createDb, schema } from "@/lib/db";
import { ErroDeRegra } from "@/lib/http";
import { arquivoAncoraDe } from "@/lib/relogio";

/**
 * Prepara a demo para a apresentação, a partir da matriz data/base.db:
 *   npm run demo:preparar            → recria data/demo.db
 *   npm run demo:preparar -- ensaio  → ensaio em data/ensaio.db (não mexe na demo)
 * Pare o servidor antes (o banco é recriado) e suba de novo depois. Rode uns 10 min antes
 * de apresentar: o relógio da demo parte de DEMO_AGORA no instante em que o script termina.
 *
 * Cenário (hoje = 31/08, 12:50): fornecedor Nutrimix criado pelo emitente da NF, com dois pedidos
 * aprovados para 13:00 (um com a nota que vai bater, um com a nota que NÃO vai bater na portaria),
 * um pedido aguardando Compras e um recusado por Compras, para amanhã.
 */

const NOME = process.argv[2] ?? "demo";
const DESTINO = `data/${NOME}.db`;
const BASE = "data/base.db";
const SENHA = "agrovia2026";
const PASTA_NF = path.join(process.env.PACOTE_DIR ?? "PACOTE_DIR-nao-definido", "01_notas_fiscais");
const SAIDA = "data/apresentacao";

const HOJE = "2026-08-31";
const AMANHA = "2026-09-01";
const CEDO = `${HOJE}T07:00:00-03:00`;

/** Notas reais da Nutrimix (emitente 11.222.333/0001-81). Todas livres no banco base. */
const NF = {
  bate: { chave: "35250711222333000181550500002225451296572370", papel: "BATE: nota do pedido das 13:00 e a que o caminhão traz" },
  pedidoErrado: { chave: "35250711222333000181550500002224551527158168", papel: "NÃO BATE (1/2): nota que o fornecedor anexou no pedido" },
  caminhao: { chave: "35250711222333000181550500002225471688174045", papel: "NÃO BATE (2/2): nota que o caminhão traz; também é a nota certa para reenviar" },
  ao_vivo: { chave: "35250811222333000181550500002233001850527840", papel: "AO VIVO: criar um pedido novo diante da banca" },
  aguardando: { chave: "35250811222333000181550500002234821191868683", papel: "pedido de amanhã aguardando Compras" },
  recusada: { chave: "35250811222333000181550500002238021402032963", papel: "pedido de amanhã recusado por Compras" },
} as const;

function lerXml(chave: string): Buffer {
  return fs.readFileSync(path.join(PASTA_NF, "xml", `${chave}.xml`));
}

/** Chaves de big bag ainda livres de um emitente, lidas dos XMLs do pacote. */
function notasLivres(db: ReturnType<typeof createDb>, cnpj: string, quantas: number): string[] {
  const usadas = new Set((db.$client.prepare("select chave_acesso from nota_fiscal").all() as { chave_acesso: string }[]).map((r) => r.chave_acesso));
  const achadas: string[] = [];
  for (const arquivo of fs.readdirSync(path.join(PASTA_NF, "xml"))) {
    const chave = arquivo.replace(/\.xml$/, "");
    if (usadas.has(chave) || chave.slice(6, 20) !== cnpj) continue;
    if (!/<esp>[^<]*BIG/i.test(fs.readFileSync(path.join(PASTA_NF, "xml", arquivo), "utf8"))) continue;
    achadas.push(chave);
    if (achadas.length === quantas) return achadas;
  }
  throw new Error(`Sem ${quantas} notas de big bag livres para o CNPJ ${cnpj}.`);
}

function recriarBanco(): void {
  if (!fs.existsSync(BASE)) throw new Error(`${BASE} não existe. Rode npm run db:rebuild primeiro.`);
  for (const a of [DESTINO, `${DESTINO}-wal`, `${DESTINO}-shm`, arquivoAncoraDe(DESTINO)]) {
    try {
      fs.rmSync(a, { force: true });
    } catch {
      throw new Error(`${DESTINO} está em uso. Pare o servidor da porta 8000 e repita.`);
    }
  }
  const base = new Database(BASE, { fileMustExist: true });
  try {
    base.prepare("VACUUM INTO ?").run(DESTINO);
  } finally {
    base.close();
  }
}

/** Apaga o agendamento e tudo que depende dele, descobrindo as chaves estrangeiras pelo próprio banco. */
function apagarAgendamento(sqlite: Database.Database, id: number): void {
  const filhos = (tabela: string, ids: number[]): void => {
    if (ids.length === 0) return;
    const marcas = ids.map(() => "?").join(",");
    for (const t of sqlite.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[]) {
      for (const fk of sqlite.prepare(`pragma foreign_key_list(${t.name})`).all() as { table: string; from: string; to: string }[]) {
        if (fk.table !== tabela) continue;
        const pais = sqlite.prepare(`select rowid as id from ${t.name} where ${fk.from} in (${marcas})`).all(...ids) as { id: number }[];
        if (t.name === tabela) continue;
        if (pais.length > 0) filhos(t.name, pais.map((p) => p.id));
        sqlite.prepare(`delete from ${t.name} where ${fk.from} in (${marcas})`).run(...ids);
      }
    }
  };
  filhos("agendamento", [id]);
  sqlite.prepare("delete from agendamento where id = ?").run(id);
}

function main(): void {
  const demoAgora = process.env.DEMO_AGORA;
  if (!demoAgora?.startsWith(`${HOJE}T`)) throw new Error(`DEMO_AGORA deve ser de ${HOJE} (ex.: ${HOJE}T12:50:00-03:00). Ajuste o .env.`);

  recriarBanco();
  const db = createDb(DESTINO, { fileMustExist: true });
  const compras = db.select().from(schema.usuario).where(eq(schema.usuario.email, "compras@agrovia.com.br")).get();
  if (!compras) throw new Error("Usuário de Compras não encontrado na base.");

  // Libera as vagas de hoje que a base reserva para pedidos ainda por chegar (o cenário abaixo as ocupa).
  const livres = db.$client.prepare("select id from agendamento where data = ? and status = 'agendado'").all(HOJE) as { id: number }[];
  for (const l of livres) apagarAgendamento(db.$client, l.id);

  // Fornecedor criado a partir do emitente da nota.
  const { usuarioId, cadastroId } = cadastrarFornecedor(
    db,
    TOKEN_ABERTO,
    {
      razaoSocial: "NUTRIMIX BRASIL FERTILIZANTES S/A",
      nomeFantasia: "Nutrimix Brasil",
      cnpj: "11222333000181",
      email: "nutrimix@nutrimix.com.br",
      telefone: "(16) 3000-1000",
      responsavel: "Logística Nutrimix",
      tiposMercadoria: ["FER"],
      senha: SENHA,
    },
    CEDO,
  );
  decidirCadastro(db, cadastroId, "aprovado", compras.id, CEDO);

  const pedido = (data: string, horario: string, chave: string) =>
    criarPedido(
      db,
      usuarioId,
      { data, horario, tipoMercadoria: "FER", arquivos: [{ nome: `${chave}.xml`, conteudo: lerXml(chave), acondicionamento: "big_bag" }], enviar: true },
      CEDO,
    ).agendamentoId;
  const decisor = { id: compras.id, nome: "Compras Agrovia" };

  // Movimento do dia: outros fornecedores reais, com cargas já concluídas, em descarga e a chegar.
  const adubo = db.select().from(schema.armazem).where(eq(schema.armazem.nome, "Adubo")).get();
  if (!adubo) throw new Error("Armazém Adubo não encontrado na base.");
  const outros = [
    { razaoSocial: "NORDESTE COMERCIO DE FERTILIZANTES E TRANSPORTES LTDA", nomeFantasia: "Nordeste Fertilizantes", cnpj: "06370663000184", email: "logistica@nordestefertilizantes.com.br", responsavel: "Logística Nordeste" },
    { razaoSocial: "FERTILIZANTES HERINGER S.A.", nomeFantasia: "Heringer", cnpj: "22266175001311", email: "logistica@heringer.com.br", responsavel: "Logística Heringer" },
  ].map((f) => {
    const r = cadastrarFornecedor(db, TOKEN_ABERTO, { ...f, telefone: "(16) 3000-2000", tiposMercadoria: ["FER"], senha: SENHA }, CEDO);
    decidirCadastro(db, r.cadastroId, "aprovado", compras.id, CEDO);
    return { usuarioId: r.usuarioId, notas: notasLivres(db, f.cnpj, 3) };
  });
  const [nordeste, heringer] = outros;
  const portaria = "Portaria Agrovia";
  const dia = (hora: string) => `${HOJE}T${hora}:00-03:00`;
  const carga = (f: (typeof outros)[number], n: number, horario: string): number => {
    const chave = f.notas[n];
    const id = criarPedido(db, f.usuarioId, { data: HOJE, horario, tipoMercadoria: "FER", arquivos: [{ nome: `${chave}.xml`, conteudo: lerXml(chave), acondicionamento: "big_bag" }], enviar: true }, CEDO).agendamentoId;
    decidirPedido(db, decisor, { id, decisao: "aprovado" }, dia("07:20"));
    return id;
  };
  const chegar = (id: number, hora: string): void => {
    const ag = db.select().from(schema.agendamento).where(eq(schema.agendamento.id, id)).get()!;
    registrarChegada(db, id, { placa: null, pesoBalancaKg: ag.pesoDeclaradoKg }, portaria, dia(hora));
    autorizarCarga(db, id, portaria, dia(hora));
  };
  const descarregar = (id: number, entrada: string): void => {
    definirDestino(db, id, [adubo.id], portaria, dia(entrada));
    registrarEntrada(db, id, adubo.id, "Gestor de Armazém", dia(entrada));
  };
  const concluir = (id: number, chapas: number, saida: string): void => {
    registrarSaida(db, id, adubo.id, { chapasQtd: chapas, equipamentoIds: [] }, "Gestor de Armazém", dia(saida));
  };

  const c1 = carga(nordeste, 0, "08:00");
  chegar(c1, "07:58"); descarregar(c1, "08:05"); concluir(c1, 6, "08:50");
  const c2 = carga(heringer, 0, "08:00");
  chegar(c2, "08:10"); descarregar(c2, "08:20"); concluir(c2, 5, "09:10");
  const c3 = carga(nordeste, 1, "10:00");
  chegar(c3, "09:55"); descarregar(c3, "10:05"); concluir(c3, 6, "10:55");
  const c4 = carga(heringer, 1, "10:00");
  chegar(c4, "10:10"); descarregar(c4, "12:15");
  carga(nordeste, 2, "15:00");
  carga(heringer, 2, "15:00");

  // Escala de hoje: duas equipes com chapas reais da base. O boletim de hoje fica para lançar ao vivo.
  const insumos = db.select().from(schema.armazem).where(eq(schema.armazem.nome, "Insumos")).get();
  const chapas = db.select().from(schema.chapa).where(eq(schema.chapa.ativo, true)).all().slice(0, 8);
  const escala: [string, number | undefined, string, string[]][] = [
    ["Equipe Adubo", adubo.id, "Descarga de fertilizantes", chapas.slice(0, 5).map((x) => x.nome)],
    ["Equipe Insumos", insumos?.id, "Descarga e organização de insumos", chapas.slice(5, 8).map((x) => x.nome)],
  ];
  for (const [nome, armazemId, tarefa, nomes] of escala) {
    const eq_ = criarEquipe(db, { data: HOJE, nome, armazemId, tarefa, horarioInicio: "07:00", horarioFim: "17:00" }, CEDO);
    for (const n of nomes) adicionarChapaNaEquipe(db, eq_.id, n);
  }

  const bate = pedido(HOJE, "13:00", NF.bate.chave);
  const errado = pedido(HOJE, "13:00", NF.pedidoErrado.chave);
  decidirPedido(db, decisor, { id: bate, decisao: "aprovado" }, `${HOJE}T07:30:00-03:00`);
  decidirPedido(db, decisor, { id: errado, decisao: "aprovado" }, `${HOJE}T07:31:00-03:00`);

  // Os pedidos de amanhã vão para a primeira vaga que a agenda da base deixar livre.
  const proximaVaga = (chave: string): number => {
    for (const data of [AMANHA, "2026-09-02", "2026-09-03", "2026-09-04"]) {
      for (const horario of ["08:00", "10:00", "13:00", "15:00"]) {
        try {
          return pedido(data, horario, chave);
        } catch (e) {
          if (!(e instanceof ErroDeRegra) || e.status !== 409) throw e;
        }
      }
    }
    throw new Error("Sem vaga livre nos próximos dias para o pedido futuro.");
  };
  const aguardando = proximaVaga(NF.aguardando.chave);
  const recusado = proximaVaga(NF.recusada.chave);
  decidirPedido(
    db,
    decisor,
    { id: recusado, decisao: "recusado", comentario: "A quantidade da nota passa do combinado na compra. Divida a carga em duas entregas e reenvie." },
    `${HOJE}T08:10:00-03:00`,
  );

  db.$client.close();

  fs.writeFileSync(arquivoAncoraDe(DESTINO), JSON.stringify({ demoAgora, realMs: Date.now() }));

  // Notas para a apresentação, com o papel de cada uma no nome do arquivo.
  fs.mkdirSync(SAIDA, { recursive: true });
  const ordem = Object.entries(NF);
  ordem.forEach(([chave, nf], i) => {
    const alvo = path.join(SAIDA, `${i + 1}_${chave}_${nf.chave}`);
    fs.copyFileSync(path.join(PASTA_NF, "xml", `${nf.chave}.xml`), `${alvo}.xml`);
    const pdf = path.join(PASTA_NF, "danfe_pdf", `${nf.chave}.pdf`);
    if (fs.existsSync(pdf)) fs.copyFileSync(pdf, `${alvo}.pdf`);
  });

  console.log(`\n${DESTINO} pronto. Relógio da demo: ${demoAgora} (correndo desde agora).`);
  console.log(`Pedidos de hoje: #${bate} (13:00, nota que BATE), #${errado} (13:00, o caminhão traz outra nota). Próximos dias: #${aguardando} aguardando Compras, #${recusado} recusado por Compras.`);
  console.log(`Fornecedor: nutrimix@nutrimix.com.br / ${SENHA} (aba Fornecedor). Compras, Portaria e Armazém: ${SENHA}.`);
  console.log(`\nNotas copiadas em web/${SAIDA}/ :`);
  ordem.forEach(([chave, nf], i) => console.log(`  ${i + 1}_${chave}_*  ${nf.papel}`));
}

try {
  main();
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
}
