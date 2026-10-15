# PRD
Única fonte do que será implementado. Ideia nova entra em "O que NÃO vamos fazer" até o Diego aprovar.
Fontes: R = Regulamento, D = Dossiê, L = LEIA-ME, Agrovia 03/10 = `docs/contexto/respostas-agrovia.md`, P# = premissa da equipe. Decisões e o que as reabre: `docs/DECISOES.md` (D##). Modelo de dados: `docs/DER.md`. Como as janelas trabalham: `docs/plano-paralelo.md`.

## Problema e usuário
A Agrovia (Franca) recebe caminhões sem aviso: só cerca de 20% dos fornecedores avisam, e nada é registrado (chegada, início e fim de descarga, pessoas, equipamento). Todo dia aloca uma equipe de funcionários sem saber se está **sobrando ou faltando gente**, e o boletim de produção é preenchido à mão e nunca consolidado. O custo de pessoal é a principal preocupação da direção (D p. 1).
Usuários (os papéis do seletor, D05): fornecedor (agenda), Compras (valida NF × pedido, gera o link), responsável pelo armazém (destino, marcos, funcionários, equipamentos, boletim), portaria (avisa a chegada), direção (faz a pergunta central). Os funcionários não usam o sistema. Detalhes em `docs/00-problema.md`.

## Solução em 2 frases
Um módulo de **agendamento obrigatório** (Tarefa 1) com registro de cada descarga, um **boletim diário** com piso e complemento corretos (Tarefa 2) e um **painel** que responde "a equipe de funcionários sobra ou falta?" por armazém, período, número de funcionários e reais (Tarefa 3). Tudo grava em SQLite, funciona offline na demo e declara a origem de cada número (histórico, teste ou operação).

## Critérios de avaliação e o que pesa (R p. 7)
T1 agendamento 15% (**eliminatória**: ponta a ponta, dado gravado e recuperado) · T2 boletim 25% · T3 painel 30% · Agrovia 30% (sobretudo a resposta sobre os funcionários). Desempate: T3, T2, cliente, criatividade. Entregáveis eliminatórios: relatório gerencial, caso de uso UML, BPMN do processo proposto, DER, todos em `/docs`, em texto e imagem.

## Escopo (fluxo principal primeiro)
Prioridade 1 a 6 do CLAUDE.md. Dono = janela (C = agendamento; B = boletim, cadastros e tela do dia; A = painel; G = geral).

### Tarefa 1: agendamento (módulo `agendamento`, janela C; cadastros e tela do dia, janela B)

| # | Funcionalidade | Prior. | Dono |
|---|---|---|---|
| RF1-17 | Compras cria a compra (fornecedor, nº do pedido e itens opcionais, D39) e gera um link com token; o fornecedor agenda por ele; link preenchido confirma a compra; o token só vale uma vez | 1 | C |
| RF1-01, 18 | Fornecedor anexa o arquivo de uma ou mais NF: XML lido automaticamente (chave, emitente, itens, pesos, volumes, espécie, placa quando houver); o arquivo fica guardado e pode ser baixado (D38) | 1 | C |
| RF1-01b | Anexo em PDF (DANFE) com a chave de 44 dígitos e os dados mínimos digitados | 2 | C |
| RF1-02, D26 | Acondicionamento por NF: batido, paletizado ou big bag (carga mista permitida; vale batido se qualquer NF for batida) | 1 | C |
| RF1-03, 04 | Escolha de data e de um dos horários 08h, 10h, 13h, 15h, com a regra de ocupação (ver abaixo); só dia útil | 1 | C |
| RF1-05 | Compras valida NF × pedido: conforme, divergente ou aguardando pedido, com a NF e os itens da compra lado a lado e alertas automáticos (CNPJ do emitente, quantidade, peso) | 1 | C |
| RF1-06, 07 | Responsável verifica a autorização de Compras e informa o(s) armazém(ns) de descarga (sugestão pelo grupo do produto, D16) | 1 | C |
| RF1-08 a 10, 22 | Chegada única do caminhão; entrada e saída **por armazém**; caminhão liberado na última saída | 1 | C |
| RF1-11, 12 | Ao finalizar: quantos funcionários atuaram e quais equipamentos foram usados (por armazém) | 1 | C |
| RF1-14, 19, 15 | Cancelar (fornecedor ou armazém); a vaga liberada é ocupada por quem o responsável escolher | 1 | C |
| RF1-13 | Reagendar por caso fortuito, com exceção do limite por horário | 1 | C |
| RF1-16, 23 | Não recebimento com 1 dos 4 motivos ("outro" exige descrição); divergência pode entrar como **pendência** (D24), com lista e resolução | 1 | C |
| RF1-20 | Tolerância de 30 min: selo "atrasado há X min" e botão que remarca para o próximo horário livre e grava aviso ao fornecedor (D27) | 2 | C |
| RF1-21 | Caminhão sem agendamento: mostra a próxima data disponível; com vaga, agenda na hora | 2 | C |
| RF1-24a | Registro de descarga no celular: início e fim com cronômetro, peso, funcionários, carga e placa | 2 | C |
| RF1-24b | Tela dinâmica do dia (`/dia`): agendamentos, o que está em descarga, há quanto tempo, início e previsão de término; atualiza sozinha | 2 | B |
| RF1-25 | Cadastro (`/cadastros`): armazéns com nome e "faz boletim", equipamentos por armazém, funcionários; grade, feriados e parâmetros para consulta | 2 | B |
| RF1-26 | Peso da balança registrado na chegada quando a carga passa de 500 kg | 2 | C |

