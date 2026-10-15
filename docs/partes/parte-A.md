# Parte A — Problema e operação da Agrovia

Siglas: D = Dossiê (com página), L = LEIA-ME, R = Regulamento (citado via respostas), Agrovia 03/10 = respostas-agrovia.md, P# = PREMISSA da equipe.

## 1. Resumo do problema
- Problema 1: o caminhão chega sem aviso; só ~20% dos fornecedores avisam (D p. 1). A Agrovia não sabe quantos caminhões, que carga, qual armazém, quanta gente e qual equipamento. Nada é registrado: nem chegada, nem início/fim de descarga, nem pessoas ou equipamentos (D p. 2; L).
- Problema 2: a Agrovia "não sabe se a equipe de funcionários que aloca todos os dias está sobrando ou faltando" (D p. 1). O boletim é preenchido à mão e nunca consolidado.
- Pergunta central: **sobra ou falta funcionário?** Resposta esperada por armazém, por período e em reais (R p. 3, via §8 de COLE-AQUI). Agrovia 03/10 pensa em "funcionário em excesso, funcionário faltando" (nº de pessoas); a equipe entrega número e reais (PREMISSA P1).
- Por que é o mais importante: "o custo de pessoal é a principal preocupação da direção" e hoje não há visibilidade nenhuma (D p. 1, 9). Pode haver semanas com muita gente e pouco serviço.
- Os dois problemas são faces de um: sem saber o que chega, não se dimensiona; sem registrar o que foi feito, não se sabe se acertou (D p. 1).

## 2. Processo atual e o que muda

**Hoje (D p. 2, 6–7; Agrovia 03/10)**
1. Caminhão chega sem aviso e espera fora, chamado por ordem de chegada (avisar não garante nada).
2. Portaria: o porteiro avisa e um responsável (que tem computador) vai receber. Tiram foto da nota e registram no WhatsApp o que chegou (controle interno). NF traz placa e transportadora.
3. Consulta ao SAP: existe pedido? Sim, segue. Não (fornecedor novo ou pedido esquecido), o recebedor pede confirmação ao comprador (D p. 2: "liga para Compras"). O pedido costuma ser lançado no SAP depois da NF (D p. 2).
4. Conferente confere produtos contra a NF e lança. Registro em planilha de papel; NFs digitalizadas e arquivadas. Peso vem da balança: acima de 500 kg pesa, abaixo não.
5. Descarga pelos funcionários, sem registro de horários, pessoas ou equipamento. Sobra vai para o próximo dia útil, na mesma fila. Sem multa; mas adubo/fertilizante retido custa "pontos de relacionamento" (D p. 2).
6. Boletim diário no papel, referente ao dia anterior, por armazém (D p. 7).

**Com a regra nova (D p. 3–4)**
- Agendamento obrigatório; fila por ordem de chegada deixa de existir. Com agendamento tem prioridade; sem agendamento e sem vaga, não é atendido; sem agendamento e com vaga, entra após o fornecedor agendar na hora.
- Agrovia 03/10: o agendamento é feito todo pelo fornecedor; um caminhão pode trazer mais de uma NF; sem agendamento o sistema mostra a próxima data disponível; fornecedor e armazém podem cancelar.
- Fluxo de Compras: Compras gera um link por compra, o fornecedor preenche, e a compra é confirmada.
- Divergência: a carga "geralmente recebe e resolve depois a NF com fornecedor"; entra como pendência (Agrovia 03/10; CONFLITO 4.7 com D p. 3 e R p. 2).
- Caminhão para mais de um armazém: um agendamento, uma carga; a saída é marcada em cada armazém (Agrovia 03/10; PREMISSA P13).
- Atraso: tolerância de 30 min; depois, ou se não aparecer, remarca e avisa (Agrovia 03/10; P14: próximo horário livre, que pode cair em outra data).
- Registros novos: chegada, entrada, saída, funcionários e equipamentos por descarga (D p. 3).
- O histórico descreve o mundo antigo (fila, tudo entra); a solução opera sob o mundo novo (D p. 4).

## 3. Fatos e números

**Agrovia:** fundada em 1985, Franca; ~2.200 cooperados, >40 mil ha (D p. 1). Recebimento só de segunda a sexta; sem horário de encerramento, a descarga iniciada termina no mesmo dia (D p. 7, 9). Carregamento de cooperado está fora de escopo, mas disputa os mesmos funcionários (D p. 6, 11).

