import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { criarEquipe, adicionarChapaNaEquipe } from "@/lib/equipes/servico";

/**
 * Sobre o banco do pacote de dados: troca os identificadores (CHAPA_08...) por nomes fictícios de
 * funcionários e monta a escala de equipes do Dia D e dos 4 dias úteis seguintes.
 */

const PRIMEIROS = ["Carlos", "João", "Marcos", "Rafael", "Lucas", "Anderson", "Felipe", "Gustavo", "Thiago", "Bruno", "Diego", "Renato", "Paulo", "Fábio", "Leandro", "Rodrigo", "Matheus", "Eduardo", "Vinícius", "André", "Sérgio", "Wellington", "Jonas", "Tiago", "Alex", "Cristiano", "Maurício", "Ricardo", "Everton", "Douglas", "Henrique", "Leonardo", "Gabriel", "Daniel", "Murilo", "Caio", "Otávio", "Samuel", "Victor", "Nelson", "Edson", "Reinaldo", "Valdir", "Jair", "Cleber", "Osvaldo", "Ismael", "Wagner", "Elias", "Raul", "Ademir"];
const SOBRENOMES = ["Silva", "Santos", "Lima", "Almeida", "Ferreira", "Souza", "Rocha", "Martins", "Oliveira", "Carvalho", "Ribeiro", "Barbosa", "Costa", "Nunes", "Pereira", "Teixeira", "Araújo", "Gomes", "Moreira", "Cardoso", "Batista", "Dias", "Freitas", "Mendes", "Pinto", "Lopes", "Campos", "Duarte", "Castro", "Ramos"];

const somaDias = (s: string, n: number) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaUtil = (s: string) => ![0, 6].includes(new Date(s + "T12:00:00Z").getUTCDay());

function main(): void {
  const db = getDb();
  const D = "2026-08-31";
  const agora = `${D}T07:45:00-03:00`;

  const todos = db.select().from(schema.chapa).all();
  todos.forEach((c, i) => {
    if (!/^CHAPA_\d+$/.test(c.nome)) return;
    const nome = `${PRIMEIROS[i % PRIMEIROS.length]} ${SOBRENOMES[(i * 7 + 3) % SOBRENOMES.length]} ${SOBRENOMES[(i * 11 + 5) % SOBRENOMES.length]}`;
    db.update(schema.chapa).set({ nome }).where(eq(schema.chapa.id, c.id)).run();
  });
  const funcionarios = db.select().from(schema.chapa).all().filter((c) => c.ativo);

  const armazens = db.select().from(schema.armazem).all().filter((a) => a.fazBoletim);
  const tarefas = ["Descarga de adubo", "Descarga de insumos", "Movimentação e organização", "Carga e conferência"];
  const dias: string[] = [];
  for (let d = D; dias.length < 5; d = somaDias(d, 1)) if (diaUtil(d)) dias.push(d);

  let equipes = 0;
  const falhas: string[] = [];
  dias.forEach((data, di) => {
    armazens.slice(0, 3).forEach((arm, ai) => {
      try {
        const eq_ = criarEquipe(db, { data, nome: `Equipe ${"ABC"[ai]}`, armazemId: arm.id, tarefa: tarefas[(di + ai) % tarefas.length], horarioInicio: "07:30", horarioFim: "17:00" }, agora);
        const base = (di * 5 + ai * 7) % funcionarios.length;
        for (let k = 0; k < 4; k++) adicionarChapaNaEquipe(db, eq_.id, funcionarios[(base + k) % funcionarios.length].nome, k === 3 && ai === 2 ? "meia" : "completa");
        equipes++;
      } catch (e) {
        falhas.push(`${data}/${arm.nome}: ${e instanceof Error ? e.message : e}`);
      }
    });
  });
  console.log(JSON.stringify({ funcionarios: funcionarios.length, equipes, falhas: falhas.slice(0, 3) }));
  db.$client.close();
}

main();
