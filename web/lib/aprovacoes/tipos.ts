import { z } from "zod";

/** Tipos de mercadoria que o fornecedor escolhe no cadastro. */
export const TIPOS_MERCADORIA = ["Fertilizantes", "Defensivos", "Sementes", "Máquinas e peças", "Ração e nutrição animal", "Medicamentos", "Embalagens", "Outros"] as const;

const texto = (max: number) => z.string().trim().max(max);

export const esquemaDados = z.object({
  razaoSocial: texto(150).min(1, "Informe a razão social."),
  nomeFantasia: texto(150).optional(),
  cnpj: texto(20).min(1, "Informe o CNPJ."),
  inscricaoEstadual: texto(30).optional(),
  email: texto(120).min(1, "Informe o e-mail."),
  telefone: texto(30).optional(),
  responsavel: texto(100).optional(),
  endereco: texto(250).optional(),
  tiposMercadoria: z.array(z.enum(TIPOS_MERCADORIA)).max(TIPOS_MERCADORIA.length),
});

export const esquemaCadastro = esquemaDados.extend({ senha: z.string().max(200) });

/** Alteração: os mesmos campos, todos opcionais. */
export const esquemaAlteracao = esquemaDados.partial();