**Armazéns e grupos (D p. 4–5)**
| Grupo | Local físico |
|---|---|
| FER | Pátio de Adubos |
| MAQ | Pátio de Máquinas |
| AGR | Insumos |
| PEC, ALI, MED, ACE | Loja |

Depósitos que recebem: MATLoja, MATGeral, MATFerti, MATDefe, MATMaq, secundários MATDef2, MATGer2, MATFert2. O depósito não corresponde ao local físico; o destino acompanha o grupo. MATGeral fica dentro de Insumos. MATProv e MATReser nunca recebem direto. Uma NF pode ter itens para armazéns diferentes. Boletim em 3 dos 4 armazéns, configuráveis, padrão provisório Insumos, Adubo e Pátio de Máquinas (P4).

**Equipamentos (D p. 5)**
| Local | Equipamento (qtd) |
|---|---|
| Insumos | Empilhadeira a gás (1); elétrica/retrátil (1); transpaleteira elétrica (2); paleteira elétrica (2); paleteira manual (2); carrinho de mão (2) |
| Adubo | Empilhadeira a gás (2, podem subir ao Insumos); paleteira manual (1) |
| Pátio de Máquinas | Empilhadeira a gás (1, centro de custo Logística); trator (4) |
| Loja | Carrinho de mão (qtd não consta) |

Empilhadeira serve para paletes e big bag; carga batida é manual, saco a saco. Sem regra de alocação de equipamento nem de trator por peso (D p. 6). "Sempre há empilhadeira disponível" (D p. 2).

**Norma de funcionários, lado a lado**
| Condição | Dossiê (D p. 6) | Agrovia 03/10 |
|---|---|---|
| Abaixo de 500 kg | nenhum | não consta; PREMISSA P7: nenhum |
| Batido, > 500 kg | 5 | no mínimo 5 |
| Paletizado / big bag | 2 | empilhadeira + 1 funcionário (CONFLITO 4.2) |
| Máquina/implemento | 1 operador + ao menos 1 funcionário | não consta |
| Carga mista | "não há" (CONFLITO 4.3) | pode haver; batido + outro é incomum |
| Operador de empilhadeira | não explícito | não conta como funcionário |

**Tempos de descarga: ESTIMATIVA, não medição (D p. 9–10)**
| Carga | Tempo | Recursos |
|---|---|---|
| 10 paletes | 15 min | 1 empilhadeira, 2 funcionários |
| 20 big bags | 30 min | 1 empilhadeira, 2 funcionários |
| 200 sacas 50 kg, batido | 40 min | 5 funcionários |
| 28 t a granel, batido | 50 min | 5 funcionários |
| Adubadeira/implemento | 15 a 20 min | 1 operador, ≥1 funcionário |

Big bag de 500 kg e de 1 t: mesmo tempo. Ciclo completo (tirar, transportar, guardar): ~5 min por volume (palete ou big bag), só unitizada. Tabela de tempos do PDF da especificação é ilustrativa: não usar. Permanência média: 2 h.

**Sazonalidade e mão de obra**
- Caminhões/dia: 5 a 6 normal; ~15 no pico. Volume sobe "50% ou mais" no pico (D p. 5, 9). Divergência carga × pedido: 1 a 2 vezes/mês. Falta de espaço: "nenhuma registrada" (D p. 9), mas Agrovia 03/10 diz que falta espaço por falta de agendamento (CONFLITO 4.8).
- Funcionários: ~8 em período normal; outubro a março 14 ou 15 (D p. 6). Safra = outubro a março, entressafra = abril a setembro (PREMISSA P3; Agrovia respondeu só "Safra").
- Contratação: D p. 6 diz contrato anual com reforço de terceirizados; Agrovia 03/10 diz empresa prestadora de serviço, com pedido diário na véspera (CONFLITO 4.5).
- Os funcionários circulam entre armazéns no mesmo dia (Agrovia 03/10).

**Os 3 valores de "diária" (D p. 9)**
| Valor | O que é |
|---|---|
| R$ 90,1731 | piso do boletim; **forma o custo da operação** |
| R$ 99 a R$ 113 | diária base da folha |
| R$ 180,00 | custo carregado por pessoa (DSR, férias, 13º, FGTS, INSS) |

Custo estimado = total do boletim (produção, ou piso + complemento). Encargos não entram (D p. 9).

