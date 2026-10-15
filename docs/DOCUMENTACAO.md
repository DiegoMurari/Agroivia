# Documentação do sistema: Recebimento Inteligente (Agrovia)

Documentação técnica e de uso do que foi construído no Hackathon UniFACEF (03 e 04/10/2026). Os artefatos de modelagem estão em [`artefatos/`](artefatos/README.md); o requisito de cada tela está no [PRD](PRD.md) e o motivo de cada escolha, em [DECISOES](DECISOES.md).

## 1. Visão geral

A Agrovia recebe caminhões sem aviso (só cerca de 20% dos fornecedores avisam), não registra nada da descarga e não sabe se a equipe de funcionários sobra ou falta. O sistema resolve em três módulos que gravam num único banco local:

| Módulo | O que entrega |
|---|---|
| **Agendamento** (Tarefa 1) | Compras gera o link ou o fornecedor usa o portal; a NF-e entra por XML ou PDF; a regra de ocupação recusa horário cheio e mostra a próxima data; a portaria confere a nota pela câmera; o armazém registra entrada, saída, funcionários e equipamentos por armazém |
| **Boletim diário** (Tarefa 2) | Produção por linha, equipe por matrícula, piso (R$ 90,1731 por diária) e complemento exatos, calendário mensal e aviso de boletim faltando |
| **Painel gerencial** (Tarefa 3) | Responde "sobra ou falta de funcionários" em funcionários e em reais, por armazém e período; previsão de funcionários da semana; consulta fixa ou em linguagem natural |

## 2. Perfis e acesso

Login por e-mail e senha, cookie de sessão assinado. Permissão aplicada no servidor (`proxy.ts` barra pelo cookie e `lib/auth.ts` confere no banco).

| Perfil | Conta de demonstração | Entra em | Pode acessar |
|---|---|---|---|
| Adm Master | `adm@agrovia.com.br` | `/dia` | tudo, mais `/usuarios` |
| Compras | `compras@agrovia.com.br` | `/dia` | agendamento, aprovações, boletim, painel, cadastros, auditoria, Hoje, descarga e portaria |
| Gestor de armazém | `armazem@agrovia.com.br` | `/dia` | Hoje (`/dia`), registro de descarga e conferência de nota |
| Portaria | `portaria@agrovia.com.br` | `/agendamento/portaria` | só "Conferir nota fiscal" |
| Fornecedor | criado por convite | `/fornecedor` | só o portal do fornecedor |

Senha das contas de demonstração: `agrovia2026` (só no seed; em uso real, defina `ADM_MASTER_SENHA` e troque no primeiro acesso).

Rotas públicas: `/login`, `/senha`, `/cadastro/[token]` (cadastro por convite) e `/agendamento/agendar/[token]` (link de uso único da compra, o token é a credencial).

> Os papéis "responsável pelo armazém" e "direção" dos casos de uso são exercidos pelos perfis **Compras** e **Adm Master** (D49). O perfil Armazém foi reduzido à operação do dia e à conferência da nota (D53).

## 3. Guia de uso por perfil

### Fornecedor
1. Recebe o convite de Compras, abre o link e preenche o cadastro (razão social, CNPJ, contato, tipos de mercadoria). O cadastro fica **pendente** até Compras aprovar.
2. Depois de aprovado, entra em `/fornecedor`: calendário com previsão do tempo, pedidos e histórico.
3. Cria um pedido: anexa o XML da NF-e (o sistema lê chave, itens, pesos, volumes e espécie) ou o PDF com a chave de 44 dígitos, escolhe acondicionamento, dia e horário (08h, 10h, 13h ou 15h). Horário cheio é recusado e a próxima data aparece.
4. O pedido nasce **aguardando** e já reserva a vaga. Compras aprova ou recusa (com comentário); o fornecedor recebe notificação.
5. Pode avisar atraso ou cancelar.

Alternativa sem login: Compras envia o link de uso único da compra; o fornecedor agenda por ele.

### Compras
1. `/agendamento`: agenda por dia, **Nova compra** (gera o link), validação NF × pedido (conforme, divergente ou aguardando pedido, com alertas de CNPJ, quantidade e peso), cancelamentos, vagas liberadas, pendências e não recebimentos.
2. `/aprovacoes`: cadastros de fornecedores e pedidos aguardando. Clicar no card abre a análise com a NF-e; recusar exige comentário. Também envia convites.
3. `/boletim`, `/painel`, `/cadastros`, `/auditoria`.

### Portaria
1. `/agendamento/portaria`: abre a câmera e aponta para o código de barras do DANFE. Se a câmera falhar, digita os 44 dígitos ou anexa o XML.
2. O sistema busca a nota completa pela chave e confere com o agendamento: **confere**, **confere com aviso**, **divergente**, **escolher** (mais de um agendamento do fornecedor) ou **sem agendamento**.
3. Com agendamento, registra a chegada e o peso da balança (acima de 500 kg).
4. Sem agendamento: com vaga hoje, agenda na hora e o pedido já nasce **preenchido pela nota** (fornecedor, NF, itens, peso, placa, acondicionamento); sem vaga, registra o não recebimento e mostra a próxima data.

