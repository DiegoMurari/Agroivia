# 00 · Problema

Só problema, operação e dados. Sem solução nem stack. Siglas: D p. X = Dossiê, R = Regulamento, L = LEIA-ME, Agrovia 03/10 = respostas-agrovia.md, P# = premissa da equipe, D## = decisão em DECISOES.md. Hierarquia: R e D > L (fatos sobre os dados) > Agrovia 03/10 > premissas.

## 1. Problema

- **Problema 1:** o caminhão chega sem aviso. Só cerca de 20% dos fornecedores avisam (D p. 1). A Agrovia não sabe quantos caminhões, que carga, qual armazém, quanta gente e qual equipamento. Nada é registrado: nem chegada, nem início e fim de descarga, nem pessoas, nem equipamentos (D p. 2; L).
- **Problema 2:** a Agrovia "não sabe se a equipe de funcionários que aloca todos os dias está sobrando ou faltando" (D p. 1). O boletim é preenchido à mão e nunca é consolidado.
- **Pergunta central: sobra ou falta funcionário?** Resposta esperada por armazém, por período e em reais (R p. 3). A Agrovia pensa em "funcionário em excesso, funcionário faltando" (Agrovia 03/10, número de pessoas). A equipe entrega número de funcionários e reais lado a lado (P1, D29).
- **Por que é o mais importante:** "o custo de pessoal é a principal preocupação da direção" e hoje não há visibilidade nenhuma (D p. 1, 9). Pode haver semanas com muita gente e pouco serviço.
- Os dois problemas são faces de um só: sem saber o que chega, não se dimensiona; sem registrar o que foi feito, não se sabe se acertou (D p. 1).

## 2. Operação hoje e com a regra nova

**Hoje (D p. 2, 6 a 7; Agrovia 03/10)**

1. O caminhão chega sem aviso e espera fora, chamado por ordem de chegada. Avisar não garante nada.
2. Portaria: o porteiro avisa e um responsável (que tem computador, P15) vai receber. Tiram foto da nota e registram no WhatsApp o que chegou (controle interno). A NF traz placa e transportadora.
3. Consulta ao SAP: existe pedido? Se não (fornecedor novo ou pedido esquecido), o recebedor pede confirmação ao comprador. O pedido costuma ser lançado no SAP depois da NF (D p. 2).
4. O conferente confere os produtos contra a NF e lança em planilha de papel; NFs são digitalizadas e arquivadas. O peso vem da balança: acima de 500 kg pesa, abaixo não.
5. Descarga pelos funcionários, sem registro de horários, pessoas ou equipamento. A sobra vai para o próximo dia útil, na mesma fila. Não há multa, mas adubo e fertilizante retidos custam "pontos de relacionamento" (D p. 2).
6. Boletim diário no papel, referente ao dia anterior, por armazém (D p. 7).

**Com a regra nova (D p. 3 e 4)**

- Agendamento obrigatório; a fila por ordem de chegada deixa de existir. Com agendamento há prioridade; sem agendamento e sem vaga, não é atendido; sem agendamento e com vaga, entra depois de o fornecedor agendar na hora.
- O agendamento é feito todo pelo fornecedor; um caminhão pode trazer mais de uma NF; sem agendamento o sistema mostra a próxima data disponível; fornecedor e armazém podem cancelar (Agrovia 03/10).
- Fluxo de Compras: Compras gera um link por compra, o fornecedor preenche e a compra é confirmada.
- Divergência: a carga "geralmente recebe e resolve depois a NF com fornecedor", como pendência (CONFLITO 4.7, decidido em D24).
- Caminhão para mais de um armazém: um agendamento, uma carga, saída marcada em cada armazém (P13).
- Atraso: tolerância de 30 min; depois, ou se não aparecer, remarca e avisa (P14, D27).
- Registros novos: chegada, entrada, saída, funcionários e equipamentos por descarga (D p. 3).
- O histórico descreve o mundo antigo (fila, tudo entra). A solução opera no mundo novo (D p. 4).

## 3. Fatos e números

**Agrovia:** fundada em 1985, em Franca; cerca de 2.200 cooperados e mais de 40 mil ha (D p. 1). Recebe só de segunda a sexta; a descarga iniciada termina no mesmo dia (D p. 7, 9). O carregamento de cooperado está fora de escopo, mas disputa os mesmos funcionários (D p. 6, 11; P8).

**Armazéns e grupos (D p. 4 e 5; D15, D16)**