**Regra de ocupação (D p. 3, D23, D43):** horário com carga batida fica reservado só a ela; sem batida, até 2 caminhões paletizados ou big bag; vale para a cooperativa inteira; cancelado e remarcado não contam. Capacidade do dia = 8 − nº de batidos (mínimo 4). Sem recebimento aos sábados, domingos e feriados. Verificação e gravação na mesma transação.

### Tarefa 2: boletim diário (módulo `boletim`, janela B)

| # | Funcionalidade | Prior. | Dono |
|---|---|---|---|
| RF2-01, 02 | Produção por linha do formulário: 14 tipos de item, com descarga, remoção e transferência; quantidade da linha = soma das três | 1 | B |
| RF2-03 | Equipe do dia por matrícula (o nome CHAPA_nn vem do cadastro), diária completa ou meia, 1 a 20 funcionários | 1 | B |
| RF2-04, 05 | Cálculo automático da produção, do valor por diária, do total a pagar e do complemento (regra do piso) | 1 | B |
| RF2-06 | Um boletim por armazém por dia; só os armazéns marcados "faz boletim"; cada funcionário em um único boletim por dia | 1 | B |
| RF2-07 | Sem arredondar no cálculo; 2 casas só na exibição | 1 | B |
| RF2-09 | Boletim sem funcionários bloqueado | 1 | B |
| RF2-08 | Boletim de qualquer dia, inclusive sábado | 2 | B |
| RF2-11 | As duas linhas de diária do formulário ("Diária completa" e "Meia diária"), em bloco à parte, somando no subtotal (D12) | 3 | B |
| RF2-10 | Correção de boletim já lançado: reabrir e salvar de novo (o resultado é recalculado) | 3 | B |
| `-` | Boletim para consulta e impressão no formato do papel | 4 | B |

**Preços (D p. 7 e 8, conferidos na planilha; R$ por unidade):** Sacaria malas c/ 25 = 0,1824 · malas c/ 40 = 0,2635 · malas c/ 50 = 0,3224 · fardo c/ 250 = 1,1780 · fardo c/ 500 = 2,3561 · Peças = 0,3387 · Máquinas/equipamentos = 0,3224 · Agroquímico = 0,3224 · Fertilizantes = 0,3224 · Sementes = 0,3224 · Medicamentos = 0,3387 · Alimentação animal = 0,3387 · Acessórios agropecuários = 0,3224 · Serviços diversos = 0,3224 · linha Diária completa = 90,1731 · linha Meia diária = 45,0786. **Piso: R$ 90,1731 por diária equivalente; a meia diária conta 0,5** (D10, firme).

**Fórmula (D p. 8 e planilha):**
```
quantidade da linha  = descarga + remoção + transferência
produção total       = soma de (quantidade da linha × preço)
diárias equivalentes = nº de chapas − 0,5 para cada meia diária
valor por diária     = produção total ÷ diárias equivalentes
se valor por diária < 90,1731:  total a pagar = 90,1731 × diárias equivalentes ; complemento = total a pagar − produção total
senão:                          total a pagar = produção total ; complemento = 0
```

### Tarefa 3: painel gerencial (módulo `painel`, janela A)