## 4. Dados disponíveis (L)
| Arquivo | Conteúdo | Período / chave |
|---|---|---|
| 01_notas_fiscais/xml | 460 NF-e de entrada (amostra, não proporcional) | 2022–2026; chave de acesso, CNPJ |
| 01_notas_fiscais/danfe_pdf | mesmas notas em PDF | consulta visual |
| 02_cadastros/produtos.xlsx | 10.604 produtos (peso, unidade, grupo, depósito); um produto pode estar em mais de um depósito | nº do item |
| 02_cadastros/fornecedores.xlsx | 859 fornecedores | CNPJ |
| 02_cadastros/estoque_por_armazem | posição atual dos 4 armazéns | nº do item |
| 03_movimentacao/pedido_recebimento_notafiscal.xlsx | 41.779 linhas, jun/2022 a set/2026; 12.073 pedidos (mediana 2 itens, média 3,5, máx. 154); 4% vão a mais de um depósito | chave de acesso, item, depósito, data de recebimento |
| 04_mao_de_obra/chapas_por_dia_2025 e 2026.xlsx | folha diária dos ensacadores (aba/mês, quinzenas, coluna por dia); nomes trocados por CHAPA_01... | por data |
| 04_mao_de_obra/chapas_por_dia.csv | uma linha por data: dia da semana, presentes, "operação de café", valor pago | por data |
| 05_operacao | equipamentos_descarga.xlsx; registro_manual_recebimento.pdf (~200 lançamentos, abr–jul/2026); formulário em branco; boletim_diario_chapas.xlsx (1 dia: Adubo, 17/11/2025) | |
| 06_especificacao | PDF da visão original (prevalece o dossiê); mapa_relacoes_sap.jpeg | |

**Destaques (L, Agrovia 03/10)**
- A folha **não indica armazém** (hoje nem é anotado; "seria interessante").
- O CSV conta a **"operação de café"** à parte; fica fora do efetivo dos armazéns, separada no painel (P9).
- **Agosto e dezembro de 2025 não têm folha**; sem interpolação, fora das médias (P12).
- A movimentação só tem **compras**, e **cada linha é um item de pedido**, não um caminhão nem uma NF. Caminhão histórico = notas do mesmo fornecedor na mesma data (aproximação, P10).
- Código do item na planilha é o da Agrovia; no XML é o do fornecedor (1 em 838 casa).
- Acondicionamento histórico: espécie declarada no XML, só quando existir (P11). Pesos e espécie vêm do fornecedor.
- Registros de saída (cooperados) e transferências **existem na Agrovia, mas não foram fornecidos**.
- **Nunca registrado:** horário de chegada, início/fim de descarga, pessoas por recebimento, equipamento usado. Só há 1 boletim (Agrovia 03/10); custo histórico é estimativa declarada (P2).
- Dados sem limpeza; tratar faz parte da avaliação. Não colocar os originais no repositório.

## 5. Boletim e regra do piso (sem recomendar)
Produção = soma de (descarga + remoção + transferência) × preço unitário de cada tipo de item (D p. 7).

| Tipo | Preço |
|---|---|
| Sacaria malas c/ 25 | R$ 0,1824 |
| Sacaria malas c/ 40 | R$ 0,2635 |
| Sacaria malas c/ 50 | R$ 0,3224 |
| Sacaria fardo c/ 250 | R$ 1,1780 |
| Sacaria fardo c/ 500 | R$ 2,3561 |
| Peças | R$ 0,3387 |
| Medicamentos | R$ 0,3387 |
| Alimentação animal | R$ 0,3387 |
| Máquinas / equipamentos | R$ 0,3224 |
| Agroquímico | R$ 0,3224 |
| Fertilizantes | R$ 0,3224 |
| Sementes | R$ 0,3224 |
| Acessórios agropecuários | R$ 0,3224 |
| Serviços diversos | R$ 0,3224 |
| Diária completa | R$ 90,1731 |
| Meia diária | R$ 45,0786 |

```
diárias equivalentes = nº de chapas − 0,5 para cada meia diária
valor por diária     = produção total ÷ diárias equivalentes
se valor por diária < R$ 90,1731:
    total a pagar = R$ 90,1731 × diárias equivalentes
    complemento   = total a pagar − produção total
senão:
    total a pagar = produção total
    complemento   = 0
```
Sem teto. Até 20 funcionários por boletim, por matrícula; cada funcionário em um único boletim por dia (Agrovia 03/10). Arredondamento: "É aquele valor fixo, não arredonda."