| Grupo | Armazém físico |
|---|---|
| FER | Adubo (Pátio de Adubos) |
| MAQ | Pátio de Máquinas |
| AGR | Insumos |
| PEC, ALI, MED, ACE | Loja |
| SEM (existe no cadastro, fora da lista do dossiê) | Insumos (D16) |

Depósitos que recebem: MATLoja, MATGeral, MATFerti, MATDefe, MATMaq e os secundários MATDef2, MATGer2, MATFert2. O depósito não corresponde ao local físico; o destino acompanha o grupo. MATGeral fica dentro de Insumos. MATProv e MATReser nunca recebem. Uma NF pode ter itens para armazéns diferentes. Boletim em 3 dos 4 armazéns, configurável (D17).

**Equipamentos (D p. 5)**

| Local | Equipamento (qtd) |
|---|---|
| Insumos | empilhadeira a gás (1); elétrica/retrátil (1); transpaleteira elétrica (2); paleteira elétrica (2); paleteira manual (2); carrinho de mão (2) |
| Adubo | empilhadeira a gás (2, podem subir ao Insumos); paleteira manual (1) |
| Pátio de Máquinas | empilhadeira a gás (1, centro de custo Logística); trator (4) |
| Loja | carrinho de mão (quantidade não consta) |

Empilhadeira serve para paletes e big bag; carga batida é manual, saco a saco. Não há regra de alocação de equipamento nem de trator por peso (D p. 6). "Sempre há empilhadeira disponível" (D p. 2).

**Norma de funcionários, lado a lado**

| Condição | Dossiê (D p. 6) | Agrovia 03/10 | Decisão |
|---|---|---|---|
| Até 500 kg | nenhum | não consta | P7: nenhum |
| Batido, acima de 500 kg | 5 | no mínimo 5 | 5 |
| Paletizado / big bag | 2 | empilhadeira + 1 funcionário | CONFLITO 4.2, D25: perfil Agrovia padrão, perfil Dossiê como sensibilidade |
| Máquina/implemento | 1 operador + ao menos 1 funcionário | não consta | 1 funcionário, operador não conta |
| Carga mista | "não há" | pode haver; batido + outro é incomum | CONFLITO 4.3, D26 |
| Operador de empilhadeira | não explícito | não conta como funcionário | não conta |

**Tempos de descarga: ESTIMATIVA, não medição (D p. 9 e 10)**

| Carga | Tempo | Recursos |
|---|---|---|
| 10 paletes | 15 min | 1 empilhadeira, 2 funcionários |
| 20 big bags | 30 min | 1 empilhadeira, 2 funcionários |
| 200 sacas de 50 kg, batido | 40 min | 5 funcionários |
| 28 t a granel, batido | 50 min | 5 funcionários |
| Adubadeira/implemento | 15 a 20 min | 1 operador, ao menos 1 funcionário |

Big bag de 500 kg e de 1 t levam o mesmo tempo. Ciclo completo (tirar, transportar, guardar): cerca de 5 min por volume (palete ou big bag), só para carga unitizada. A tabela de tempos do PDF da especificação é ilustrativa e não vale (L). Permanência média: 2 h.

**Sazonalidade e mão de obra**

- Caminhões por dia: 5 a 6 no normal; cerca de 15 no pico. Volume sobe "50% ou mais" no pico (D p. 5, 9). Divergência entre carga e pedido: 1 a 2 vezes por mês.
- Funcionários: cerca de 8 no normal; 14 ou 15 de outubro a março (D p. 6). Safra = outubro a março, entressafra = abril a setembro (P3, D19; a Agrovia respondeu só "Safra").
- Os funcionários circulam entre armazéns no mesmo dia (Agrovia 03/10).

**Os 3 valores de "diária" (D p. 9)**

| Valor | O que é |
|---|---|
| R$ 90,1731 | piso do boletim; **forma o custo da operação** |
| R$ 99 a R$ 113 | diária base da folha |
| R$ 180,00 | custo carregado por pessoa (DSR, férias, 13º, FGTS, INSS) |

Custo estimado = total do boletim (produção, ou piso + complemento). Encargos não entram (D p. 9; P2, D31).

## 4. Dados disponíveis (L)

