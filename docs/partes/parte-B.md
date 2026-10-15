# Parte B: produto e regras de negócio (Tarefas 1, 2 e 3)

Fontes: R = Regulamento, D = Dossiê, L = LEIA-ME, Agrovia = respostas-agrovia.md (03/10; "r." = resposta), P = premissa. Aspas = literal. [SUPOSIÇÃO] e "cálculo meu" = dedução minha. Transversal: mockup não atende nenhuma tarefa (R p. 2); tudo é gravado e recuperado.

## 1. Tarefa 1: agendamento (eliminatória, 15%)

### 1.1 Especificações mínimas (R p. 1–2), uma por RF
- RF1-01 O fornecedor acessa a plataforma e anexa o arquivo da nota fiscal (R p. 1). Formato XML [SUPOSIÇÃO]; PDF não consta.
- RF1-02 O fornecedor informa o acondicionamento: batido, paletizado ou big bag (R p. 1). D p. 6: um tipo por caminhão; Agrovia diz que pode haver mais (CONFLITO 4.3).
- RF1-03 O fornecedor escolhe data e horário entre os quatro disponíveis (R p. 1): 08h00, 10h00, 13h00, 15h00 (D p. 3).
- RF1-04 A regra de ocupação de horário é respeitada (R p. 1); ver 1.3.
- RF1-05 Compras valida a conformidade entre NF e pedido (R p. 1).
- RF1-06 O responsável pelo armazém verifica a autorização de Compras (R p. 1).
- RF1-07 O responsável informa o armazém de descarga, "podendo ser mais de um" (R p. 1).
- RF1-08 Hora de chegada: "quando encosta e entra na fila" (R p. 1).
- RF1-09 Hora de entrada: "quando é liberado e inicia a descarga" (R p. 1).
- RF1-10 Hora de saída: "quando a descarga termina" (R p. 1).
- RF1-11 Ao finalizar a descarga, registra quantos funcionários atuaram (R p. 1). Não é somável no dia (R p. 1; D p. 4); o efetivo do dia vem do boletim.
- RF1-12 Ao finalizar, registra quais equipamentos foram usados (R p. 1).
- RF1-13 Reagendar por caso fortuito de natureza (R p. 2); o armazém altera a data e "o limite máximo de caminhões por horário pode ser desconsiderado" (D p. 4, só Dossiê).
- RF1-14 Cancelar um agendamento (R p. 2).
- RF1-15 Vaga liberada por cancelamento: o responsável pelo armazém define quem a ocupa (R p. 2).
- RF1-16 Registrar não recebimento com motivo (R p. 2), um destes: divergência entre nota e pedido; chegada sem agendamento e sem vaga; caso fortuito; outro, descrito pelo responsável.

### 1.2 Ajustes vindos das respostas e de ideias.md grupo 1
- RF1-17 Link de Compras por compra; o fornecedor agenda por ele e a compra é confirmada (Agrovia 3.1). Agendamento todo do fornecedor (r. 14).
- RF1-18 Mais de uma NF por agendamento (r. 14).
- RF1-19 Cancelamento pelo fornecedor e pelo armazém (r. 13).
- RF1-20 Tolerância de 30 min; depois, ou se não aparecer, remarcar para o próximo horário livre (pode ser outra data), com aviso (r. 12; PREMISSA P14).
- RF1-21 Sem agendamento: mostrar a próxima data disponível (3.1).
- RF1-22 Uma chegada por caminhão; entrada e saída por armazém; liberado na última saída (P13). É um agendamento e uma carga (r. 11). Altera RF1-09 e RF1-10.
- RF1-23 Pendência por divergência: a carga entra e fica pendente (r. 10; CONFLITO 4.7 com R p. 2 e D p. 3, decisão do Claude D).
- RF1-24 Tela do dia: em descarga, há quanto tempo, início e previsão de término (3.1); registro no celular com cronômetro, peso, colaboradores, carga e placa (ideias.md 1).
- RF1-25 Cadastro de armazéns (Insumos, Adubo, Pátio de Máquinas, Loja, D p. 4) com marcação dos que fazem boletim (P4).
- RF1-26 Peso da balança; acima de 500 kg a carga é pesada (r. 17; P15).