| # | Funcionalidade | Prior. | Dono |
|---|---|---|---|
| RF3-00 | **Resposta "sobra ou falta"** em frase, em funcionários e em reais, por período (safra × entressafra, mês, semana) e por armazém, com método e origem. Régua principal = a do boletim: diárias justificadas = produção ÷ piso; excesso em reais = complemento; falta em reais = produção acima do piso (D29). Nos boletins novos é exata e por armazém; no histórico é estimativa declarada (teto do excesso) | 1 | A |
| `-` | Importação e tratamento do histórico (movimentação, folha de funcionários, XML), com marca de qualidade por linha e log por arquivo (D42) | 1 | A |
| RF3-01 | Cargas recebidas por dia e por armazém (histórico, caminhão = D21) | 1 | A |
| RF3-09 | Custo estimado da mão de obra: histórico (D31) e boletins novos | 1 | A |
| `-` | Relatório gerencial (`docs/relatorio.md`) com resposta, números, método, tratamento das inconsistências e origem de cada dado | 1 | A |
| RF3-06 | Fornecedores com maior volume (por peso) | 2 | A |
| RF3-07 | Dias de maior movimento (histórico) e horários (dados `teste` ou `operacao`) | 2 | A |
| RF3-02 a 05, 08 | Tempo médio de espera, de descarga, colaboradores por recebimento, utilização dos locais, não recebimentos por motivo (**sem histórico**: dados `teste` ou `operacao`, origem declarada) | 2 | A |
| `-` | Régua complementar da norma de funcionários (necessário por carga, faixa mínimo a máximo no histórico) | 2 | A |

### Artefatos obrigatórios e transversais

| # | Entregável | Prior. | Dono |
|---|---|---|---|
| ART-1 | DER (`docs/DER.md` → `docs/artefatos/der.md` + PNG) | 1 | G |
| ART-2 | Caso de uso UML (`docs/artefatos/casos-de-uso.md` + PNG) | 1 | G |
| ART-3 | BPMN do processo proposto (`docs/artefatos/processo-bpmn.md` + PNG) | 1 | G |
| ART-4 | Relatório gerencial (`docs/relatorio.md` + gráficos em `docs/artefatos/img/`) | 1 | A |
| `-` | Seed, dados de demonstração, papel selecionável (D05) e relógio da demo (D37) | 1 | G |
| ART-5 | Business Model Canvas (`docs/artefatos/bmc.md`), estados do agendamento (`estados.md`) e matriz de rastreabilidade (`rastreabilidade.md`); pedido do humano em 04/10 | 2 | G |
| ART-6 | Escala de equipes de funcionários (`/equipes`): montar por dia, nome salvo e sugerido, impressão e uso no boletim (D55); pedido do humano em 04/10 | 2 | G |
| `-` | Pitch (`docs/pitch.md`): roteiro de 8 min | 3 | G |

## Critérios de aceite (por tarefa)

**T1 (eliminatória).** (1) Todos os RF1 de prioridade 1 demonstráveis em sequência na tela, sem editar banco à mão. (2) Reiniciar o servidor e reabrir o agendamento mostra os mesmos dados. (3) O horário cheio é recusado e a próxima data disponível aparece. (4) Duas NF no mesmo agendamento; um caminhão com saída em dois armazéns. (5) Divergência entra como pendência e aparece na lista. (6) Os 4 motivos de não recebimento gravam. (7) Teste de fumaça Playwright verde na integração.
**T2.** Os casos T1 a T11 e B1 a B5 passam no Vitest e os casos T1 e T2 aparecem iguais na tela; funcionário repetida no mesmo dia em outro armazém é recusada; boletim sem funcionário é recusado; mais de 20 funcionários é recusado; o servidor recalcula ao salvar; recarregar mostra o boletim gravado.
**T3.** O topo do painel responde com **frase, número de funcionários e reais**, por período; a origem e o método aparecem; trocar safra por entressafra muda os números; meses sem dado (ago e dez/2025) e parciais aparecem como lacuna e ficam fora das médias; o relatório traz os mesmos números do painel.
**Agrovia.** A resposta usa as palavras "excesso" e "falta" de funcionários; a tela do dia mostra o que está em descarga; a próxima data disponível aparece para quem chega sem agendar.