| Arquivo | Conteúdo | Chave / período |
|---|---|---|
| 01_notas_fiscais/xml | 460 NF-e de entrada (amostra, não proporcional) | 2022 a 2026; chave de acesso, CNPJ |
| 01_notas_fiscais/danfe_pdf | as mesmas notas em PDF | consulta visual |
| 02_cadastros/produtos.xlsx | 10.604 produtos (peso, unidade, grupo, depósito); um produto pode estar em mais de um depósito | nº do item |
| 02_cadastros/fornecedores.xlsx | 859 fornecedores | CNPJ |
| 02_cadastros/estoque_por_armazem | posição atual dos 4 armazéns | nº do item |
| 03_movimentacao/pedido_recebimento_notafiscal.xlsx | 41.779 linhas, jun/2022 a set/2026; 12.073 pedidos (mediana 2 itens, média 3,5, máx. 154); 4% vão a mais de um depósito | chave de acesso, item, depósito, data de recebimento |
| 04_mao_de_obra/chapas_por_dia_2025 e 2026.xlsx | folha diária dos ensacadores (aba por mês, quinzenas, coluna por dia); nomes trocados por CHAPA_01... | por data |
| 04_mao_de_obra/chapas_por_dia.csv | uma linha por data: dia da semana, presentes, "operação de café", valor pago | por data |
| 05_operacao | equipamentos_descarga.xlsx; registro_manual_recebimento.pdf (cerca de 200 lançamentos, abr a jul/2026); formulário em branco; boletim_diario_chapas.xlsx (1 dia: Adubo, 17/11/2025) | |
| 06_especificacao | PDF da visão original (prevalece o dossiê); mapa_relacoes_sap.jpeg | |

**Nunca registrado:** horário de chegada, início e fim de descarga, pessoas por recebimento, equipamento usado. Não existe em sistema algum (L). Só há 1 boletim (Agrovia 03/10); o custo histórico é estimativa declarada (P2).

**Ligações entre arquivos (L):** chave de acesso liga a planilha de movimentação ao XML (os 460 XMLs são subconjunto); CNPJ liga a nota ao cadastro de fornecedores; nº do item liga movimentação, produtos e estoque; depósito identifica o armazém de destino; data de recebimento cruza com a folha de mão de obra.

**O que falta ou exige cuidado**

- A folha **não indica armazém** (hoje nem é anotado; "seria interessante", Agrovia 03/10). Ver D30.
- O CSV conta a "operação de café" à parte; fica fora do efetivo dos armazéns e separada no painel (P9, D18).
- **Agosto e dezembro de 2025 não têm folha.** Sem interpolação, fora das médias (P12, D20).
- A movimentação só tem **compras**, uma linha por item de pedido, não por caminhão nem por NF. Caminhão histórico = notas do mesmo fornecedor na mesma data, aproximação declarada (P10, D21).
- O código do item na planilha é o da Agrovia; no XML é o do fornecedor (1 em 838 casa).
- Acondicionamento histórico: só a espécie declarada no XML, quando existir; sem ela não se infere (P11, D22). Pesos e espécie vêm do fornecedor.
- Registros de saída (cooperados) e transferências existem na Agrovia, mas não foram fornecidos.
- Dados sem limpeza; tratar faz parte da avaliação (L). Os originais não vão para o repositório e só valem durante o evento.

**Conferido direto nos arquivos em 03/10** (detalhe na seção 9 de `DECISOES.md`)

- A planilha de movimentação **não tem CNPJ nem unidade**: o fornecedor é o código do parceiro (`Cod PN`), a unidade vem do cadastro de produtos.
- O cadastro de produtos tem o grupo **SEM** (sementes), que não está na lista do dossiê; PEC é "peças".
- A planilha de equipamentos só tem nome e utilização; quantidade e armazém vêm do dossiê.
- No boletim de exemplo a **matrícula é um número** (158, 137...) e o nome CHAPA_nn vem de uma lista ao lado. O formulário tem 16 linhas: os 14 tipos mais "Diária completa" e "Meia diária", que também somam no subtotal.
- A folha (CSV) vai de 02/01/2025 a agosto de 2026, tem 72 sábados e 2 domingos, e janeiro de 2025 só tem 5 dias. O café nunca passa dos presentes e aparece em 9 dias. Em 17/11/2025: 12 presentes (11 estavam no boletim do Adubo).
- A pasta do pacote extraída na máquina está incompleta (2 XML; o zip tem 460): extrair de novo (D45).

## 5. Boletim e regra do piso (D p. 7 a 9)

Produção = soma de (descarga + remoção + transferência) × preço unitário de cada tipo de item.