### 1.3 Só no Dossiê (fora da lista mínima, R p. 7)
- Ninguém descarrega sem agendamento; agendado tem prioridade; sem agendamento e sem vaga, não é atendido; havendo vaga, só entra após agendar "na hora" (D p. 4).
- Sem recebimento aos sábados nem feriados (D p. 7; P5); feriados não constam.
- Agrovia: a grade "não é regra fixa" e carga prioritária pode passar do limite (CONFLITO 4.6). R p. 1 exige respeitar a regra: implementar a do Dossiê; a exceção fica com o Claude D.

### 1.4 Regra de ocupação
"Se o horário receber um caminhão de carga batida, fica reservado somente para esse caminhão. Se não houver carga batida no horário, podem ser agendados até dois caminhões, paletizados ou big bag." (D p. 3). O limite vale para a cooperativa inteira (D p. 3). Cancelados e remarcados deixam de contar [SUPOSIÇÃO]. Capacidade do dia = 8 − nº de batidos, entre 4 e 8 (cálculo meu); demanda: 5 a 6 por dia, cerca de 15 no pico (D p. 9).

### 1.5 Estados do agendamento [SUPOSIÇÃO]
criado (link de Compras) → agendado → validado por Compras → destino definido → chegou → em descarga (por armazém) → saída (por armazém) → concluído.
Desvios: cancelado (fornecedor ou armazém); remarcado (caso fortuito, atraso > 30 min ou ausência); não recebido (4 motivos); recebido com pendência (divergência). Reprovação de Compras e validação pendente na chegada não constam.

## 2. Tarefa 2: boletim diário (25%)

### 2.1 Requisitos
- RF2-01 Produção do dia: por tipo de item, quantidades em descarga, remoção e transferência (R p. 2); linha = soma das três × preço; o operador escolhe a linha (D p. 7; P6: 14 tipos, sem interpretar "mala" e "fardo").
- RF2-02 Remoção = mover dentro do armazém; transferência = envio aos núcleos filiais (Agrovia r. 15; CONFLITO 4.4 com D p. 7).
- RF2-03 Equipe por matrícula, completa ou meia (R p. 2); até 20 funcionários, nome do cadastro (D p. 8), identificador CHAPA_nn (L).
- RF2-04 Valor produzido calculado pela tabela de preços (R p. 2).
- RF2-05 Regra do piso e complemento de diária (R p. 2); sem teto (D p. 8).
- RF2-06 Um boletim por armazém por dia (R p. 2); só 3 locais fazem boletim, configuráveis, padrão provisório Insumos, Adubo e Pátio de Máquinas (P4); cada funcionário em um único boletim por dia (Agrovia r. 15).
- RF2-07 Sem arredondar no cálculo: "É aquele valor fixo, não arredonda" (Agrovia r. 4); 2 casas só na exibição [SUPOSIÇÃO].
- RF2-08 Aceita qualquer dia, inclusive sábado (P5); refere-se ao dia anterior (R p. 2).
- RF2-09 Boletim sem funcionários (divisão por zero) e correção de boletim lançado não constam; bloquear o primeiro [SUPOSIÇÃO].

### 2.2 Preços unitários (D p. 7–8, literal)
Sacaria malas c/ 25 R$ 0,1824 · malas c/ 40 R$ 0,2635 · malas c/ 50 R$ 0,3224 · fardo c/ 250 R$ 1,1780 · fardo c/ 500 R$ 2,3561 · Peças R$ 0,3387 · Máquinas / equipamentos R$ 0,3224 · Agroquímico R$ 0,3224 · Fertilizantes R$ 0,3224 · Sementes R$ 0,3224 · Medicamentos R$ 0,3387 · Alimentação animal R$ 0,3387 · Acessórios agropecuários R$ 0,3224 · Serviços diversos R$ 0,3224. Diária completa R$ 90,1731; meia R$ 45,0786 (D p. 8; ver 2.4).

### 2.3 Fórmula (D p. 8, literal)
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

### 2.4 Casos de teste (dono: Claude B)
Produção do caso base: 2.778 fertilizante + 30 agroquímico + 40 serviços diversos = 2.848 × 0,3224 = R$ 918,1952 (exibe 918,20).

| Caso | Entrada | Esperado (D p. 8–9) | Origem |
|---|---|---|---|
| T1 base | 2.848 un.; 11 funcionários completas = 11 diárias | produção 918,20; valor/diária 83,47; total 991,90; complemento 73,71 | D |
| T2 variação | mesma produção; 10 completas + 1 meia = 10,5 diárias | valor/diária 87,45; total 946,82; complemento 28,62 | D |
| T3 acima do piso | 4.000 un. de Fertilizantes × 0,3224 = 1.289,60; 11 diárias | valor/diária 117,236… ≥ 90,1731; total 1.289,60; complemento 0 | derivado (cálculo meu) |