## Casos de teste (Vitest; dono indicado)
Valores exatos são comparados com a função de igualdade de `lib/money.ts` (decimal contra decimal, não texto contra texto: `54,8080` e `54,808` são o mesmo valor); "exibe" é o resultado de `formatBRL` (2 casas, `ROUND_HALF_UP`). Ordem e isolamento: `docs/plano-paralelo.md` e D44.

### Boletim (janela B; fonte D p. 8 e 9 e a planilha)
Produção base = 2.778 fertilizante + 30 agroquímico + 40 serviços diversos = 2.848 × 0,3224 = **918,1952** (exibe 918,20). Os testes usam o fator 0,5 da meia diária, nunca 45,0786.

| Caso | Entrada | Exato | Exibe |
|---|---|---|---|
| T1 base | produção base; 11 funcionários completas = 11 diárias | valor/diária 83,4722909…; total 991,9041; complemento 73,7089 | 918,20; 83,47; 991,90; 73,71 |
| T2 variação | produção base; 10 completas + 1 meia = 10,5 | valor/diária 87,4471619…; total 946,81755; complemento 28,62235 | 87,45; 946,82; 28,62 |
| T3 acima do piso | 4.000 × 0,3224 = 1.289,60; 11 diárias | valor/diária 117,2363636…; total 1.289,60; complemento 0 | 117,24; 1.289,60; 0,00 |
| T4 limite do piso | 11 funcionários; produção = 991,9041; depois 991,9040; depois 991,9042 | complemento 0; 0,0001; 0 | a decisão usa o valor sem arredondar |
| T5 três modalidades | Fertilizantes: descarga 100 + remoção 50 + transferência 20 | quantidade 170; valor 54,8080 | 54,81 |
| T6 sem funcionários | 0 funcionários | recusado, com a causa | |
| T7 21 funcionários | 21 funcionários | recusado | |
| T8 funcionário repetida | mesma matrícula em 2 boletins no mesmo dia | o segundo é recusado, nada parcial gravado | |
| T9 divisão que não termina | 3 funcionários, produção 100 | valor/diária 33,3333333333 (10 casas); total 270,5193; complemento 170,5193 | 33,33; 270,52; 170,52 |
| T10 só meias | 2 meias, produção 50 | diárias equivalentes 1; total 90,1731; complemento 40,1731 | 90,17; 40,17 |
| T11 linha de diária | linha "Meia diária" com quantidade 1 | soma 45,0786 à produção | 45,08 |
| B1 | 20 funcionários completas | aceito | |
| B2 | 11 funcionários; produção 0 | valor/diária 0; total 991,9041; complemento 991,9041 (sem NaN) | |
| B3 | mesma matrícula duas vezes na mesma lista | recusado | |
| B4 | segundo boletim do mesmo armazém e dia; armazém com `faz_boletim = 0` | os dois recusados, nada parcial gravado | |
| B5 | reabrir e salvar de novo (RF2-10) | não conflita com a própria funcionário; resultado recalculado | |

### Dinheiro (`lib/money.ts`, janela geral)

| Entrada | Exibe |
|---|---|
| 1,005 | 1,01 |
| 0,005 | 0,01 |
| 946,81755 | 946,82 |
| 1289,6 | 1.289,60 |

### Ocupação e regras puras do agendamento (janela C)

| Caso | Situação | Esperado |
|---|---|---|
| O1 | horário vazio | aceita batido ou unitizado |
| O2 | horário com 1 batido | recusa qualquer outro |
| O3 | horário com 1 unitizado | aceita mais 1 unitizado; recusa o 3º; recusa batido |
| O4 | horário com 2 unitizados, 1 cancelado | volta a aceitar |
| O5 | sábado, domingo, feriado | recusa; sugere a próxima data útil |
| O6 | reagendamento por caso fortuito | ignora o limite do horário |
| O7 | todos os horários do dia cheios | próxima data disponível = primeiro horário livre depois |
| O8 | NF batida + NF paletizada | agendamento conta como batido |
| O9 | dia com 2 batidos e o resto unitizado | capacidade 6 (8 − 2) |
| O10 | atraso de 31 min | está atrasado; a remarcação vai para o próximo horário livre e grava aviso |
| O11 | atraso de exatamente 30 min | não está atrasado |
| O12 | dia com 0 batidos; dia com 4 batidos | capacidade 8; capacidade 4 |
| O13 | horário fora da grade (09h); data passada | recusados |
| O14 | caso fortuito em horário cheio; depois um agendamento comum no mesmo horário | o primeiro entra; o comum é recusado (o excedente conta) |