| Tipo | Preço |
|---|---|
| Sacaria malas c/ 25 | R$ 0,1824 |
| Sacaria malas c/ 40 | R$ 0,2635 |
| Sacaria malas c/ 50 | R$ 0,3224 |
| Sacaria fardo c/ 250 | R$ 1,1780 |
| Sacaria fardo c/ 500 | R$ 2,3561 |
| Peças, Medicamentos, Alimentação animal | R$ 0,3387 |
| Máquinas/equipamentos, Agroquímico, Fertilizantes, Sementes, Acessórios agropecuários, Serviços diversos | R$ 0,3224 |
| Diária completa | R$ 90,1731 |
| Meia diária | R$ 45,0786 |

```
diárias equivalentes = nº de chapas - 0,5 para cada meia diária
valor por diária     = produção total / diárias equivalentes
se valor por diária < R$ 90,1731:
    total a pagar = R$ 90,1731 x diárias equivalentes
    complemento   = total a pagar - produção total
senão:
    total a pagar = produção total
    complemento   = 0
```

Sem teto. Até 20 funcionários por boletim, por matrícula; cada funcionário em um único boletim por dia (Agrovia 03/10). Sem arredondamento no cálculo (D03).

**Exemplo de 17/11/2025, Adubo (D p. 8 e 9):** 2.778 fertilizante + 30 agroquímico + 40 serviços diversos = 2.848 × R$ 0,3224 = R$ 918,20. Com 11 funcionários: 11 diárias equivalentes, R$ 83,47 por diária, paga R$ 991,90, complemento R$ 73,71. Com 1 meia diária: 10,5 equivalentes, R$ 87,45 por diária, total R$ 946,82, complemento R$ 28,62.

## 6. Usuários, papéis, dores e sucesso

| Papel | Relação com o problema |
|---|---|
| Porteiro | avisa a chegada |
| Responsável pelo armazém | tem computador; valida a autorização de Compras, define destino, registra marcos, funcionários e equipamentos; preenche o boletim (D p. 3, 7). Se é o mesmo que recebedor/conferente: não consta |
| Compras | valida NF contra pedido; decide em divergência; gera o link da compra |
| Fornecedor | agenda, anexa NF, informa acondicionamento |
| Funcionários | não usam o sistema; o responsável os lança; pagos por produção com piso |
| Prestador de serviço | recebe na véspera o número de colaboradores |
| Direção | faz a pergunta central |
| RH | a folha de ponto é o registro oficial (D p. 8) |

**Dores declaradas:** chegada sem aviso; dia por reação; nada medido; custo de pessoal invisível; boletim em papel nunca consolidado; avisar não adianta; adubo retido custa relacionamento (D p. 1 e 2). Agrovia 03/10: adubo e chuva (adubo não pode tomar chuva), falta de espaço e remanejamento, pessoas da terceirizada, clima, tipo de carga, almoço, não saber o que está chegando.

**Não é problema:** escassez de recursos (reorganizam com quem há; sempre há empilhadeira); custo direto da postergação (sem multa nem diária) (D p. 2, 9). Espaço: ver CONFLITO 4.8.

**Sucesso para o cliente:** passar a medir a operação (D p. 1) e responder à direção, por armazém, por período e em reais, com números da própria operação (R p. 3). [SUPOSIÇÃO] Sair da demo sabendo onde e quando sobra ou falta funcionário, em números que a direção reconheça, e poder usar agenda e boletim já no pico de outubro a março.

## 7. Armadilhas

1. Funcionários por descarga **não somam** no dia (a mesma equipe atende várias); o efetivo do dia vem do boletim por matrícula (D p. 4).
2. O boletim cobre toda a movimentação, não só recebimento; o histórico só tem compras (D p. 7). A sobra aparente do histórico é teto (D29).
3. Três valores de diária; usar o total do boletim, sem encargos (D p. 9).
4. Código de produto da NF é do fornecedor; o pedido usa o da Agrovia (D p. 3; L).
5. Depósito diferente de local físico; MATGeral mistura grupos; o limite de horários vale para a cooperativa inteira (D p. 3, 5).
6. Tempos são estimativas; o ciclo de 5 min vale só para unitizada; descarga iniciada não é interrompida (D p. 9 e 10).
7. A folha não tem armazém; agosto e dezembro de 2025 sem dados; o CSV inclui café.
8. O histórico reflete fila; a solução opera com agendamento obrigatório.
9. Os 460 XMLs são amostra para formato, não volume (D p. 11).
10. Dados sujos; tratar é avaliado; não incluir originais no repositório (L).
11. A meia diária conta 0,5; ignorá-la distorce pago e complemento (D p. 8).
12. Uma pessoa trabalha em vários armazéns no mesmo dia, mas só entra em um boletim.

