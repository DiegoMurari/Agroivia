import { hashSenha } from "../../senha";
import type { UsuarioPerfil } from "../enums";
import type { Db } from "../index";
import * as s from "../schema";

/** Senha das contas de demonstração (trocar em uso real). */
export const SENHA_DEMO = "agrovia2026";

// Sal fixo e cache: o seed é determinístico e os testes não refazem o scrypt a cada banco.
const hashes = new Map<string, string>();
function hashDoSeed(senha: string): string {
  let h = hashes.get(senha);
  if (!h) hashes.set(senha, (h = hashSenha(senha, Buffer.from("recebimento-seed!"))));
  return h;
}

/**
 * Seed fixo: o que não vem do pacote de dados. Roda no db:rebuild e em createTestDb({ seed: true }).
 * Espera o banco recém-migrado (não é para rodar duas vezes no mesmo arquivo).
 */

export const ARMAZENS = ["Insumos", "Adubo", "Pátio de Máquinas", "Loja"] as const;

const TIPOS_ITEM: [nome: string, preco: string, categoria: "item" | "diaria"][] = [
  ["Sacaria malas c/25", "0.1824", "item"],
  ["Sacaria malas c/40", "0.2635", "item"],
  ["Sacaria malas c/50", "0.3224", "item"],
  ["Sacaria fardo c/250", "1.1780", "item"],
  ["Sacaria fardo c/500", "2.3561", "item"],
  ["Peças", "0.3387", "item"],
  ["Máquinas / equipamentos", "0.3224", "item"],
  ["Agroquímico", "0.3224", "item"],
  ["Fertilizantes", "0.3224", "item"],
  ["Sementes", "0.3224", "item"],
  ["Medicamentos", "0.3387", "item"],
  ["Alimentação animal", "0.3387", "item"],
  ["Acessórios agropecuários", "0.3224", "item"],
  ["Serviços diversos", "0.3224", "item"],
  ["Diária completa", "90.1731", "diaria"],
  ["Meia diária", "45.0786", "diaria"],
];

/** D16, D29: grupo do produto → armazém, linha do boletim e conversão da produção. */
const GRUPOS: [grupo: string, descricao: string, armazem: string, tipoItem: string, conversao: string][] = [
  ["FER", "Fertilizantes", "Adubo", "Fertilizantes", "saca_50kg"],
  ["AGR", "Agroquímicos e defensivos", "Insumos", "Agroquímico", "unidade"],
  ["SEM", "Sementes", "Insumos", "Sementes", "unidade"],
  ["MAQ", "Máquinas e equipamentos", "Pátio de Máquinas", "Máquinas / equipamentos", "unidade"],
  ["PEC", "Peças", "Loja", "Peças", "unidade"],
  ["MED", "Medicamentos", "Loja", "Medicamentos", "unidade"],
  ["ALI", "Alimentação animal", "Loja", "Alimentação animal", "unidade"],
  ["ACE", "Acessórios agropecuários", "Loja", "Acessórios agropecuários", "unidade"],
];

const DEPOSITOS: [deposito: string, armazem: string | null, recebeDireto: boolean][] = [
  ["MATFerti", "Adubo", true],
  ["MATFert2", "Adubo", true],
  ["MATMaq", "Pátio de Máquinas", true],
  ["MATGeral", "Insumos", true],
  ["MATGer2", "Insumos", true],
  ["MATDefe", "Insumos", true],
  ["MATDef2", "Insumos", true],
  ["MATLoja", "Loja", true],
  ["MATProv", null, false],
  ["MATReser", null, false],
];

const FERIADOS: [data: string, nome: string][] = [
  ["2026-10-12", "Nossa Senhora Aparecida"],
  ["2026-11-02", "Finados"],
  ["2026-11-15", "Proclamação da República"],
  ["2026-11-20", "Consciência Negra"],
  ["2026-12-25", "Natal"],
  ["2027-01-01", "Confraternização Universal"],
];