### Ponta a ponta com banco em arquivo (janela C)

| Caso | Situação | Esperado |
|---|---|---|
| E1 | compra → token → agendamento com 2 NF (batida + paletizada); fechar a conexão e reabrir o arquivo | mesmas linhas; `acondicionamento_ocupacao = batido`; 2 linhas em `agendamento_nf` |
| E2 | horário cheio e dois pedidos seguidos | o segundo é recusado, nada gravado, devolve a próxima data |
| E3 | um caminhão, 2 armazéns, entrada e saída em cada, funcionários e equipamento por armazém | 2 linhas em `agendamento_armazem`; `liberacao_em` = última saída; status `concluido` |
| E4 | divergência; os 4 motivos de não recebimento; motivo inválido; "outro" sem descrição | pendência `aberta` e listada; os 4 gravam; os inválidos são recusados |
| E5 | cancelar → `vaga_liberada` → responsável escolhe o ocupante | o horário volta a aceitar; evento `vaga_ocupada` gravado |
| E6 | usar o token duas vezes; a mesma chave de acesso em dois agendamentos ativos | compra `confirmada` e segundo uso recusado; NF duplicada recusada |

### Painel (janela A)

| Caso | Entrada | Esperado |
|---|---|---|
| P1 | presentes 15, café 3, diárias justificadas 5; depois efetivo 3 e justificadas 5; depois café maior que presentes | +7 com a palavra "excesso"; −2 com "falta"; a linha inconsistente é marcada e contada, nunca vira efetivo negativo |
| P2 | excesso de 7; falta de 2 | 7 × 90,1731 = 631,2117 (exibe 631,21); 2 × 90,1731 = 180,3462 (exibe 180,35) |
| P3 | 139.000 kg de fertilizante no dia; efetivo 11 | 2.780 sacas; produção estimada 896,2720; diárias justificadas 9,94; excesso 1,06; complemento estimado 95,6321 |
| P4 | safra com dez/2025 vazio; mês parcial (5 dias) | média só dos meses com dado; período sem dado aparece como "sem dado", nunca 0 ou NaN |
| P5 | boletim novo: produção 918,1952, 11 diárias | excesso 0,82 funcionário (11 − 10,18); em reais 73,7089, igual ao complemento |
| P6 | dados `historico` e `teste` no mesmo período | a origem aparece em cada número; nunca somados sem rótulo |
| N1 | batido, 500 kg | 0 funcionários |
| N2 | batido, 500,001 kg | 5 |
| N3 | paletizado, 12 t | 1 + empilhadeira |
| N5 | NF batida + NF paletizada | 5 (o maior) + empilhadeira |
| N6 | perfil `dossie`, paletizado | 2 |
| N7 | dia sem cargas | 0 |

**Importador (janela A):** linha sem data de recebimento fica marcada e fora dos indicadores; CNPJ com pontuação é normalizado; agosto e dezembro de 2025 viram `hist_periodo_sem_dado`; rodar duas vezes dá as mesmas contagens.

## Roteiro da demo (4 a 5 min; 8 min de pitch)
O relógio da demo (D37) põe o sistema numa segunda-feira de manhã.
1. **0:00** Problema em 20 s e a pergunta central.
2. **0:20** Compras gera o link; o fornecedor abre, anexa **2 XML** (um batido, um paletizado), tenta um horário cheio, o sistema recusa e mostra a próxima data; escolhe outro.
3. **1:20** No dia: o porteiro marca a chegada; Compras acusa divergência; o responsável aceita a carga com **pendência**, define **2 armazéns**; no celular marca entrada e saída em cada um, 3 funcionários e a empilhadeira. Reinicia-se o servidor e os dados continuam lá. A tela do dia mostra a descarga em andamento.
4. **2:30** Boletim do Adubo de 17/11/2025: lança 2.778, 30 e 40, 11 funcionários, vê **918,20 / 83,47 / 991,90 / 73,71**; troca um funcionário para meia diária e vê **87,45 / 946,82 / 28,62**.
5. **3:30** Painel: "No período X houve **excesso** de N funcionários por dia, cerca de R$ Y em complemento; nos dias de pico, **falta** de M", por armazém, com a origem de cada número.
6. **4:30** Fecha com a próxima data disponível para quem chega sem agendar. Plano B: tudo roda com `next start` e banco seed local, sem rede.