## 8. Conflitos e premissas

| Item | Conflito ou lacuna | Decisão adotada | Ainda depende da Agrovia |
|---|---|---|---|
| 4.1 Diária | Agrovia: meia fixa 45,0786, completa 90,1572. D: 90,1731, meia = 0,5. Só 0,5 × 90,1731 fecha os números do dossiê | D10, firme: as fórmulas de `boletim_diario_chapas.xlsx` usam piso 90,1731 × diárias equivalentes, com 0,5 por meia e sem arredondar (conferido em 03/10). O 45,0786 é o preço da linha "Meia diária" do formulário (D12). Arredondamento só na exibição: D03 | nada que bloqueie |
| 4.2 Funcionários por palete/big bag | D: 2. Agrovia: empilhadeira + 1 | D25 | confirmar a norma |
| 4.3 Carga mista | D: não há. Agrovia: pode haver | D26 | descrever a mistura real |
| 4.4 Modalidades | definições diferentes de remoção e transferência | D11, P8 | só muda o texto de ajuda |
| 4.5 Contratação | D: anual com reforço. Agrovia: prestadora, pedido na véspera | D33 | sem efeito no código |
| 4.6 Grade de horários | R p. 1: respeitar a regra. Agrovia: "não é regra fixa" | D23 (regra do dossiê, override explícito) | prioridade de defensivos e fertilizantes pode exceder o limite? |
| 4.7 Divergência | Agrovia: entra com pendência. R p. 2: não recebimento. D p. 3: Compras valida antes | D24 | entra com pendência ou Compras barra? |
| 4.8 Espaço | Agrovia: falta por falta de agendamento. D: nenhuma ocorrência registrada | D33 (alerta qualitativo) | registro de espaço |
| 4.9 Boletim | Agrovia: 3 locais. R p. 2: um por armazém (4) | D17 (Insumos, Adubo, Pátio de Máquinas) | quais são os 3 locais |
| P1 | Agrovia pensa em pessoas; R pede reais | D29: funcionários e reais pela lógica do boletim (diárias justificadas = produção ÷ piso; excesso em reais = complemento; falta em reais = produção acima do piso) | conversão de unidades do fertilizante |
| P2 | Sem boletins históricos | D29 e D31: produção estimada só do recebimento; custo = fórmula do boletim aplicada ao dia; excesso histórico é teto | boletins históricos |
| P3 | Meses da safra | D19 (out a mar) | confirmar os meses |
| P4 | Armazéns e locais com boletim | D15, D16, D17 | confirmar |
| P6 | "Mala" e "fardo" sem resposta | D12 (escolha manual) | significado |
| P9, P10, P11, P12 | café, caminhão histórico, acondicionamento, meses sem dado | D18, D21, D22, D20 | |
| P13, P14 | caminhão em vários armazéns; atraso | D16, D27 | |

**Não consta nas fontes:** horários e mês exato do pico de volume; operador de máquina na norma da Agrovia; quantidade de equipamentos da Loja; medida dos "pontos de relacionamento"; se recebedor e conferente são o responsável pelo armazém; se a folha diária é a folha de ponto do RH; função do MATReser; quem lança a pendência de divergência.

## 9. Glossário condensado

- **Funcionário/ensacador:** descarrega; paga por produção com piso. **Operador:** empilhadeira ou trator; não conta como funcionário.
- **Batido** (solto, manual), **paletizado**, **big bag:** acondicionamentos. **Volume:** palete ou big bag. **Ciclo completo:** cerca de 5 min por volume.
- **Chegada, entrada, saída:** espera = chegada a entrada; descarga = entrada a saída; permanência = chegada a liberação.
- **Caso fortuito:** chuva etc.; permite reagendar sem respeitar o limite por horário (D p. 4).
- **Não recebimento:** com motivo (divergência, sem agendamento e sem vaga, caso fortuito, outro) (R p. 2).
- **Boletim, tipo de item, modalidade:** 14 tipos; descarga, remoção, transferência. **Diárias equivalentes, piso, complemento:** ver seção 5. **Efetivo do dia:** pessoas por matrícula no boletim.
- **Depósito, local físico, grupo:** ver seção 3. **Solicitação de venda:** emitida antes do embarque, raramente gera pedido (D p. 2).
- **Pontos de relacionamento:** perda ao reter adubo; a forma de medir não consta.
- **Pico/safra:** outubro a março (P3). Os meses do pico de volume não são fixados no dossiê.