const PARAMETROS: [chave: string, valor: string, descricao: string][] = [
  ["piso_diaria", "90.1731", "Piso em reais por diária equivalente (D10)"],
  ["fator_meia", "0.5", "Quanto a meia diária conta em diárias equivalentes (D10)"],
  ["max_chapas_boletim", "20", "Máximo de funcionários por boletim (D13)"],
  ["tolerancia_min", "30", "Tolerância de atraso em minutos: 30 não é atraso, 31 é (D27)"],
  ["limite_peso_chapa_kg", "500", "Acima deste peso a carga pede funcionário e balança (D25)"],
  ["capacidade_unitizado", "2", "Caminhões paletizados ou big bag por horário sem carga batida (D23)"],
  ["jornada_h", "8", "Jornada diária em horas"],
  ["safra_meses", "10,11,12,1,2,3", "Meses de safra (D19)"],
  ["perfil_norma", "agrovia", "Perfil da norma de funcionários em uso: agrovia ou dossie (D25)"],
  ["dias_minimos_mes", "10", "Mês com menos dias de folha é parcial e fica fora das médias (D20)"],
];

type Perfil = "agrovia" | "dossie";
type Acond = "batido" | "paletizado" | "big_bag" | "maquina";

/** D25: perfil, acondicionamento, chapas, empilhadeira, duração estimada em minutos. */
const NORMA: [perfil: Perfil, acond: Acond, chapas: number, empilhadeira: boolean, min: number][] = [
  ["agrovia", "batido", 5, false, 45],
  ["agrovia", "paletizado", 1, true, 15],
  ["agrovia", "big_bag", 1, true, 30],
  ["agrovia", "maquina", 1, false, 20],
  ["dossie", "batido", 5, false, 45],
  ["dossie", "paletizado", 2, true, 15],
  ["dossie", "big_bag", 2, true, 30],
  ["dossie", "maquina", 1, false, 20],
];

/** Tabela do dossiê. A quantidade da Loja não consta: premissa de 1. */
const EQUIPAMENTOS: [armazem: string, nome: string, finalidade: string, quantidade: number][] = [
  ["Insumos", "Empilhadeira a gás", "Descarga de paletes e big bag", 1],
  ["Insumos", "Empilhadeira elétrica retrátil", "Armazenagem em altura", 1],
  ["Insumos", "Transpaleteira elétrica", "Descarga e movimentação dentro do armazém", 2],
  ["Insumos", "Paleteira elétrica", "Movimentação de paletes", 2],
  ["Insumos", "Paleteira manual", "Movimentação entre armazéns", 2],
  ["Insumos", "Carrinho de mão", "Movimentação de cargas pequenas", 2],
  ["Adubo", "Empilhadeira a gás", "Descarga de paletes e big bag", 2],
  ["Adubo", "Paleteira manual", "Movimentação entre armazéns", 1],
  ["Pátio de Máquinas", "Empilhadeira a gás", "Descarga de paletes e big bag", 1],
  ["Pátio de Máquinas", "Trator", "Movimentação de máquinas e implementos", 4],
  ["Loja", "Carrinho de mão", "Movimentação de cargas pequenas", 1],
];