## Dados seed e modo demo
- Cadastros reais (produtos, fornecedores, matrículas) importados de `PACOTE_DIR`; nada disso entra no git.
- Dados de demonstração `origem = teste`, gerados no passo 0 de forma determinística para os três módulos: compras com link, agendamentos em vários estados nos dias úteis em torno da data da demo (um horário cheio, um cancelado com vaga liberada, um com divergência), execuções concluídas com horários de chegada, entrada e saída, não recebimentos, pendências, e boletins por armazém (menos o do Adubo de 17/11/2025, que é lançado ao vivo). As NF de demonstração são sintéticas e o script não cita nome nem CNPJ real.
- `npm run db:rebuild` recria a matriz (`data/base.db`); a demo roda numa cópia (`data/demo.db`) e `npm run db:clone:demo` a devolve ao estado inicial em segundos, sem o pacote de dados.
- Relógio da demo: `DEMO_AGORA` em uma segunda-feira (D37). A demo roda com `next build` e `next start` na porta 8000, sem CDN e sem fonte remota.

## IA: onde gera valor, timeout e fallback
No MVP não há IA em tempo de execução: o ganho vem da leitura determinística do XML da NF. Se o grupo 3 for aprovado, a consulta em linguagem natural escolhe uma consulta pré-definida; timeout de 5 s; sem rede ou erro, cai nas consultas fixas; dados pessoais mascarados antes de qualquer envio; chave só no `.env` (D32).

## Riscos principais (detalhe em `docs/plano-paralelo.md`)
| # | Risco | Mitigação |
|---|---|---|
| 1 | T1 incompleta ou sem persistência (eliminatória) | T1 ponta a ponta primeiro, com prioridade 1 completa até 20h45 (limite duro); casos E1 a E6; fumaça Playwright; ensaio reiniciando o servidor |
| 2 | Artefatos só no fim (eliminatório) | Esqueletos dos 3 diagramas e do relatório até 17h45 (commit das 18h); diagramas completos e relatório com os primeiros números até 20h45; relatório preenchido antes de 03h |
| 3 | Demo cai (rede, montagem, domingo sem recebimento) | Seed offline, `next start`, relógio da demo que não volta ao reiniciar, banco da demo restaurável em segundos (`db:clone:demo`), ensaio de 8 min, build no notebook da demo antes das 07h |
| 4 | Boletim errado por centavo | Fórmula conferida na planilha (D10), casos T1 a T11, decimal.js |
| 5 | Sobra ou falta sem boletim histórico | Régua do boletim com produção estimada, declarada como teto; calibração com o boletim real; dado novo exato por armazém |
| 6 | Três janelas quebrando uma à outra | Pastas por módulo, `tsc` e Vitest por módulo, integração a cada ~90 min |
| 7 | Dado original no repositório | `.gitignore` de `docs/contexto/`, `data/` e `.env`; `git status` antes de cada commit |
| 8 | Pico de cerca de 15 caminhões/dia contra capacidade de 8 pela grade (cálculo meu) | A recusa e a próxima data mostram o gargalo; vira argumento do painel, não bug |
| 9 | Pacote de dados extraído pela metade (D45) | Extrair o zip de novo antes do passo 0 |

## Cronograma (T0 = sáb 08h; detalhe em `docs/plano-paralelo.md`)
Passo 0 em liberações (D41) → janelas em paralelo → integração a cada ~90 min (16h15, 17h45, 19h15, 20h45, 22h15, 23h45, 01h15, 02h45, 04h30, 06h00) · commit ao fim de cada integração e a cada 2 h a partir das 18h · **corte de escopo 20h** · **T1 prioridade 1 completa até 20h45** · **congelamento funcional 03h** (só bugfix) · commit final 06h30 · **repositório congelado 07h** · pitch 08h.

## Depois do essencial (grupos 2 a 6 de `ideias.md`, nesta ordem)
Só começam depois de: T1 verde na integração, T2 verde nos casos, T3 com a resposta no ar e os esqueletos dos 4 artefatos em `/docs`. Em ordem. Custo: P ≤ 2 h, M ≤ 4 h, G > 4 h [SUPOSIÇÃO]. Às 20h o Diego aprova a lista do que sobrevive; o que ficar fora dela está **cortado**. Item da janela C pode ser aprovado sob condição: só entra se a T1 prioridade 1 estiver verde às 20h45. Depois de 01h15 nenhuma tarefa nova começa.

