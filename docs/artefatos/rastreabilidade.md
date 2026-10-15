# Matriz de rastreabilidade

Liga cada requisito do PRD às telas, rotas, código e testes do que foi construído, e aos casos de uso e passos do BPMN. Caminhos relativos a `web/`. Testes: Vitest (621 passando).

## Tarefa 1: agendamento (eliminatória, 15%)

| Requisito | Caso de uso | BPMN | Tela | Rota | Código | Testes |
|---|---|---|---|---|---|---|
| RF1-17 compra e link | UC10 | 1 | `/agendamento` (Nova compra) | `api/agendamento/compras` | `lib/agendamento/compra.ts` | `agendar.test.ts`, `pedido.test.ts` |
| RF1-01, 18 NF-e em XML | UC12 | 2 | `/agendamento/agendar/[token]`, portal do fornecedor | `api/agendamento/agendar`, `nf-ler`, `fornecedor/nf-ler` | `nf-xml.ts`, `agendar.ts` | `nf-xml.test.ts`, `agendar.test.ts` |
| RF1-01b PDF com chave | UC12 | 2 | mesma | `api/agendamento/agendar` | `agendar.ts` (`nfDoPdf`) | `portaria.test.ts` (PDF) |
| RF1-02 acondicionamento | UC11 | 2 | mesma | idem | `agendar.ts` | `agendar.test.ts` |
| RF1-03, 04 data e horário | UC13 | 3, 4 | calendário de dias, agenda | `api/agendamento/agendar`, `fornecedor/disponibilidade` | `ocupacao.ts`, `datas.ts` | `ocupacao.test.ts` (O1 a O14), `datas.test.ts` |
| RF1-05 validar NF × pedido | UC15 | 6 | `/agendamento` (validação), `/aprovacoes` | `api/agendamento/aprovacoes` | `validacao.ts`, `pedido.ts` | `validacao.test.ts`, `pedido.test.ts` |
| RF1-06, 07 autorizar e armazéns | UC16 | 13 | `/agendamento`, `/dia` | `api/agendamento/descarga` | `descarga.ts` | `descarga.test.ts` |
| RF1-08 a 10, 22 chegada, entrada e saída | UC41, UC49 | 12, 15 | `/dia`, `/agendamento/descarga/[id]` | `api/agendamento/descarga` | `descarga.ts`, `rapidas.ts` | `descarga.test.ts`, `rapidas.test.ts` |
| RF1-11, 12 funcionários e equipamentos | UC42 | 15 | `/agendamento/descarga/[id]` | idem | `descarga.ts` | `descarga.test.ts` |
| RF1-14, 19, 15 cancelar e vaga | UC17, UC18 | 7a, 7b | `/agendamento/vagas` | `api/agendamento/cancelar`, `vagas` | `estado.ts`, `desvios.ts` | `agendar.test.ts` (E5) |
| RF1-13 caso fortuito | UC19 | 8 | `/agendamento` | `api/agendamento/agendar` | `ocupacao.ts` | `ocupacao.test.ts` (O6, O14) |
| RF1-16, 23 não recebimento e pendência | UC43, UC44 | 14 | `/agendamento/nao-recebimentos`, `/agendamento/pendencias` | `api/agendamento/pendencias` | `desvios.ts` | `desvios.test.ts` (E4) |
| RF1-20 atraso | UC20, UC21 | 8 | `/agendamento`, `/dia` | `api/agendamento/atraso` | `portaria.ts` | `portaria.test.ts` (O10, O11) |
| RF1-21 sem agendamento | UC33, UC34 | 10, 11 | `/agendamento/portaria` | `api/agendamento/portaria` | `portaria.ts` (`caminhaoSemAgendamento`), `xml-por-chave.ts` | `portaria.test.ts` |
| Portaria: câmera e conferência | UC30, UC31, UC36 | 9 | `/agendamento/portaria` | `api/agendamento/portaria/conferir` | `components/agendamento/LeitorCamera.tsx`, `leitorChave.ts`, `conferirNota` | `conferencia.test.ts` |
| Histórico da placa | UC35 | 9 | portaria | `api/agendamento/placa` | `historico.ts` | `historico.test.ts` |
| RF1-24a registro no celular | UC41 | 15 | `/agendamento/descarga/[id]` | `api/agendamento/descarga` | `descarga.ts` | `descarga.test.ts` |
| RF1-24b tela do dia | UC40 | 15 | `/dia` (Hoje) | `api/dia` | `lib/dia/` (`tela.ts`, `servico.ts`) | `lib/boletim/dia.test.ts`, `resumo.test.ts` |
| RF1-25 cadastros | UC70 | — | `/cadastros`, `/cadastros/equipamentos` | `api/cadastros/[tipo]` | `lib/cadastros/servico.ts` | `seed.test.ts` |
| RF1-26 peso da balança | UC32 | 12 | portaria | `api/agendamento/descarga` | `descarga.ts` | `descarga.test.ts` |
| Dimensionar funcionários e equipamentos | UC14 | 5 | agendar | — | `dimensionar.ts`, `lib/painel/norma.ts` | `dimensionar.test.ts`, `norma.test.ts` (N1 a N7) |
| Estado do agendamento | — | — | — | — | `estado.ts` | `estado.test.ts` |