**Exemplo D p. 8–9 (Adubo, 17/11/2025):** 2.778 fertilizante + 30 agroquímico + 40 serviços diversos = 2.848 × R$ 0,3224 = R$ 918,20; 11 funcionários, 11 diárias equivalentes; R$ 83,47 por diária; paga R$ 991,90; complemento R$ 73,71. Variação com 1 meia diária: 10,5 equivalentes; R$ 87,45 por diária; total R$ 946,82; complemento R$ 28,62.

**Conflito 4.1 (valor da diária):** Agrovia diz meia fixa de R$ 45,0786 e completa o dobro (R$ 90,1572), sem arredondar. O dossiê dá R$ 90,1731 e a meia valendo 0,5 no cálculo. Com 90,1572 o caso base dá R$ 991,73 e complemento R$ 73,53; com 90,1731 e meia de 45,0786 a variação dá R$ 946,81 e R$ 28,61. Só 0,5 × 90,1731 fecha os números do dossiê. A banca confere contra o exemplo (R p. 2). Ação pendente: conferir as fórmulas do xlsx. Decisão e casos de teste: parte B.

Modalidades (CONFLITO 4.4): Agrovia: remoção = mover dentro do armazém; transferência = envio aos núcleos filiais. Dossiê: as três cobrem descarregar, carregar cooperado e mover entre armazéns. "Mala" e "fardo" sem resposta (P6).

## 6. Usuários e papéis
| Papel | Relação / uso |
|---|---|
| Porteiro | avisa a chegada (Agrovia 03/10) |
| Responsável pelo armazém | tem computador; valida a autorização de Compras, define destino, registra marcos, funcionários, equipamentos; preenche o boletim (D p. 3, 7). Se é o mesmo que recebedor/conferente: não consta |
| Compras | valida NF × pedido; decide em divergência; gera o link da compra |
| Fornecedor | agenda, anexa NF, informa acondicionamento |
| Funcionários | não usam o sistema; o responsável os lança; pagos por produção com piso |
| Prestador de serviço | recebe na véspera o nº de colaboradores (Agrovia 03/10) |
| Direção | usa o painel; faz a pergunta central |
| RH | folha de ponto é o registro oficial (D p. 8) |

**Dores declaradas:** chegada sem aviso; dia por reação; nada medido; custo de pessoal invisível; boletim em papel nunca consolidado; avisar não adianta; adubo retido custa relacionamento (D p. 1–2). Agrovia 03/10: adubo e chuva (adubo não pode tomar chuva), faltar espaço e remanejar mercadoria, pessoas da terceirizada, clima, tipo de carga, almoço, não saber o que chega.

**Não é problema (D p. 2, 9):** escassez de recursos (reorganizam com quem há; sempre há empilhadeira); custo direto da postergação (sem multa nem diária); espaço (nenhuma ocorrência registrada, ver CONFLITO 4.8).

**Sucesso para o cliente:** passar a medir a operação (D p. 1); resposta à direção por armazém, por período, em reais, sustentada por números da própria operação (R p. 3). [SUPOSIÇÃO] Sair da demo sabendo onde e quando sobra ou falta funcionário, em números que a direção reconheça, e usar agenda e boletim já no pico de outubro a março.

## 7. Armadilhas
1. Funcionários por descarga **não somam** no dia (mesma equipe atende várias); efetivo do dia vem do boletim por matrícula (D p. 4).
2. O boletim cobre toda a movimentação, não só recebimento; custo = o que se gasta com a equipe no dia (D p. 7). Dados históricos são só de compras.
3. Três valores de diária; usar o total do boletim, sem encargos (D p. 9).
4. Código de produto da NF é do fornecedor; o pedido usa o da Agrovia (D p. 3; L).
5. Depósito ≠ local físico; MATGeral mistura grupos; limite de horários vale para a cooperativa inteira (D p. 3, 5).
6. Tempos são estimativas; ciclo de 5 min vale só para unitizada; descarga iniciada não é interrompida (D p. 9–10).
7. A folha não tem armazém; agosto/dezembro de 2025 sem dados; CSV inclui café.
8. O histórico reflete fila, a solução opera com agendamento obrigatório.
9. 460 XMLs são amostra, para formato, não volume (D p. 11).
10. Dados sujos; não incluir originais no repositório (L).
11. Meia diária conta 0,5; ignorá-la distorce pago e complemento (D p. 8).