### Gestor de armazém (e Compras)
1. `/dia` (Hoje): cards de entrega em três momentos (a chegar, no pátio, descarregando), com etapas, cronômetro e previsão de término; "Caminhão chegou", "Iniciar descarga", "Encerrar descarga". A tela se atualiza sozinha.
2. Registro da descarga (também no celular): entrada e saída por armazém, número de funcionários e equipamentos; o caminhão é liberado na última saída. É possível desfazer o último registro.
3. Divergência pequena entra como pendência; grave vira não recebimento com 1 dos 4 motivos.

### Boletim (Compras e Adm Master)
1. `/boletim`: calendário mensal; clicar no dia abre o boletim do dia (os armazéns juntos). Faixa avisa os boletins que faltam.
2. `/boletim/novo`: escolhe armazém e dia, lança descarga, remoção e transferência por tipo de item, escala 1 a 20 funcionários (completa ou meia diária) e vê produção, valor por diária, total a pagar e complemento. Um boletim por armazém por dia; correção reabre e recalcula.

### Painel (Compras e Adm Master)
1. Primeira dobra: **previsão de funcionários da semana** (mínimo pela norma e máximo pelo que se paga, por dia) e a resposta "sobra ou falta" em frase, funcionários e reais.
2. Período de análise em barra fina acima dos gráficos: ao trocar, os gráficos são regerados na hora. Cada número mostra a origem (`historico`, `teste` ou `operacao`).
3. "Amanhã": efetivo do dia seguinte e botão para copiar o aviso ao prestador. "Pergunte ao painel": consultas fixas (a linguagem natural só escolhe qual).

### Adm Master
`/usuarios`: cria contas de Compras, ativa e desativa (toggle), reseta senha. Também aprova cadastros e vê a auditoria.

## 4. Regras de negócio

**Ocupação de horário (D23, D43):** grade 08h, 10h, 13h, 15h. Carga batida reserva o horário; sem batida, até 2 caminhões paletizados ou big bag; vale para a cooperativa toda; cancelado e remarcado não contam. Capacidade do dia = 8 − nº de batidos (mínimo 4). Sem recebimento em sábados, domingos e feriados. Verificação e gravação na mesma transação.

**Atraso (D27):** tolerância de 30 min; depois, o responsável remarca para o próximo horário livre e o sistema grava o aviso. Nunca é automático.

**Norma de funcionários (D25, D26):** até 500 kg, nenhum; batido acima de 500 kg, 5; paletizado ou big bag, empilhadeira e 1 funcionário (perfil Agrovia; o do Dossiê, 2, é sensibilidade); máquina, 1 funcionário; carga mista vale a maior.

**Boletim (D10):**
```
quantidade da linha  = descarga + remoção + transferência
produção total       = soma (quantidade × preço do tipo)
diárias equivalentes = nº de chapas − 0,5 por meia diária
valor por diária     = produção total ÷ diárias equivalentes
se valor por diária < 90,1731: total = 90,1731 × diárias; complemento = total − produção
senão: total = produção; complemento = 0
```
Sem arredondar no cálculo; 2 casas só na exibição.

**Sobra ou falta (D29):** diárias justificadas = produção ÷ piso; excesso em reais = complemento; falta em reais = produção acima do piso. Nos boletins novos é exata e por armazém; no histórico é estimativa declarada (excesso é teto, falta é piso).

**Aprovações (D49):** cadastro de fornecedor e pedido do portal passam por Compras; toda decisão grava `log_aprovacao` e notifica.

## 5. Arquitetura

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js (App Router) full-stack em TypeScript; rotas JSON em `app/api/<módulo>/` |
| Banco | SQLite (better-sqlite3, WAL) com Drizzle; migrações em `lib/db/migrations` |
| Validação | zod nas rotas; enumerações em `lib/db/enums.ts` |
| Números | decimal.js; dinheiro, peso e quantidade como texto decimal no banco (`lib/money.ts`) |
| Leitura da NF-e | fast-xml-parser, sem entidades externas; limite de 2 MB por arquivo |
| Câmera | `getUserMedia` com BarcodeDetector nativo ou `@zxing/browser`; leitura por quadros com recorte e ampliação |
| Testes | Vitest (621 testes) com banco temporário; Playwright para a fumaça |
| Visual | Tailwind v4 com tokens da Agrovia (`brand`, `primary`, `success`, `warning`, `destructive`, `excess`, `lack`); `components/ui` e `components/layout`; fontes locais, sem CDN |