| Ordem | Grupo e itens | Custo | Risco | Gatilho para começar | Onde entra |
|---|---|---|---|---|---|
| 1 | **2 Alto valor:** dimensionar funcionários e equipamentos por carga no agendamento; efetivo do dia seguinte e texto do aviso ao prestador; alerta de falta de colaborador, equipamento ou espaço; prioridade para defensivos e fertilizantes | M cada; a prioridade P | Baixo (local). A prioridade conflita com R p. 1 (D23): só como override com justificativa e se aprovada | Painel mostrando a resposta (RF3-00) e `lib/painel/norma.ts` testada | C (dimensionar e alerta, no agendamento) e A (efetivo do dia seguinte e aviso) |
| 2 | **3 Diferenciais:** leitura automática da NF (já é o núcleo do RF1-01, só o resumo na tela); consulta em linguagem natural | P (resumo da NF), M (linguagem natural) | Linguagem natural: rede e LLM no anfiteatro; o exemplo de setembro não tem folha | T1 verde. Linguagem natural só com a T3 pronta e antes das 03h | C (resumo) e A (consulta) |
| 3 | **4 Portaria e câmera:** leitura do código de barras do DANFE (chave de 44 dígitos) com entrada manual; histórico do motorista por placa | M, P | Luz, foco, permissão da webcam, reflexo de tela. Placa por câmera, cancela simulada e OCR são projeto paralelo: **cortados** | T1 verde e decisão até 20h; execução 20h a 00h | C |
| 4 | **6 Agenda e operação:** previsão do tempo (com cache e fallback), registro de atraso manual, almoço na grade, alerta de equipamento indisponível, relatório de chegadas | P cada | Tempo depende de rede: timeout e cache. Testar grades alternativas contradiz R p. 1: **cortado** | T1 verde e tudo verde na integração; até 01h15 | C e B |
| 5 | **5 Mobilidade e notificações:** app Expo, notificação push, relógios | G | A banca não instala o Expo Go em 8 min; push remoto exige rede e, no Android, build de desenvolvimento (documentação do Expo). Relógios: fora | Só se sobrar tempo depois de tudo; a tela web do celular (RF1-24a) já cobre o uso | Candidato a corte às 20h |

## O que NÃO vamos fazer
- Integração com SAP; hospedagem ou deploy (a demo roda no notebook); vídeo de demonstração.
- Dado original da Agrovia (inclusive o LEIA-ME) no repositório, ou qualquer publicação dos dados; apagar as cópias ao fim do evento (R p. 8).
- Interpolar agosto e dezembro de 2025 (P12).
- Carregamento de cooperado e transferências como funcionalidade (P8; a Agrovia não pode fornecer esses registros).
- Reabrir a especificação original (06) onde o dossiê diverge; polimento visual antes do fluxo principal.
- Ler a placa por câmera, cancela automática, OCR de placa ou de DANFE, testar grades alternativas, leitura automática de e-mail ou WhatsApp, integração real de e-mail ou push (itens cortados nos grupos 4 e 6).
- Remarcação automática sem ação do responsável (D27); envio real de aviso ao fornecedor ou ao prestador.
- **Corte antecipado (03/10, 18h35, aprovado pelo humano):** leitura do código de barras do DANFE pela câmera (precisaria de dependência nova; a chave digitada já cobre) e todo o grupo 5 (app Expo, notificação push, relógios; a tela web no celular cobre o uso). Sobreviveram e estão feitos: grupo 2 inteiro (dimensionar, efetivo do dia seguinte e aviso, alertas, prioridade como override com justificativa), grupo 3 (resumo da NF e consulta em linguagem natural do jeito da D32), grupo 4 só o histórico por placa, grupo 6 (previsão do tempo, atraso manual, alerta de equipamento, relatório de chegadas; almoço na grade fora, a grade de 4 horários já o exclui).
- **Entrou por decisão do humano (03/10, 19h40, D48 e D49):** identidade visual da Agrovia; login único com os perfis Adm Master, Compras e Fornecedor; cadastro de fornecedor por convite com aprovação; Espaço Fornecedores com calendário e histórico; área de Aprovações; gestão de usuários; Tela do Dia redesenhada. Continua fora: envio real de e-mail (o link aparece na tela).
- Qualquer item de `ideias.md` fora da ordem acima ou depois do corte das 20h.