## 8. Glossário condensado
- **Funcionário/ensacador:** descarrega; paga por produção com piso. **Operador:** empilhadeira/trator, não conta como funcionário (Agrovia 03/10).
- **Batido** (solto, manual) / **Paletizado** / **Big bag:** acondicionamentos; um tipo por caminhão no dossiê.
- **Volume:** palete ou big bag (D p. 10). **Ciclo completo:** ~5 min por volume.
- **Chegada/Entrada/Saída:** espera = chegada→entrada; descarga = entrada→saída. **Permanência:** chegada→liberação.
- **Caso fortuito:** chuva etc.; permite reagendar sem respeitar o limite por horário (D p. 4).
- **Não recebimento:** com motivo (divergência, sem agendamento e sem vaga, caso fortuito, outro) (R p. 2).
- **Boletim / tipo de item / modalidade:** 14 tipos; descarga, remoção, transferência.
- **Diárias equivalentes, piso, complemento:** ver §5. **Efetivo do dia:** pessoas por matrícula no boletim.
- **Depósito × local físico × grupo:** ver §3. **Solicitação de venda:** emitida antes do embarque, raramente gera pedido (D p. 2).
- **Pontos de relacionamento:** perda ao reter adubo; forma de medir não consta.
- **Pico/Safra:** outubro a março (PREMISSA P3). Os meses do pico de volume não são fixados no D.

## 9. Ideias (ideias.md) pelo ângulo do cliente
| Grupo | Dor atacada | O que a Agrovia disse |
|---|---|---|
| 1 Ajustes do MVP | chegada sem aviso, divergência, falta de registro | pediu todos (link, várias NFs, cancelar, 30 min, próxima data, saída por armazém, cadastro, tela do dia, registro no celular) |
| 2 Alto valor | dimensionamento de funcionários e equipamentos; aviso ao prestador; alerta de falta | pediu dimensionar e alertar (3.2, origem a confirmar); prioridade a defensivos/fertilizantes em conflito 4.6 com R p. 1 |
| 3 Diferenciais (leitura de NF, linguagem natural) | digitação e consulta | fotografar a NF e preencher: "discutido" (origem a confirmar); linguagem natural: não consta |
| 4 Portaria e câmera | conferência da NF, controle do motorista | câmera foi a ideia de que "mais gostaram"; já têm câmera e aceitam melhor; querem histórico do motorista |
| 5 Mobilidade e notificações | registro na descarga, aviso aos responsáveis | quer app do funcionário (cronômetro, peso, colaboradores, carga, placa); relógios: não consta |
| 6 Agenda e operação | chuva em adubo, almoço, atraso | pediu previsão do tempo e almoço; grade "não é regra fixa"; atraso por e-mail/WhatsApp: origem a confirmar |

## 10. Riscos da stack pelo ângulo da operação (stack decidida, sem alternativa)
- better-sqlite3 pode falhar a instalar no Windows e travar a demo: instalar e testar cedo no passo 0; plano B já previsto (node:sqlite).
- Sem internet garantida no anfiteatro: previsão do tempo e leitura de e-mail/WhatsApp precisam de fallback e dados seed.
- Dados reais sujos: importar com validação (zod) e declarar o que foi descartado; sem pandas em tempo de execução.
- Dinheiro em decimal.js (texto decimal): essencial para a diária de 4 casas e o piso; testar contra o exemplo de 17/11/2025.
- Tela de descarga precisa funcionar no celular; web responsivo cobre o uso, e o responsável já tem computador.
- Sem migrations nem instalações na fase paralela: o schema de boletim e agendamento precisa estar fechado no passo 0.
- Seed e modo demo são dados simulados: rotular para não parecerem histórico real.

## 11. Pendências para a consolidação
- Conflitos abertos: 4.1 diária (conferir o xlsx), 4.2 funcionários por palete/big bag, 4.3 carga mista, 4.4 modalidades, 4.5 contratação, 4.6 grade e prioridade, 4.7 divergência, 4.8 espaço, 4.9 boletim em 3 ou 4 armazéns.
- Premissas a confirmar com a Agrovia: P3 (meses da safra), P4 (3 locais com boletim).
- Não consta: horários e mês exato do pico de volume; operador de máquina na norma da Agrovia; quantidade de equipamentos da Loja; significado de "mala" e "fardo"; medida dos "pontos de relacionamento"; se recebedor/conferente = responsável pelo armazém; se a folha diária = folha de ponto do RH; MATReser.
- Dúvidas: custo histórico sem boletins (P2); tratamento do pessoal do café nos armazéns; quem lança a pendência de divergência.

STATUS: feito