```
web/
  app/                páginas e rotas (agendamento, aprovacoes, auditoria, boletim, cadastro(s),
                      dia, fornecedor, login, painel, senha, usuarios) e app/api/*
  components/         ui, layout e um diretório por módulo
  lib/                agendamento, boletim, painel, dia, cadastros, aprovacoes, auditoria, usuarios,
                      db (schema, migrações, seed), auth, sessao, money, relogio, origem, tempo
  proxy.ts            permissão por perfil e caminho
  scripts/            db-rebuild, db-clone, artefatos
docs/                 PRD, DECISOES, DER, relatório, pitch, artefatos/
```

**Fluxo da conferência da nota:** câmera → chave de 44 dígitos → `POST /api/agendamento/portaria/conferir` → `xmlPorChave` lê o XML no `PACOTE_DIR` (ponto de troca para a SEFAZ) → `conferirNota` compara com os agendamentos → veredito. Sem agendamento, `POST /api/agendamento/portaria` (JSON ou multipart) cria o pedido com a NF.

**Rotas de API por módulo:** `api/agendamento/{agendar, aprovacoes, arquivos, atraso, cancelar, compras, descarga, fornecedores, nf-ler, pendencias, placa, portaria, produtos, vagas}`; `api/fornecedor/{dados, disponibilidade, nf-ler, notificacoes, pedidos}`; `api/aprovacoes/{cadastro, convite}`; `api/auth/{entrar, recuperar, sair, senha}`; `api/boletim`; `api/cadastros/[tipo]`; `api/dia`; `api/painel/{cargas, consulta, custo, dia-seguinte, faixa-norma, movimento, operacao, resumo}`; `api/usuarios`.

## 6. Dados, origem e segurança

- **Origem em toda linha:** `historico`, `teste` ou `operacao` (`lib/origem.ts`); o painel nunca soma origens sem rótulo.
- **Dados da Agrovia** ficam fora do repositório (`PACOTE_DIR`); as NF de teste em `web/lib/agendamento/__fixtures__/` são sintéticas.
- **Histórico:** importação com marca de qualidade por linha e log por arquivo; agosto e dezembro de 2025 sem folha aparecem como lacuna e ficam fora das médias.
- **Segredos** só no `.env` (`AUTH_SECRET`, `ANTHROPIC_API_KEY` opcional); senha com scrypt; cookie assinado.
- **Entradas:** upload com limite de tamanho, XML sem entidades externas, busca da nota só com 44 dígitos (nunca monta caminho com texto livre), validação zod, permissão por caminho no servidor.
- **IA:** fora do caminho principal; só escolhe entre consultas fixas, com timeout de 5 s, sem enviar dado pessoal e com alternativa sem rede.
- **Relógio da demo:** `DEMO_AGORA` (padrão `2026-08-31T07:45:00-03:00`) não volta ao reiniciar o servidor (`lib/relogio.ts`).
- **Uso retroativo (D54):** a demo reconstitui, de 01/06/2026 ao dia D, os recebimentos reais do histórico (fornecedor, pedido, NF, itens e armazéns reais; horários, placa e funcionários simulados e avisados) e os boletins dos dias com folha. `DEMO_MODO=sintetico` volta aos dados inventados.

## 7. Instalação e execução

Requisitos: Node 22 e npm 10.

```bash
cd web
npm install
cp .env.example .env     # PACOTE_DIR, AUTH_SECRET, DEMO_AGORA, ADM_MASTER_*
npm run db:rebuild       # data/base.db: migração, cadastros, demonstração e histórico
npm run db:clone:demo    # data/demo.db (volta a demo ao início)
npm run build
npm run start            # http://localhost:8000
```

Testes e verificações: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run e2e` (com o servidor no ar; `E2E_FASE=2` depois de reiniciar prova que o dado gravado volta).
Desenvolvimento por janela: `npm run dev:s1` (porta 8001), `dev:s2` (8002), `dev:s3` (8003), cada um com banco e pasta de build próprios.

## 8. Limitações conhecidas e próximos passos

| Tema | Situação |
|---|---|
| Câmera | Testada com imagens sintéticas; falta validar com uma nota impressa em câmera real e boa luz (há foto e digitação como alternativa) |
| Consulta da nota pela chave | Hoje lê o pacote de XML; em produção troca por SEFAZ (distribuição de DF-e) ou SAP em `xml-por-chave.ts` |
| Fornecedor fora do cadastro | A portaria mostra o emitente da nota, mas ainda não oferece botão para cadastrá-lo a partir do XML |
| E-mail | Convite e recuperação de senha mostram o link na tela; não há envio real |
| Histórico | Só há um boletim real (17/11/2025); excesso é teto e falta é piso até a Agrovia fornecer remoção, transferência e carregamento |
| Integração SAP | Não implementada |
| Cortados | App Expo, push, leitura de placa, OCR, remarcação automática (ver "O que NÃO vamos fazer" no PRD) |
