import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { criarBoletim, fecharBoletim } from "@/lib/boletim/servico";
import { criarEquipe, adicionarChapaNaEquipe } from "@/lib/equipes/servico";

/**
 * Popula o banco de DB_PATH com funcionários, histórico, boletins e equipes fictícios,
 * para as telas da demonstração aparecerem preenchidas. Roda uma vez por banco.
 * Dia D = 2026-08-31 (DEMO_AGORA do .env).
 */

const NOMES = [
  "Carlos Eduardo Silva", "João Pedro Santos", "Marcos Vinícius Lima", "Rafael Almeida", "Lucas Ferreira",
  "Anderson Souza", "Felipe Rocha", "Gustavo Martins", "Thiago Oliveira", "Bruno Carvalho",
  "Diego Ribeiro", "Renato Barbosa", "Paulo Henrique Costa", "Fábio Nunes", "Leandro Pereira",
  "Rodrigo Teixeira", "Matheus Araújo", "Eduardo Gomes", "Vinícius Moreira", "André Cardoso",
  "Sérgio Batista", "Wellington Dias", "Jonas Freitas", "Tiago Mendes", "Alex Pinto",
  "Cristiano Lopes", "Maurício Campos", "Ricardo Duarte", "Everton Castro", "Douglas Ramos",
  "Henrique Azevedo", "Leonardo Monteiro",
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (s: string, n: number) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const diaUtil = (s: string) => {
  const w = new Date(s + "T12:00:00Z").getUTCDay();
  return w !== 0 && w !== 6;
};
// pseudo-aleatório determinístico (a demo tem de ser reproduzível)
let semente = 20260831;
const rnd = () => ((semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296);
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

function main(): void {
  const db = getDb();
  const D = "2026-08-31";
  const agora = `${D}T07:45:00-03:00`;

  if (db.select().from(schema.chapa).all().length > 0) {
    console.log("Banco já tem funcionários; nada a fazer.");
    return;
  }
  const armazens = db.select().from(schema.armazem).all();
  const tipos = db.select().from(schema.tipoItem).all().filter((t) => t.ativo);
  const operacionais = armazens.filter((a) => a.fazBoletim);

  // funcionários cadastrados
  NOMES.forEach((nome, i) => {
    db.insert(schema.chapa)
      .values({ matricula: String(101 + i), nome, armazemId: operacionais[i % operacionais.length]?.id ?? null, ativo: true })
      .run();
  });
  const funcionarios = db.select().from(schema.chapa).all();

  // histórico de presença (um ano de dias úteis), com safra mais forte de março a junho
  let hist = 0;
  const temHistorico = db.select().from(schema.histChapasDia).all().length > 0;
  for (let d = "2025-09-01"; d < D && !temHistorico; d = somaDias(d, 1)) {
    if (!diaUtil(d)) continue;
    const mes = Number(d.slice(5, 7));
    const safra = mes >= 3 && mes <= 6;
    const presentes = safra ? entre(11, 17) : entre(6, 12);
    db.insert(schema.histChapasDia)
      .values({ data: d, diaSemana: "", presentes, cafe: 1, valorPago: (presentes * 90.1731).toFixed(2), qualidade: "", considerada: true })
      .run();
    // cargas do dia
    const cargas = safra ? entre(5, 9) : entre(2, 6);
    for (let c = 0; c < cargas; c++) {
      const peso = entre(6, 28) * 1000;
      const r = db
        .insert(schema.histCarga)
        .values({
          codPn: "F" + String(10000 + entre(0, 400)),
          data: d,
          notasQtd: 1,
          itensQtd: entre(1, 6),
          pesoTotalKg: String(peso),
          especieXml: "SC",
          acondicionamentoXml: ["batido", "paletizado", "big_bag", "maquina"][entre(0, 3)],
        })
        .returning({ id: schema.histCarga.id })
        .get();
      const arm = operacionais[entre(0, operacionais.length - 1)];
      db.insert(schema.histCargaArmazem)
        .values({ histCargaId: r.id, armazemId: arm.id, itensQtd: entre(1, 6), pesoKg: String(peso), quantidadeBoletim: String(Math.round(peso / 25)), producaoEstimada: String(entre(2, 9)) })
        .run();
    }
    hist++;
  }

  // boletins fechados dos 12 dias úteis anteriores ao Dia D
  let boletins = 0;
  const falhas: string[] = [];
  const dias: string[] = [];
  for (let d = somaDias(D, -1); dias.length < 12; d = somaDias(d, -1)) if (diaUtil(d)) dias.push(d);
  dias.reverse().forEach((data, di) => {
    operacionais.slice(0, 3).forEach((arm, ai) => {
      const base = (di * 7 + ai * 5) % funcionarios.length;
      const tam = entre(4, 7);
      const equipe = Array.from({ length: tam }, (_, k) => ({
        matricula: funcionarios[(base + k) % funcionarios.length].matricula,
        tipo: (rnd() < 0.15 ? "meia" : "completa") as "meia" | "completa",
      }));
      const linhas = tipos
        .filter((t) => t.categoria === "item")
        .sort(() => rnd() - 0.5)
        .slice(0, entre(2, 4))
        .map((t) => ({ tipoItemId: t.id, descarga: String(entre(20, 180)), remocao: rnd() < 0.4 ? String(entre(5, 40)) : undefined }));
      try {
        const b = criarBoletim(db, { armazemId: arm.id, data, linhas, equipe, responsavel: "Gestor de armazém" }, `${data}T17:30:00-03:00`);
        fecharBoletim(db, b.id, `${data}T17:45:00-03:00`);
        boletins++;
      } catch (e) {
        falhas.push(`${data}/${arm.nome}: ${e instanceof Error ? e.message : e}`);
      }
    });
  });

  // escala de equipes: Dia D e os 4 dias úteis seguintes
  const tarefas = ["Descarga de adubo", "Descarga de insumos", "Movimentação e organização", "Carga e conferência"];
  let equipes = 0;
  const escala: string[] = [];
  for (let d = D; escala.length < 5; d = somaDias(d, 1)) if (diaUtil(d)) escala.push(d);
  escala.forEach((data, di) => {
    operacionais.slice(0, 3).forEach((arm, ai) => {
      try {
        const eq = criarEquipe(db, { data, nome: `Equipe ${"ABC"[ai]}`, armazemId: arm.id, tarefa: tarefas[(di + ai) % tarefas.length], horarioInicio: "07:30", horarioFim: "17:00" }, agora);
        const base = (di * 5 + ai * 7) % funcionarios.length;
        for (let k = 0; k < 4; k++) {
          adicionarChapaNaEquipe(db, eq.id, funcionarios[(base + k) % funcionarios.length].nome, k === 3 && ai === 2 ? "meia" : "completa");
        }
        equipes++;
      } catch (e) {
        falhas.push(`equipe ${data}/${arm.nome}: ${e instanceof Error ? e.message : e}`);
      }
    });
  });

  console.log(JSON.stringify({ funcionarios: funcionarios.length, diasDeHistorico: hist, boletins, equipes, falhas: falhas.slice(0, 5), totalFalhas: falhas.length }));
  db.$client.close();
}

main();
