import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { agoraISO } from "@/lib/relogio";

import { carregarContexto } from "./comum";
import { proximosDias } from "./ocupacao";
import { criarPedido, decidirPedido, type DadosPedido } from "./pedido";

/**
 * Seed do módulo agendamento. Roda no banco da janela (`npm run seed:agendamento`) e na matriz (`db:rebuild`).
 * Tem de poder rodar duas vezes sem duplicar. Toda linha com `origem`.
 *
 * Pedidos do fornecedor de demonstração (D49): 3 aguardando aprovação, 1 recusado com comentário e a
 * notificação dele, para a demo já ter o que aprovar. As notas são as fixtures sintéticas do leitor de NF-e.
 */

const FIXTURES = path.join(process.cwd(), "lib", "agendamento", "__fixtures__");

function nota(arquivo: string, acondicionamento: "paletizado" | "big_bag" | "batido") {
  return { nome: arquivo, conteudo: fs.readFileSync(path.join(FIXTURES, arquivo)), acondicionamento };
}

export function seed(db: Db): void {
  const forn = db.select().from(schema.usuario).where(eq(schema.usuario.email, "fornecedor@demo.com.br")).get();
  const compras = db.select().from(schema.usuario).where(eq(schema.usuario.email, "compras@agrovia.com.br")).get();
  if (!forn || !compras) return;
  if (db.select({ id: schema.agendamento.id }).from(schema.agendamento).where(eq(schema.agendamento.criadoPorUsuarioId, forn.id)).get()) return;

  const agora = agoraISO();
  // horários livres dos próximos dias úteis, em ordem: um para cada pedido do seed
  const livres = proximosDias(carregarContexto(db, agora), "unitizado", 8)
    .flatMap((d) => d.horarios.filter((h) => h.livre && h.ocupados === 0).map((h) => ({ data: d.data, horario: h.horario })))
    .filter((v) => v.horario !== "08:00");

  const pedidos: { dados: Omit<DadosPedido, "data" | "horario" | "enviar">; recusar?: string }[] = [
    { dados: { tipoMercadoria: "FER", observacao: "Descarga com empilhadeira.", arquivos: [nota("nfe-palete-com-placa.xml", "paletizado")] } },
    { dados: { tipoMercadoria: "AGR", arquivos: [nota("nfe-dois-itens.xml", "paletizado")] } },
    { dados: { tipoMercadoria: "FER", arquivos: [nota("nfe-big-bag-sem-placa.xml", "big_bag")] } },
    {
      dados: { tipoMercadoria: "AGR", arquivos: [nota("nfe-sem-especie.xml", "paletizado")] },
      recusar: "O peso da nota não bate com o pedido de compra. Corrija o pedido e envie de novo.",
    },
  ];

  pedidos.forEach((p, i) => {
    const vaga = livres[i];
    if (!vaga) return;
    const { agendamentoId } = criarPedido(db, forn.id, { ...p.dados, ...vaga, enviar: true }, agora);
    if (p.recusar) decidirPedido(db, { id: compras.id, nome: compras.nome ?? "Compras" }, { id: agendamentoId, decisao: "recusado", comentario: p.recusar }, agora);
  });
}
