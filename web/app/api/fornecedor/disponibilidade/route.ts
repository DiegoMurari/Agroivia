import { carregarContexto } from "@/lib/agendamento/comum";
import { calendarioDoMes, horariosDoDia } from "@/lib/agendamento/ocupacao";
import { exigirAcesso } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { erro, ok, responderErro } from "@/lib/http";
import { agoraISO } from "@/lib/relogio";

/** Só leitura. `?mes=YYYY-MM` devolve o calendário; `?data=YYYY-MM-DD` devolve os horários do dia. `acond` = batido ou unitizado. */
export async function GET(request: Request) {
  try {
    await exigirAcesso("fornecedor");
    const p = new URL(request.url).searchParams;
    const acond = p.get("acond") === "batido" ? "batido" : "unitizado";
    const ctx = carregarContexto(getDb(), agoraISO());
    const data = p.get("data");
    if (data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro(400, "Data inválida.");
      return ok(horariosDoDia(ctx, data, acond));
    }
    const mes = p.get("mes") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return erro(400, "Mês inválido. Use AAAA-MM.");
    return ok(calendarioDoMes(ctx, mes, acond));
  } catch (e) {
    return responderErro(e);
  }
}