export function seedFixo(db: Db): void {
  db.transaction((tx) => {
    tx.insert(s.armazem)
      .values(ARMAZENS.map((nome, i) => ({ nome, localFisico: nome, fazBoletim: nome !== "Loja", ordem: i + 1 })))
      .run();
    // Boletim único (D47): começa inativo; ativar em Cadastros troca os boletins por armazém por um só
    tx.insert(s.armazem)
      .values({ nome: "Todas as áreas", localFisico: null, fazBoletim: false, recebeDescarga: false, ativo: false, ordem: ARMAZENS.length + 1 })
      .run();
    const armazemId = new Map(tx.select().from(s.armazem).all().map((a) => [a.nome, a.id]));

    tx.insert(s.tipoItem)
      .values(TIPOS_ITEM.map(([nome, precoUnitario, categoria], i) => ({ nome, precoUnitario, categoria, ordem: i + 1 })))
      .run();
    const tipoItemId = new Map(tx.select().from(s.tipoItem).all().map((t) => [t.nome, t.id]));

    tx.insert(s.grupoProduto)
      .values(
        GRUPOS.map(([grupo, descricao, armazem, tipo, conversaoProducao]) => ({
          grupo,
          descricao,
          armazemId: armazemId.get(armazem)!,
          tipoItemId: tipoItemId.get(tipo)!,
          conversaoProducao,
        })),
      )
      .run();

    tx.insert(s.depositoArmazem)
      .values(
        DEPOSITOS.map(([deposito, armazem, recebeDireto]) => ({
          deposito,
          armazemId: armazem ? armazemId.get(armazem)! : null,
          recebeDireto,
        })),
      )
      .run();

    tx.insert(s.horarioGrade)
      .values(["08:00", "10:00", "13:00", "15:00"].map((hora, i) => ({ hora, ordem: i + 1 })))
      .run();
    tx.insert(s.feriado)
      .values(FERIADOS.map(([data, nome]) => ({ data, nome })))
      .run();
    tx.insert(s.parametro)
      .values(PARAMETROS.map(([chave, valor, descricao]) => ({ chave, valor, descricao })))
      .run();

    tx.insert(s.normaChapas)
      .values(
        NORMA.map(([perfil, acondicionamento, chapas, empilhadeira, duracaoMin]) => ({
          perfil,
          acondicionamento,
          pesoMinKgExclusivo: "500",
          chapas,
          empilhadeira,
          duracaoMin,
        })),
      )
      .run();

    tx.insert(s.equipamento)
      .values(
        EQUIPAMENTOS.map(([armazem, nome, finalidade, quantidade]) => ({
          armazemId: armazemId.get(armazem)!,
          nome,
          finalidade,
          quantidade,
          disponivel: quantidade,
        })),
      )
      .run();

    tx.insert(s.usuario)
      .values([
        { nome: "Compras", papel: "compras" },
        { nome: "Portaria", papel: "portaria" },
        { nome: "Direção", papel: "direcao" },
        ...ARMAZENS.map((nome) => ({ nome: `Responsável ${nome}`, papel: "responsavel", armazemId: armazemId.get(nome)! })),
        { nome: "Fornecedor de demonstração", papel: "fornecedor" },
      ])
      .run();

    // Contas com login (D49). Senhas de demonstração; o Adm Master vem do .env quando definido.
    const criadoEm = "2026-10-01T08:00:00-03:00";
    const PAPEL_DO_PERFIL = { adm_master: "compras", compras: "compras", fornecedor: "fornecedor", portaria: "portaria", armazem: "responsavel" } as const;
    const conta = (nome: string, email: string, perfil: UsuarioPerfil, senha: string) =>
      tx
        .insert(s.usuario)
        .values({ nome, papel: PAPEL_DO_PERFIL[perfil], email, perfil, senhaHash: hashDoSeed(senha), criadoEm })
        .returning({ id: s.usuario.id })
        .get().id;
    const adm = conta("Adm Master", (process.env.ADM_MASTER_EMAIL || "adm@agrovia.com.br").toLowerCase(), "adm_master", process.env.ADM_MASTER_SENHA || SENHA_DEMO);
    conta("Compras Agrovia", "compras@agrovia.com.br", "compras", SENHA_DEMO);
    conta("Portaria Agrovia", "portaria@agrovia.com.br", "portaria", SENHA_DEMO);
    conta("Gestor de Armazém", "armazem@agrovia.com.br", "armazem", SENHA_DEMO);
    const aprovado = conta("Fornecedor de Demonstração", "fornecedor@demo.com.br", "fornecedor", SENHA_DEMO);
    const pendente = conta("Transportes Aguardando", "pendente@demo.com.br", "fornecedor", SENHA_DEMO);
    tx.insert(s.fornecedorCadastro)
      .values([
        {
          usuarioId: aprovado,
          razaoSocial: "Fornecedor de Demonstração Ltda",
          nomeFantasia: "Fornecedor Demo",
          cnpj: "99999999000191",
          inscricaoEstadual: "ISENTO",
          email: "fornecedor@demo.com.br",
          telefone: "(16) 3000-0000",
          responsavel: "Responsável de Demonstração",
          endereco: "Rua de Exemplo, 100, Franca, SP",
          tiposMercadoria: JSON.stringify(["Fertilizantes", "Defensivos"]),
          status: "aprovado",
          decididoPor: adm,
          decididoEm: criadoEm,
          criadoEm,
        },
        {
          usuarioId: pendente,
          razaoSocial: "Transportes Aguardando Ltda",
          nomeFantasia: "Aguardando",
          cnpj: "99999999000272",
          inscricaoEstadual: "ISENTO",
          email: "pendente@demo.com.br",
          telefone: "(16) 3000-0001",
          responsavel: "Pessoa de Exemplo",
          endereco: "Avenida de Exemplo, 200, Franca, SP",
          tiposMercadoria: JSON.stringify(["Peças"]),
          status: "pendente",
          criadoEm,
        },
      ])
      .run();
    tx.insert(s.logAprovacao).values({ alvo: "cadastro", alvoId: 1, decisao: "aprovado", usuarioId: adm, criadoEm }).run();
  });
}