Sem arredondar (cálculo meu): T1 991,9041 / 73,7089; T2 946,81755 / 28,62235.

Valor da diária, três leituras:

| Leitura | Completa / meia | T1 | T2 | Reproduz |
|---|---|---|---|---|
| A. Dossiê (fórmula) | 90,1731 / 0,5 × 90,1731 (45,08655) | 991,90 / 73,71 | 946,82 / 28,62 | T1 e T2 |
| B. Completa do dossiê, meia fixa | 90,1731 / 45,0786 | 991,90 / 73,71 | 946,81 / 28,61 | só T1 |
| C. Literal da Agrovia | 90,1572 / 45,0786 | 991,73 / 73,53 | 946,65 / 28,46 (cálculo meu) | nenhum |

Decisão: PENDENTE até a conferência das fórmulas de boletim_diario_chapas.xlsx (respostas-agrovia.md, seção 6). Só a leitura A passa nos casos do dossiê, que a banca confere (R p. 2). Parametrizar piso e meia diária em um ponto.

## 3. Tarefa 3: painel gerencial (30%)

### 3.1 Pergunta central
"A quantidade de funcionários alocada está sobrando ou faltando?" (R p. 3). RF3-00: o painel entrega uma resposta, não um gráfico; por armazém e por período; em reais e em número de funcionários (PREMISSA P1; Agrovia 03/10, r. 1: "Funcionário em excesso, funcionário faltando"). Período: safra (out–mar, 14–15 funcionários) × entressafra (abr–set, 8 funcionários) (P3; D p. 6). "Operação de café" fica fora da conta e aparece separada (P9). Agosto e dezembro de 2025: sem dado, sem interpolação, fora das médias (P12; L). Custo: total do boletim; sem R$ 99–113 nem R$ 180 (D p. 9).
Definição operacional [SUPOSIÇÃO]: necessário = norma por carga (batido ≥ 5; palete e big bag = empilhadeira + 1 funcionário; operador não conta; abaixo de 500 kg, nenhum, P7; Agrovia 03/10, r. 16); sobra/falta = efetivo − necessário. Em reais, o complemento de diária mede a ociosidade; para a falta não há medida no texto.

### 3.2 Indicadores e fonte

| RF | Indicador (R p. 3) | Fonte no histórico (L) |
|---|---|---|
| RF3-01 | Cargas por dia e armazém | pedido_recebimento_notafiscal.xlsx: data do recebimento, NF, fornecedor, depósito. Caminhão = notas do fornecedor na mesma data (P10); armazém pelo grupo (P4). |
| RF3-02 | Espera média (chegada→entrada) | Só com registros novos ou de teste, com origem declarada (L: nunca registrado). |
| RF3-03 | Descarga média (entrada→saída) | Idem. A tabela de tempos da especificação é ilustrativa (D p. 10). |
| RF3-04 | Colaboradores por recebimento | Idem; o histórico só tem o efetivo por dia (chapas_por_dia.csv). |
| RF3-05 | Utilização dos locais de descarga | Idem. Conta só a carga, sem equipamentos (Agrovia r. 18). |
| RF3-06 | Fornecedores com maior volume | Planilha de movimentação: peso e fornecedor (CNPJ → fornecedores.xlsx). Volume = peso (Agrovia r. 18). |
| RF3-07 | Horários e dias de maior movimento | Dias: data de recebimento. Horários: só registros novos ou de teste. |
| RF3-08 | Não recebimentos, por motivo | Só registros novos ou de teste. |
| RF3-09 | Custo estimado (só funcionários) | Boletim (único exemplo, 17/11/2025). Histórico: estimativa declarada (P2) com chapas_por_dia.csv (pessoas e valor pago no dia). |

Efetivo por armazém: o histórico não tem (Agrovia r. 3); só registros novos, via boletim (RF2-06). 

## 4. Requisitos implícitos [SUPOSIÇÃO]
- Quatro papéis (fornecedor, Compras, armazém, direção), sem autenticação robusta.
- Campo de origem (histórico / teste / operação) em todo registro; seed e modo demo.
- Agendamento sem pedido lançado é aceito: o pedido vem depois da NF (D p. 2).
- Modelo com 1 agendamento : N NFs e 1 caminhão : N armazéns.
- Boletim e Tarefa 1 não precisam bater entre si (D p. 3–4).

