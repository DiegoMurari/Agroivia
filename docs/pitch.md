# Pitch: Recebimento Inteligente (8 minutos, demo ao vivo)

**Rascunho de 03/10, 18h45.** Os números vêm de `docs/relatorio.md`, iguais aos do painel. Ensaio cronometrado na I9.

## Antes de subir ao palco

- Notebook da demo: `cd web`, `npm run db:clone:demo` (banco e relógio voltam ao início: segunda 05/10, 07:45), depois `npm run start`. **Sem rede**: Wi-Fi desligado ou rede isolada do notebook com o celular.
- Abas abertas, nesta ordem: `/agendamento` (papel Compras), `/agendamento/agendar/demo-compra-2`, `/dia`, `/boletim/novo` (papel Responsável), `/painel` (papel Direção).
- Celular na mesma rede do notebook, com `http://<ip do notebook>:8000/agendamento/descarga/<id>` pronto.
- Arquivos de NF no desktop: os 2 XML sintéticos de `web/lib/agendamento/__fixtures__/` (um batido, um paletizado).

## Roteiro com tempo

| Tempo | Bloco | O que dizer e mostrar |
|---|---|---|
| 0:00 a 0:40 | **Problema** | Só cerca de 20% dos fornecedores avisam a entrega. Caminhão chega sem hora, funcionário espera ou falta, e o boletim é papel que ninguém consolida. A pergunta da Agrovia: **a equipe de funcionários sobra ou falta?** |
| 0:40 a 1:00 | **Usuário** | Cinco papéis, sem senha: Compras, fornecedor, portaria, responsável pelo armazém e direção. Troca de papel no seletor da barra. |
| 1:00 a 2:00 | **Demo 1: agendamento** | Compras gera o link. O fornecedor abre, anexa 2 XML, e o sistema lê chave, peso, volumes e espécie sozinho. Tenta um horário cheio: recusado, com a próxima data. Escolhe outro e confirma. O sistema já dimensiona funcionários e empilhadeira pela norma. |
| 2:00 a 3:10 | **Demo 2: o dia** | Portaria marca a chegada e o peso da balança. Compras acusa divergência; o responsável recebe com **pendência** e define **2 armazéns**. No celular: entrada e saída em cada armazém, 3 funcionários e a empilhadeira. **Reinicia o servidor**: os dados continuam lá. A tela do dia mostra a descarga, os alertas e a previsão do tempo. |
| 3:10 a 4:10 | **Demo 3: boletim** | Adubo, 17/11/2025: 2.378 + 400, 30 e 40, 11 funcionários. Na tela: **918,20 / 83,47 / 991,90 / 73,71**, a mesma conta da planilha da Agrovia, sem arredondar. Um funcionário vira meia diária: **87,45 / 946,82 / 28,62**. |
| 4:10 a 5:30 | **Demo 4: a resposta** | Painel: "Na safra houve **excesso** médio de **3,79** funcionários por dia, cerca de **R$ 341,93** por dia em complemento; nos dias de pico, **falta** mediana de **14,17**." Os dois lados convivem: 93 dias com excesso e 45 com falta em 138 dias úteis. Mostra a origem de cada número. Seção **Amanhã**: "precisamos de 5 funcionários a partir das 08:00", com o botão de copiar o aviso ao prestador. |
| 5:30 a 6:30 | **Diferencial** | Não é só agenda: é a conta da Agrovia. O mesmo cálculo do boletim mede o histórico, o dia de hoje e o de amanhã. Leitura determinística do XML (sem IA no caminho principal). O histórico tem limites e o painel diz quais: excesso é teto, falta é piso. |
| 6:30 a 7:15 | **Arquitetura e segurança** | Next.js e SQLite num notebook, sem nuvem e sem rede. Valores em decimal exato. Dados da Agrovia fora do repositório. Upload de NF com limite de tamanho e XML sem entidades externas. A IA é opcional e só escolhe entre consultas fixas, sem enviar dado pessoal. |
| 7:15 a 8:00 | **Próximos passos e fecho** | Integração com o SAP, login real por papel, câmera lendo o DANFE. Fecho: quem chega sem agendar vê na hora a próxima data disponível; a fila vira agenda, e a pergunta "sobra ou falta" passa a ter número todo dia. |

## Plano B

- **Sem rede:** nada muda. A previsão do tempo mostra "Previsão indisponível" e "Pergunte ao painel" usa as consultas fixas.
- **Servidor caiu:** `npm run start` de novo; o banco e o relógio da demo continuam onde estavam.
- **Demo atrasou:** pular o celular (passo 2) e ir direto ao boletim e ao painel, que são a resposta.
- **Algo travou na tela:** mostrar as imagens de `docs/artefatos/img/` e o relatório no GitHub.

## Perguntas da banca

| Pergunta | Resposta (até 30 s) |
|---|---|
| Como vocês sabem a produção do histórico sem boletins? | Estimada pelo recebimento de compras, convertida na unidade do boletim e calibrada contra o único boletim real (17/11/2025, +1,3%). Como carregamento e remoção não estão nos dados, o excesso é teto e a falta é piso, e o relatório diz isso. |
| Por que excesso e falta ao mesmo tempo? | Porque a média esconde a variação: em dia comum sobra gente, em dia de pico falta. O painel mostra os dois e o custo de cada lado. |
| E se o fornecedor não tiver o XML? | Anexa o PDF e digita a chave de 44 dígitos. |
| E a regra de 2 caminhões por horário, que a Agrovia diz não ser fixa? | Aplicamos a regra do dossiê. A exceção existe só com justificativa gravada, para defensivos e fertilizantes e para caso fortuito. |
| Onde entra IA? | Fora do caminho principal: a leitura da NF é determinística. A IA só escolhe qual consulta fixa responde à pergunta, com timeout de 5 s e alternativa sem rede. |
| Isso escala para a operação real? | O modelo de dados já separa `teste` e `operacao` e grava a origem de cada linha. Faltam login e a integração com o SAP. |