## Acesso e aprovações (D49, D53; entrou por pedido do humano)

| Funcionalidade | Caso de uso | Tela | Rota | Código | Testes |
|---|---|---|---|---|---|
| Login por perfil e sessão assinada | UC01 | `/login` | `api/auth/entrar`, `sair` | `lib/auth.ts`, `sessao.ts`, `proxy.ts` | `sessao.test.ts`, `http.test.ts` |
| Recuperar e trocar senha | UC06 | `/senha` | `api/auth/recuperar`, `senha` | `lib/senha.ts` | `sessao.test.ts` |
| Convite e cadastro do fornecedor | UC02, UC08 | `/cadastro/[token]` | `api/aprovacoes/convite`, `api/cadastro/[token]` | `lib/aprovacoes/cadastro.ts` | `pedido.test.ts` |
| Aprovar ou recusar cadastro e pedido | UC03, UC04 | `/aprovacoes` | `api/aprovacoes/cadastro`, `api/agendamento/aprovacoes` | `lib/aprovacoes/cadastro.ts`, `lib/agendamento/pedido.ts` | `pedido.test.ts` |
| Gestão de usuários | UC05 | `/usuarios` | `api/usuarios` | `lib/usuarios/servico.ts` | validada na tela |
| Portal do fornecedor e notificações | UC07, UC23 | `/fornecedor`, `/fornecedor/pedidos`, `/fornecedor/dados` | `api/fornecedor/*` | `lib/tempo.ts` | `tempo.test.ts` |
| Auditoria da trajetória | UC48 | `/auditoria`, `/auditoria/[id]` | — | `lib/auditoria/trajeto.ts` | validada na tela |

## Tarefa 2: boletim (25%)

| Requisito | Caso de uso | BPMN | Tela | Rota | Código | Testes |
|---|---|---|---|---|---|---|
| RF2-01, 02 produção por linha | UC50 | 16 | `/boletim/novo`, `/boletim/[id]` | `api/boletim` | `lib/boletim/calculo.ts` | `calculo.test.ts` (T1 a T11) |
| RF2-03 equipe por matrícula | UC51 | 16 | idem | `api/boletim` | `lib/boletim/servico.ts` | `servico.test.ts` (B1 a B5) |
| RF2-04, 05, 07 cálculo exato | UC52 | 17 | idem | `api/boletim` | `calculo.ts`, `lib/money.ts` | `calculo.test.ts`, `money.test.ts` |
| RF2-06 um por armazém por dia | UC50 | 16 | idem | `api/boletim` | `servico.ts` | `servico.test.ts` (T8, B3, B4) |
| RF2-09 sem funcionários bloqueado | UC50 | 16 | idem | `api/boletim` | `calculo.ts` | `calculo.test.ts` (T6, T7) |
| RF2-08 qualquer dia | UC50 | 16 | calendário mensal `/boletim` | — | `servico.ts` | `servico.test.ts` |
| RF2-10 correção | UC53 | 16 | `/boletim/[id]` | `api/boletim/[id]` | `servico.ts` | `servico.test.ts` (B5) |
| RF2-11 linhas de diária | UC50 | 16 | idem | idem | `calculo.ts` | `calculo.test.ts` (T11) |
| Calendário, boletim do dia e faixa de aviso | UC54 | — | `/boletim`, `/boletim/dia` | — | `components/boletim/FaixaFaltaBoletim.tsx` | `dia.test.ts` |

