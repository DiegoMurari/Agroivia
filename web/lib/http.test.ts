import { describe, expect, it } from "vitest";
import { z } from "zod";

import { erro, ErroDeRegra, lerJson, ok, responderErro, validar } from "./http";

describe("lib/http", () => {
  it("sucesso e erro saem no mesmo formato", async () => {
    const sucesso = ok({ id: 7 }, 201);
    expect(sucesso.status).toBe(201);
    expect(await sucesso.json()).toEqual({ ok: true, data: { id: 7 } });

    const falha = erro(409, "Horário cheio.");
    expect(falha.status).toBe(409);
    expect(await falha.json()).toEqual({ ok: false, erro: { mensagem: "Horário cheio." } });
  });

  it("validar devolve a causa por campo", async () => {
    const esquema = z.object({ placa: z.string().min(7), itens: z.array(z.object({ peso: z.string() })) });
    const v = validar(esquema, { placa: "ABC", itens: [{ peso: 3 }] });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.resposta.status).toBe(400);
    const corpo = (await v.resposta.json()) as { erro: { campos: Record<string, string> } };
    expect(Object.keys(corpo.erro.campos).sort()).toEqual(["itens.0.peso", "placa"]);

    const certo = validar(esquema, { placa: "ABC1D23", itens: [] });
    expect(certo.ok && certo.data.placa).toBe("ABC1D23");
  });

  it("corpo malformado vira undefined e o validar recusa", async () => {
    const corpo = await lerJson(new Request("http://x", { method: "POST", body: "{não é json" }));
    expect(corpo).toBeUndefined();
    expect(validar(z.object({ a: z.string() }), corpo).ok).toBe(false);
  });

  it("ErroDeRegra vira resposta com status, campos e detalhe", async () => {
    const resposta = responderErro(new ErroDeRegra("Horário cheio.", { detalhe: { proximaData: "2026-10-06" } }));
    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toEqual({
      ok: false,
      erro: { mensagem: "Horário cheio.", detalhe: { proximaData: "2026-10-06" } },
    });
  });
});