## 5. Decisões pendentes
**Resolvidas:** sobra/falta em funcionários e reais (r. 1; P1); só o boletim de exemplo (r. 2; P2); 3 locais, funcionário única, sem arredondar (r. 4, 15); safra (r. 7; P3); vários armazéns (r. 11); tolerância e cancelamento (r. 12, 13); volume = peso (r. 18); nomes de fornecedor (r. 19).
**Em aberto:**
- Valor da diária (2.4): boletins com meia diária e conferência da banca.
- Quais são os 3 locais (P4).
- Divergência: pendência ou não recebimento (4.7): RF3-08.
- Grade fixa × prioridade (4.6): RF1-04. Carga mista (4.3): acondicionamento e ocupação.
- Norma de funcionários (4.2): Agrovia prevalece sobre D p. 6 em RF3-00 [SUPOSIÇÃO]; batida de exatos 500 kg não consta.
- "Falta" sem medida (D) e custo histórico sem boletins (P2): a resposta no histórico é estimativa declarada.

## 6. Perguntas que ainda valem a pena
1. Quais são os 3 locais com boletim? Muda: cadastro padrão (P4), custo por armazém, RF2-06.
2. Quais meses formam a safra? Muda: cortes e médias de RF3-00 (P3).
3. Divergência: entra pendente ou Compras barra antes? Muda: fluxo, estados, RF3-08.
4. Defensivos e fertilizantes podem exceder o limite do horário? Muda: RF1-04 e a conformidade com R p. 1 (comissão).
5. Cooperados e transferências entram no custo do boletim? Muda: RF3-09 (registros não fornecidos, r. 8).

## 7. Viabilidade técnica dos grupos 2 a 6 de ideias.md
Esforço P ≤ 2h, M ≤ 4h, G > 4h [SUPOSIÇÃO].
- **Grupo 2** (M): dimensionar pela norma, aviso ao prestador, alerta de falta; precisa de norma em tabela, peso e cadastro de equipamentos (RF1-02, RF1-12, RF1-26, RF3-00). Prioridade depende do 4.6.
- **Grupo 3**: leitura do XML da NF (P; o código de item do XML é do fornecedor, L); consulta em linguagem natural (M; timeout, fallback e dados mascarados).
- **Grupo 4**: código de barras do DANFE por webcam (M; chave de 44 dígitos, L; leitor no navegador [SUPOSIÇÃO]); placa por OCR (G); histórico do motorista (P). Liga a RF1-01, RF1-05, RF1-08.
- **Grupo 5**: app Expo (G) e notificação de chegada (M; RF1-08, RF1-24). Expo: push remoto "is unavailable in Expo Go on Android from SDK 53" (development build); notificações locais seguem; iOS sem restrição citada. Push exige internet [SUPOSIÇÃO]. Garmin (manual oficial): o que está ativo no celular vai ao relógio. Apple Watch: não confirmado; espelhar o iPhone é [SUPOSIÇÃO]. Na demo, a tela do dia com polling é o caminho principal.
- **Grupo 6** (P, exceto grades M): previsão do tempo com fallback; atraso manual (leitura de e-mail ou WhatsApp é G); grades alternativas sobre a movimentação (histórico segue a regra antiga, D p. 4); almoço, equipamento indisponível, relatório de chegadas.

## 8. Riscos da stack (ângulo do produto)
- better-sqlite3 pode falhar no Windows: validar no passo 0 (alternativa node:sqlite); sem banco não há persistência (R p. 2).
- Três sessões na mesma pasta: cada módulo edita só seus diretórios; schema e lib/money.ts têm dono único e tabela nova vira pedido em docs/pedidos/.
- Piso e meia diária em ponto único (lib/boletim), com decimal.js e Vitest em T1 a T3.
- Demo com next build/start e seed local, sem rede.

## 9. Pendências para a consolidação (Claude D)
- Fechar a diária (2.4) após conferir as fórmulas da planilha; atualizar T1 e T2.
- Decidir CONFLITOS 4.2, 4.3, 4.6, 4.7 e os 3 locais (P4).
- Registrar em DECISOES.md o custo histórico (P2) e a definição de sobra/falta (3.1).
- Conferir com as partes A e C: carga mista e tempos (D p. 6, 9–10); se as regras só do Dossiê contam para a Tarefa 1 (R p. 7).

STATUS: feito
