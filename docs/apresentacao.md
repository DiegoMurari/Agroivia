# Apresentação: preparo, roteiro e checklist

## Antes de apresentar (10 min antes)

1. Pare o servidor da porta 8000.
2. `.env` com `DEMO_AGORA=2026-08-31T12:50:00-03:00`.
3. `cd web` e `npm run demo:preparar` (recria `data/demo.db` e recoloca o relógio em 12:50; ele corre a partir daí).
4. `npm run start` (porta 8000). Entre uma vez em cada perfil para esquentar as telas.
5. Notas para anexar: `web/data/apresentacao/` (XML e PDF, com o papel de cada uma no nome).

Para repetir o ensaio do zero, rode o passo 1 a 4 de novo. Para ensaiar sem mexer na demo: `npm run demo:preparar -- ensaio`.

## Logins (senha `agrovia2026`)

| Quem | E-mail | Aba |
| --- | --- | --- |
| Fornecedor (Nutrimix, criado pela NF) | nutrimix@nutrimix.com.br | Fornecedor |
| Compras | compras@agrovia.com.br | Agrovia |
| Portaria | portaria@agrovia.com.br | Agrovia |
| Armazém | armazem@agrovia.com.br | Agrovia |
| Adm | adm@agrovia.com.br | Agrovia |

## Notas fiscais (da Nutrimix, emitente 11.222.333/0001-81)

| Arquivo | Uso |
| --- | --- |
| `1_bate` (NF 222545, 34 t, big bag) | Pedido das 13:00 (nota 222545). Na portaria, **bate**: libera. |
| `2_pedidoErrado` (NF 222455) | Anexada no pedido das 13:00 (nota 222455). |
| `3_caminhao` (NF 222547) | A nota que o caminhão da Nutrimix das 13:00 traz. **Não bate**: portaria recusa. É também a nota certa para o fornecedor reenviar. |
| `4_ao_vivo` (NF 223300) | Criar um pedido novo ao vivo, mostrando o preenchimento automático (peso, tipo, chave, itens). |
| `5_aguardando`, `6_recusada` | Já estão no cenário (aguardando Compras e recusado com comentário). |

## Roteiro (cerca de 8 min)

1. **Problema (30 s).** Descarga sem agenda, planilha e conferência de nota no olho; Compras e armazém sem previsão.
2. **Fornecedor agenda (1 min).** Nutrimix, "Agendar descarga", anexa `4_ao_vivo`: tudo preenche sozinho, a nota fica presa ao horário. Enviar para aprovação.
3. **Compras aprova (30 s).** Aprovações: aprova o novo, mostra o recusado com o comentário e o fornecedor vendo o motivo.
4. **Portaria, nota que bate (1 min).** Conferir nota com `1_bate` (XML ou chave). Confere, itens aparecem, registrar chegada.
5. **Portaria, nota que não bate (1,5 min).** Conferir `3_caminhao`: há mais de um pedido da Nutrimix, escolhe o das 13:00 de hoje. Diverge. Recusar com motivo (ou registrar chegada com observação, que abre pendência).
6. **Fornecedor corrige (1 min).** Nutrimix vê o aviso com o motivo, "Agendar de novo" com `3_caminhao`, Compras aprova.
7. **Hoje e boletim (1 min).** Tela do dia, descarga, saída com funcionários; boletim e equipes.
8. **Painel gerencial (1,5 min, é 30% da nota).** Projeção de funcionários e custo das próximas semanas, excesso e falta médios, dinheiro pago sem produção, previsão do dia seguinte.
9. **Fecho (30 s).** Artefatos: DER, casos de uso, BPMN e relatório em `docs/`.

## Checklist dos requisitos obrigatórios

- [ ] T1 agendamento ponta a ponta: fornecedor agenda, Compras aprova, portaria confere a nota (XML, PDF ou chave), recusa ou registra com pendência, descarga e saída.
- [ ] T2 boletim: casos T1 e T2 do PRD (`docs/PRD.md`, seção de casos).
- [ ] T3 painel: previsão de funcionários por dia, custo, excesso e falta.
- [ ] Artefatos: DER, caso de uso, BPMN, relatório.
- [ ] Dados pessoais mascarados antes de IA, segredos só no `.env`, fallback sem rede.

## Plano B

- Tela travada: recarregar; a sessão volta pelo login.
- Relógio errado (servidor reiniciado depois de muito tempo): refazer o preparo.
- Sem internet: nada do caminho principal depende dela.