## Tarefa 3: painel (30%)

| Requisito | Caso de uso | BPMN | Tela | Rota | Código | Testes |
|---|---|---|---|---|---|---|
| RF3-00 sobra ou falta | UC60 | 17, 18 | `/painel` | `api/painel/resumo`, `operacao` | `lib/painel/sobra-falta.ts` | `sobra-falta.test.ts` (P1, P2, P5), `controle-chapas.test.ts` |
| Importação do histórico | — | — | log por arquivo | script de importação | `lib/painel/importar/` | testes de importação (P4) |
| RF3-01 cargas por dia e armazém | UC62 | — | `/painel` | `api/painel/cargas` | `lib/painel/indicadores.ts` | `indicadores.test.ts` |
| RF3-09 custo da mão de obra | UC62 | — | `/painel` | `api/painel/custo` | `lib/painel/` | `indicadores.test.ts` |
| RF3-06, 07 fornecedores e dias de pico | UC62 | — | `/painel` | `api/painel/movimento` | `agrupar-fornecedores.ts` | `agrupar-fornecedores.test.ts` |
| RF3-02 a 05, 08 tempos e utilização | UC62 | — | `/painel` | `api/painel/operacao` | `lib/painel/operacao.ts` | `operacao.test.ts` |
| Régua da norma | UC61 | — | `/painel` | `api/painel/faixa-norma` | `norma.ts`, `faixa-norma.ts` | `faixa-norma.test.ts`, `norma.test.ts` |
| Previsão de funcionários da semana | UC61 | — | `/painel` (primeira dobra) | `api/painel/dia-seguinte` | `semana-chapas.ts`, `previsao-chapas.ts` | `semana-chapas.test.ts`, `previsao-chapas.test.ts` |
| Efetivo de amanhã e aviso ao prestador | UC63 | — | `/painel` | `api/painel/dia-seguinte` | `dia-seguinte.ts` | `dia-seguinte.test.ts` |
| Perguntar ao painel | UC64 | — | `/painel` | `api/painel/consulta` | `consulta-fixa.ts`, `linguagem-natural.ts` | `consulta-fixa.test.ts`, `linguagem-natural.test.ts` |
| Período de análise | UC65 | — | `/painel` (filtro fino acima dos gráficos) | `api/painel/*` | `components/painel/FiltroPeriodo.tsx` | — |
| Relatório gerencial | UC66 | — | `docs/relatorio.md` | — | — | números iguais aos do painel |

## Artefatos obrigatórios e de apoio

| Artefato | Arquivo | Imagem |
|---|---|---|
| DER (modelo de dados, 5 diagramas) | `docs/DER.md`, `docs/artefatos/der.md` | `img/der-1.png` a `der-5.png` |
| Casos de uso UML | `docs/artefatos/casos-de-uso.md`, `.puml` | `img/cu-1-acesso.png` a `cu-6-painel.png` |
| BPMN do processo proposto | `docs/artefatos/processo-bpmn.md`, `processo.bpmn` | `img/processo-bpmn.png`, `.svg` |
| Estados do agendamento | `docs/artefatos/estados.md`, `.puml` | `img/estados-agendamento.png` |
| Business Model Canvas | `docs/artefatos/bmc.md` | tabela (9 blocos) |
| Relatório gerencial | `docs/relatorio.md` | `img/*.svg` |
| Pitch | `docs/pitch.md` | — |
| Matriz de rastreabilidade | este arquivo | — |

## Segurança e demo (transversal)

| Tema | Onde |
|---|---|
| Valores decimais exatos | `lib/money.ts` (decimal.js; 2 casas só na exibição) |
| Origem de cada linha (`historico`, `teste`, `operacao`) | `lib/origem.ts` |
| Relógio da demo | `lib/relogio.ts` |
| Upload com limite de tamanho; XML sem entidades externas | `lib/agendamento/agendar.ts`, `nf-xml.ts` |
| Busca de nota pela chave só com 44 dígitos (sem montar caminho com texto livre) | `lib/agendamento/xml-por-chave.ts` |
| Permissão por perfil no servidor | `proxy.ts`, `lib/auth.ts` |
| Funciona sem rede | SQLite local; previsão do tempo com cache e alternativa offline |
