# Parte C: avaliação, evento, entregáveis, restrições e riscos

Fontes: R = Regulamento · L = LEIA-ME · D = Dossiê · Agrovia 03/10 = respostas-agrovia.md · P# = PREMISSA da equipe. [SUPOSIÇÃO] = dedução minha. "Não consta" = não está nas fontes.

## 1. Critérios de avaliação (R p. 7)
- **Pesos:** T1 agendamento 15% (eliminatória) · T2 boletim 25% · T3 painel 30% · Agrovia 30%.
- **Onde está o peso:** "As Tarefas 2 e 3 concentram o peso" (R p. 3) = 55%. A pergunta dos funcionários pesa duas vezes: é o centro da T3 (30%) e o "sobretudo" da Agrovia (30%).
- **Eliminatórios:** T1 em funcionamento "com dados efetivamente persistidos" e todos os artefatos. T1 funciona quando todos os itens mínimos são demonstráveis "de ponta a ponta, com dados gravados e recuperados".
- **Desempate, em ordem:** T3; T2; cliente; criatividade e inovação.
- **Comissão técnica (sem peso por item):** correção do boletim (piso e complemento); tratamento dos dados; engenharia; criatividade; domínio técnico no pitch.
- **Agrovia (sem peso por item):** aderência; plausibilidade operacional; utilidade; sobretudo a resposta sobre os funcionários.
- **O que a Agrovia quer ver** (Agrovia 03/10): o não agendamento atrapalha o armazenamento (#6); sobra/falta como "funcionário em excesso, funcionário faltando" (#1), ou seja, pessoas (P1), mais reais (R p. 3); câmera (preferida); validar a NF antes da entrada; tela do dia; próxima data disponível (§3.1).
- **Não consta:** pesos internos; definição de "comissão técnica"; tamanho da penalização por ausência no pitch (R p. 6).

## 2. Cronograma operacional
| Quando | Marco | Fonte |
|---|---|---|
| Sáb 08h00 | Abertura, presença obrigatória de todos; cronômetro corre | R p. 4–5 |
| Sáb ~09h00 [SUPOSIÇÃO] | Link do repo à comissão ("até 1 hora"), acesso a dfpires@gmail.com | R p. 6 |
| 10h–12h / 15h–17h | Agrovia nas mesas / por demanda (acaba às 17h) | R p. 4 |
| Sáb à tarde | Sorteio da ordem do pitch (horário não consta) | R p. 6 |
| 18h | 1ª atualização obrigatória; depois a cada 2h: 20h, 22h, 00h, 02h, 04h, 06h [SUPOSIÇÃO: horários deduzidos] | R p. 4, 6 |
| Sáb ~20h | Corte de escopo (~12h após T0) | CLAUDE.md |
| Dom 03h [SUPOSIÇÃO: fim = 08h] | Congelamento interno, só bugfix ("5h antes do fim") | CLAUDE.md |
| Dom 07h00 | Repo congelado; artefatos já commitados [SUPOSIÇÃO] | R p. 6 |
| Dom 08h00 | Pitches no anfiteatro (térreo, Unidade II): 8 min, demo ao vivo | R p. 5–7 |
| Dom ~11h | Resultado e premiação (previsto) | R p. 5 |
| Fim | Apagar as cópias dos dados | R p. 8 |

**Conflitos com o CLAUDE.md:**
1. "24h" são 23h: de sáb 08h ao congelamento de dom 07h (cálculo meu, D §2).
2. Congelamento interno (03h) × oficial (07h): o interno é mais rígido. Mas o relatório depende dos números finais da T3: com o "só bugfix" às 03h, eles e os diagramas precisam estar prontos antes. Se "fim" for 11h, cai às 06h; D deve alinhar.
3. Corte às 20h, Agrovia só até 17h: decisões que dependem do cliente (P3, P4, diária) devem fechar até 17h.
4. Integração a cada ~90 min × commit a cada 2h: compatíveis; o push da madrugada continua obrigatório.
5. O pitch pode cair às 08h: build e banco de demo prontos antes das 07h. R não separa tempo de demo dos 8 min.

## 3. Checklist dos entregáveis eliminatórios
Regra comum: em **/docs**, "em texto e imagem", "visíveis diretamente na página do GitHub", disponíveis no pitch; ausência de qualquer um é eliminatória (R p. 6). Prazo: dom 07h.

| Entregável | Exigência | Formato proposto [SUPOSIÇÃO] |
|---|---|---|
| Relatório gerencial | Resposta da T3, números, método, tratamento das inconsistências; origem de cada informação (R p. 3) | `docs/relatorio.md` + PNG dos gráficos |
| Caso de uso UML | Casos de uso e interações | PNG + fonte em texto |
| BPMN | Processo de negócio **proposto** | PNG + fonte |
| DER | Modelo de dados da solução | Mermaid `erDiagram` (renderiza no GitHub) + PNG |
| Tarefa 1 | Módulo funcional, dados persistidos; mockup não vale (R p. 1–2) | Código + demo ao vivo |
| Repositório | Link em 1h; commits a cada 2h desde as 18h | GitHub; público ou privado não consta |

**O relatório deve declarar as premissas da equipe** (P1–P15) e os conflitos adotados (Agrovia × D × R). Tamanho, notação e nível do DER, e BPMN do processo atual: não constam.

## 4. Restrições em regras práticas
- **Dados:** não commitar os arquivos originais (R p. 8; L), **inclusive o LEIA-ME**; scripts leem de PACOTE_DIR (.env, fora do git). Não publicar nem compartilhar. Apagar as cópias no fim (R p. 8).
- **Fornecedores no pitch:** autorizado, "Pode sim, sem problemas" (Agrovia 03/10 #19). Dado derivado no repo: não consta.
- **Dúvidas sobre dados** vão à comissão, que responde a todos (L; R p. 4, 6).
- **IA:** permitida e esperada; a equipe responde por tudo e deve saber explicar e defender código, arquitetura e conclusões (R p. 3–4). Enviar dados a IA de desenvolvimento é permitido (R p. 8); na demo, mascarar pessoais (CLAUDE.md). Declarar uso de IA: não consta.
- **Demo:** ao vivo, no computador da equipe, sem vídeo; APIs externas são naturais (R p. 7).
- **Não avaliados:** design visual, responsividade, autenticação robusta, perfis e permissões, preocupação de produção (R p. 2); o alcance para T2 e T3 é ambíguo.
- **Presença:** 1 pessoa sempre no local; todos no pitch; camiseta (R p. 6). Wi-Fi e tomadas não constam.

## 5. Riscos reordenados (uma mitigação cada)
| # | Risco | Mitigação |
|---|---|---|
| 1 | **T1 incompleta ou sem persistência (eliminatório)** | T1 ponta a ponta primeiro; ensaiar reiniciando o servidor para provar o dado recuperado |
| 2 | **Artefatos no fim (eliminatório)** | Esqueleto dos 4 em /docs até 20h; relatório preenchido pelo painel antes de 03h |
| 3 | **Demo cai** (rede, montagem, pitch às 08h) | Modo demo offline com seed; chamadas externas com timeout e fallback; ensaio de 8 min |
| 4 | **Sobra/falta:** pessoas (Agrovia #1) × reais (R p. 3) | P1: painel com os dois lado a lado e método declarado |
| 5 | **Diária** (CONFLITO 4.1): Agrovia R$ 45,0786 / 90,1572 × D R$ 90,1731; os testes do dossiê só fecham com 0,5 × 90,1731 | Parâmetro único e testes Vitest contra R$ 991,90 / 73,71 e 946,82 / 28,62; decisão do Claude D |
| 6 | **Grade × ocupação** (4.6): R p. 1 manda respeitar, Agrovia diz "não é regra fixa"; pico ~15 × 8/dia (cálculo meu) | Aplicar a regra de R e mostrar a recusa; prioridade só como override explícito, se D aprovar |
| 7 | **Carga mista e norma de funcionários** (4.2, 4.3): D "não há carga mista"; 500 kg exatos indefinido (P7) | Norma em um módulo com testes (incl. 500 kg); premissa declarada |
| 8 | **Boletim:** 3 locais (Agrovia) × 1 por armazém, 4 armazéns (R p. 2) (4.9) | P4: flag "faz boletim" no cadastro; reconfirmar até 17h |
| 9 | **Código do XML ≠ catálogo** (L: 1 de 838 casa) | Ligar por chave de acesso, CNPJ e nº do item, como o L descreve |
| 10 | **Indicadores de tempo vazios** (L: horários nunca registrados) | Seed de teste marcado como tal, origem declarada (R p. 3) |
| 11 | **Ago e dez/2025 sem dado** (L) | P12: fora das médias, sem interpolação, declarado |
| 12 | **Dado original no repo** (docs/ sem rastreio; docs/contexto tem o LEIA-ME) | `.gitignore` de docs/contexto e PACOTE_DIR; `git status` antes de cada push |
| 13 | **Escopo crescendo** (T1 15%; diferenciais sem peso) | Cortar às 20h os grupos 2–6 não prontos |
| 14 | **Defender código gerado por IA** | Cada módulo com dono que o explica |
| 15 | **Pouco tempo com o cliente** | Perguntas fechadas antes das 15h: P3, P4, diária |

## 6. Lacunas e contradições
**Dados (§12.5), com o que L e Agrovia resolveram:**
- O L descreve os campos da planilha de movimentação (pedido, datas, fornecedor, item, quantidade, peso, depósito, recebimento, NF, chave). Horário não existe (L); acondicionamento na planilha não consta; a espécie vem no XML (P11).
- Só nomes de pessoas foram trocados (CHAPA_##); fornecedores têm razão social e CNPJ, e a Agrovia liberou nomes no pitch.
- Outros grupos de produto, MATReser, período do registro manual, carrinhos da Loja: não constam (P4 usa o depósito).
- Spec original (06): "prevalece o dossiê" (L).

**Evento e entregáveis (§12.6), abertas:** pesos dos subcritérios; alcance de "Não serão avaliados"; T1 inteira nos 8 min?; tempo de perguntas e montagem, projetor, internet; "texto e imagem"; repo público ou privado; relatório sem a resposta da T3 conta como ausente?; consequências de atraso no link, falta de commits, vídeo e camiseta; código pré-evento; dado enviado à IA na demo × "desenvolvimento" (R p. 8); licença; precedência R × D; horário do sorteio; canal para dúvidas fora do horário.
As lacunas das T1–T3 (§12.2–12.4) ficam com a parte B; aqui entram só como riscos 4 a 8.

## 7. Candidatos a "O que NÃO vamos fazer"
Sem repetir as ideias (parte B):
- Integração com SAP (não mencionada; L traz só o mapa); autenticação, perfis e permissões (R p. 2).
- Deploy ou hospedagem (roda no notebook, R p. 7); vídeo de demonstração (R p. 7).
- Dado original (e LEIA-ME) no repo, ou qualquer publicação dos dados.
- Interpolar ago/dez 2025 (P12).
- Carregamento de cooperados e transferências no sistema (D p. 11, P8; Agrovia #8 não fornece os registros).
- Reabrir a spec original (06) onde o dossiê diverge.
- BMC (não exigido, D §6); polimento visual antes do fluxo principal (CLAUDE.md, prioridade 5).

## 8. Grupos 2 a 6 de ideias.md: avaliação e risco
Diferenciais são "acréscimos pequenos a módulos que já existem — não projetos paralelos" (R p. 4). Criatividade não tem peso próprio, só desempata em 4º; quem não faz "não é penalizado". Só os dois itens do grupo 3 são nomeados pelo R como pontuáveis; o ganho dos demais passa pelo cliente (30%) [SUPOSIÇÃO].

| Grupo | Pontuação [SUPOSIÇÃO] | Risco na demo | Quando |
|---|---|---|---|
| 2 Dimensionar funcionários, efetivo, alertas, prioridade | Cliente alto: toca a pergunta central. Prioridade conflita com R p. 1 | Baixo (local) | Após T1 e T3 básicas, antes das 20h |
| 3 NF por XML | Nomeado pelo R | Baixo (local) | Antes das 20h, com a T1 pronta |
| 3 Linguagem natural | Nomeado pelo R ("IA de fato") | Rede/LLM no anfiteatro; o exemplo (setembro) não tem dado (D §12.1). Timeout e consultas fixas de fallback | Com a T3 pronta, antes das 03h |
| 4 Câmera | Preferida da Agrovia: eleva aderência e utilidade | Luz, foco, reflexo de DANFE em tela, permissão da webcam. Mitigar: campo para a chave de 44 dígitos. Só código de barras; OCR de placa e cancela são projeto paralelo, cortar | Decidir até as 20h; fazer 20h–00h |
| 5 Expo, push, relógios | Baixo; responsividade não é avaliada | Banca instalar o Expo Go em 8 min: inviável. Relógios: fora | Após T1–T3; candidato a corte |
| 6 Tempo, atraso, almoço, equipamento, chegadas | Previsão: "adubo não pode tomar chuva" (Agrovia) | API externa com timeout e fallback. Grades alternativas contradizem R p. 1: cortar | 00h–03h, com tudo verde |

## 9. Riscos da stack (pelo ângulo da entrega)
- better-sqlite3 é nativo e pode falhar no Windows: instalar e rodar `next build` no notebook da demo no passo 0; plano B, node:sqlite.
- O DB fica fora do git (DB_PATH): gerá-lo de PACOTE_DIR no notebook da demo antes das 07h.
- Três `next dev` pesam na CPU: um NEXT_DIST_DIR por sessão; a demo usa `next build` e `next start`.
- Migrations e instalação só no passo 0 e na integração; sem CDN, a demo não depende da rede.

## 10. Pendências para a consolidação
- Claude D decidir: diária (4.1), grade × prioridade (4.6), carga mista e norma (4.2, 4.3), 3 locais do boletim (4.9).
- Alinhar o "5h antes do fim" do CLAUDE.md com o congelamento das 07h.
- Colocar docs/contexto e PACOTE_DIR no `.gitignore` (fora do meu escopo).
- Definir formato e ferramenta dos 4 artefatos; decidir se haverá slides (não consta).
- Perguntar à comissão: projetor e internet, repo privado, T1 inteira nos 8 min, dado na IA durante a demo.
- Perguntar à Agrovia até 17h: P3 (safra) e P4 (3 locais).
- Quais itens dos grupos 2–6 sobrevivem ao corte das 20h.

STATUS: feito
