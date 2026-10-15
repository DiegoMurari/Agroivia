import { describe, expect, it } from "vitest";

import { acessoDoCaminho, criarTokenSessao, inicioDoPerfil, lerTokenSessao, perfilPode } from "./sessao";

const pode = (perfil: Parameters<typeof perfilPode>[0], caminho: string) => perfilPode(perfil, acessoDoCaminho(caminho));

describe("permissão por perfil e caminho (D49, D53)", () => {
  it("portaria só entra na conferência da nota fiscal", () => {
    expect(pode("portaria", "/agendamento/portaria")).toBe(true);
    expect(pode("portaria", "/api/agendamento/portaria/conferir")).toBe(true);
    expect(pode("portaria", "/api/agendamento/fornecedores")).toBe(true);
    for (const c of ["/", "/dia", "/api/dia", "/agendamento", "/agendamento/descarga/1", "/api/agendamento/descarga/1", "/painel", "/boletim", "/cadastros", "/aprovacoes", "/usuarios", "/fornecedor"]) {
      expect(pode("portaria", c), c).toBe(false);
    }
    expect(inicioDoPerfil("portaria")).toBe("/agendamento/portaria");
  });

  it("gestor de armazém confere a nota e opera o dia, sem ver Compras", () => {
    for (const c of ["/agendamento/portaria", "/api/agendamento/portaria", "/dia", "/api/dia", "/agendamento/descarga/1", "/api/agendamento/descarga/1"]) {
      expect(pode("armazem", c), c).toBe(true);
    }
    for (const c of ["/", "/agendamento", "/api/agendamento/compras", "/painel", "/boletim", "/cadastros", "/aprovacoes", "/api/usuarios", "/fornecedor"]) {
      expect(pode("armazem", c), c).toBe(false);
    }
    expect(inicioDoPerfil("armazem")).toBe("/dia");
  });

  it("Compras e Adm Master entram na conferência; fornecedor não", () => {
    expect(pode("compras", "/agendamento/portaria")).toBe(true);
    expect(pode("adm_master", "/api/agendamento/portaria")).toBe(true);
    expect(pode("fornecedor", "/agendamento/portaria")).toBe(false);
    expect(pode("fornecedor", "/api/dia")).toBe(false);
    expect(pode("compras", "/usuarios")).toBe(false);
  });

  it("o cookie aceita os perfis novos e recusa perfil desconhecido ou assinatura trocada", () => {
    const exp = 2_000;
    expect(lerTokenSessao(criarTokenSessao({ uid: 7, perfil: "portaria", exp }), 1_000)).toEqual({ uid: 7, perfil: "portaria", exp });
    expect(lerTokenSessao(criarTokenSessao({ uid: 7, perfil: "armazem", exp }), 3_000)).toBeNull();
    expect(lerTokenSessao(criarTokenSessao({ uid: 7, perfil: "dono" as never, exp }), 1_000)).toBeNull();
    const [corpo] = criarTokenSessao({ uid: 7, perfil: "portaria", exp }).split(".");
    const outro = criarTokenSessao({ uid: 7, perfil: "adm_master", exp }).split(".")[1];
    expect(lerTokenSessao(`${corpo}.${outro}`, 1_000)).toBeNull();
  });
});
