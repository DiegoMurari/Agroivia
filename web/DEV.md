# DEV: guia das janelas

Leia antes de codar. Contrato completo: `docs/plano-paralelo.md`. Liberações: `docs/progresso/geral.md`.

## 1. Mapa

| Janela | Módulos | Porta | Build | Banco |
|---|---|---|---|---|
| Geral | compartilhado, demo | 8000 | `.next` | `data/demo.db` (cópia de `data/base.db`) |
| C (s1) | `agendamento` | 8001 | `.next-s1` | `data/s1.db` |
| B (s2) | `boletim`, `dia`, `cadastros` | 8002 | `.next-s2` | `data/s2.db` |
| A (s3) | `painel` | 8003 | `.next-s3` | `data/s3.db` |

Todo `npm run` é dentro de `web/`. Troque `N` pelo número da sua janela.

| Comando | O que faz | Quem roda |
|---|---|---|
| `npm run dev:sN` | Servidor da janela (porta, build e banco próprios) | **Só o humano** |
| `npm run test:sN` | Vitest só em `lib/<seus módulos>/` | Janela |
| `npm run tsc:sN` | tsc do módulo mais o compartilhado | Janela |
| `npm run lint:sN` | eslint só nas pastas do módulo | Janela |
| `npm run run:sN -- lib/<modulo>/arquivo.ts` | Roda um script seu contra `data/sN.db` | Janela |
| `npm run db:clone:sN` | Restaura `data/sN.db` a partir da matriz | Janela (servidor parado) |
| `npm run seed:agendamento` / `seed:boletim` / `seed:painel` | Roda `lib/<modulo>/seed.ts` no banco da janela dona | Janela |
| `npm run import:hist` | Importador do histórico no `s3.db` | Janela A |
| `npm run build`, `start`, `db:rebuild`, `db:clone`, `e2e`, `test:s0`, `tsc:s0` | Demo, matriz e compartilhado | Geral e humano |

`npm run dev` sozinho falha de propósito. Sem `DB_PATH` (ele não está no `.env`), `getDb()` falha com mensagem clara.

## 2. O que é compartilhado e como usar

Só a geral edita. Precisa de mudança: `docs/pedidos/janela-X.md`.

```ts
// @/lib/money: dinheiro, peso e quantidade com casas. Nunca number.
import { dec, deInteiro, somar, multiplicar, dividir, igual, paraTexto, formatBRL, formatNumero } from "@/lib/money";
const producao = multiplicar(somar("2778", "30", "40"), "0.3224"); // Valor exato
paraTexto(producao); // "918.1952" (vai para o banco)   formatNumero(producao) // "918,20"   formatBRL(producao) // "R$ 918,20"
```
Também: `subtrair`, `comparar` (-1, 0, 1), `menorQue`, `maiorQue`, `maior`, `ZERO`, `decBR("1.289,60")` (texto digitado), `decOuNulo` (dado sujo), `paraTextoCasas(v, 10)`. Inteiro (nº de funcionários) entra por `deInteiro(11)`. **Os valores "exibe" do PRD são `formatNumero`; `formatBRL` põe o `R$ ` na frente.**

```ts
// @/lib/relogio: a hora atual. Nunca new Date() para "agora".
import { agora, agoraISO, hojeISO, paraISO } from "@/lib/relogio";
agoraISO(); // "2026-10-05T07:45:12-03:00" (relógio da demo, continua correndo)
hojeISO(); // "2026-10-05"
```

```ts
// @/lib/origem: toda linha operacional nova leva origem.
import { origemPadrao } from "@/lib/origem";
db.insert(schema.compra).values({ ...dados, origem: origemPadrao() }).run();
```

```ts
// @/lib/db/enums: enumerações do DER para regra pura e zod (sem banco).
import { AGENDAMENTO_STATUS, type AgendamentoStatus } from "@/lib/db/enums";
const corpo = z.object({ status: z.enum(AGENDAMENTO_STATUS) });
```

```ts
// @/lib/db: conexão e schema (a partir da LIBERAÇÃO 2a).
import { getDb, schema, type Db } from "@/lib/db";
const linhas = getDb().select().from(schema.armazem).all(); // getDb() só em rota e página
```

```ts
// @/lib/db/testing: banco temporário para teste (a partir da LIBERAÇÃO 2a). Nunca data/sN.db.
import { createTestDb } from "@/lib/db/testing";
const t = createTestDb({ seed: true }); // t.db, t.reabrir(), t.apagar()
afterEach(() => t.apagar());
```

```ts
// @/lib/http: resposta JSON num formato só (a partir da LIBERAÇÃO 2).
import { ok, erro, validar } from "@/lib/http";
const v = validar(esquema, await request.json()); if (!v.ok) return v.resposta; // 400 com a causa por campo
return ok({ id }); // { ok: true, data }      erro(409, "Horário cheio.") // { ok: false, erro: { mensagem, campos? } }
```

```ts
// @/lib/papel: papel do seletor, em cookie (a partir da LIBERAÇÃO 2).
import { papelAtual } from "@/lib/papel";
const papel = await papelAtual(); // "fornecedor" | "compras" | "portaria" | "responsavel" | "direcao"
```

Também em `@/lib/http`: `lerJson(request)` (corpo malformado vira `undefined`), `ErroDeRegra` (lance no serviço, até dentro da transação: `throw new ErroDeRegra("Horário cheio.", { detalhe: { proximaData } })`) e `responderErro(e)` no `catch` da rota.

```tsx
// @/components/ui/* e @/components/layout/*: ver DESIGN.md e /design.
import { Button } from "@/components/ui/Button";
import { PageWrapper } from "@/components/layout/PageWrapper";
```

Componentes em `components/ui`: `Button`, `Input` (com `Textarea`, `Label`, `Field`), `Select`, `Checkbox`, `Card`, `Badge`, `Table`, `Tabs`, `Dialog`, `Alert`, `Stat`, `EmptyState`. `Tabs` e `Dialog` são client components. A barra de navegação e o `<main>` já vêm do layout raiz: a página do módulo começa no `PageWrapper`.

## 3. Convenções

- **Serviço recebe `db` e o instante por parâmetro**: `criarAgendamento(db, dados, agoraISO)`. Só a rota ou a página chama `getDb()` e `agora()`. Assim o teste usa `createTestDb()` e um instante fixo.
- Dinheiro, peso e quantidade com casas: sempre `lib/money`, texto decimal no banco. Sem arredondar no cálculo.
- Toda linha operacional nova: `origem: origemPadrao()`.
- Leitura em server component; mutação em route handler JSON (`app/api/<modulo>/.../route.ts`). Nada de mutação em GET nem ao abrir tela.
- Não importe código de `lib/<outro módulo>/`. Ler tabela de outro módulo pode.
- Tipar `params` à mão (os tipos globais de rota do Next ficam no distDir de cada servidor e não entram no `tsc:sN`):
  ```ts
  export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }
  ```
- Teste ao lado do código: `lib/<modulo>/*.test.ts`, com `import { describe, it, expect } from "vitest"`.

## 4. Banco

- **Transação síncrona**, sem `await` dentro, cada comando terminado em `.run()`, `.all()` ou `.get()` (sem isso o comando **não executa e não dá erro**):
  ```ts
  db.transaction((tx) => {
    const ocupados = tx.select().from(schema.agendamento).where(...).all();
    if (cheio(ocupados)) throw new ErroDeRegra("Horário cheio.");
    tx.insert(schema.agendamento).values(novo).run();
  }, { behavior: "immediate" });
  ```
  Lançar erro dentro desfaz tudo. Verificação e gravação na mesma transação (D43).
- **Nunca `SUM`, `MAX`, `ORDER BY` ou `>` em coluna de valor, peso ou quantidade** (é texto: `"100.5" < "20"`). Leia as linhas e some com `lib/money`. Igualdade de valor por `igual()`, não texto contra texto.
- Instantes sempre de `lib/relogio` (`agoraISO()`), nunca `date('now')` nem `DEFAULT CURRENT_TIMESTAMP`.
- Listar anexos de NF sem a coluna `conteudo` (BLOB); ela só é lida no download.
- `createTestDb({ seed: true })` traz armazéns, tipos de item com preço, grade, feriados, parâmetros, norma, equipamentos e usuários. Persistência se prova com `t.reabrir()`.
- **Folhas `chapas_por_dia_2025.xlsx` e `2026`:** o `workbook.xlsx.readFile` do exceljs quebra nelas (erro `anchors`, por causa de desenho na planilha). Use o leitor em fluxo: `for await (const aba of new ExcelJS.stream.xlsx.WorkbookReader(arquivo, { sharedStrings: "cache", worksheets: "emit" })) for await (const linha of aba) { linha.values }`. As outras planilhas abrem com `readFile`. Célula com fórmula vem como `{ formula, result }`.
- Importador: leia os arquivos antes da transação (o `exceljs` é assíncrono) e grave em lotes de até 500 linhas.
- Não rode `drizzle-kit`, não edite `lib/db/`, não faça `ALTER TABLE`. Falta coluna: pedido.

### Dados de demonstração (já nos bancos clonados)

- Dia D = `2026-10-05` (a data de `DEMO_AGORA`, segunda-feira). 08:00 com 1 batido (cheio, conforme e autorizado, destino Adubo); 10:00 com 2 unitizados (cheio, um divergente); 13:00 com 1 unitizado; 15:00 com um cancelado e a vaga aberta. Em 06/10 e 07/10, alguns agendados.
- 3 compras `criada` com link: tokens `demo-compra-1`, `demo-compra-2`, `demo-compra-3`.
- De 14/09 a 02/10/2026 (15 dias úteis): 79 descargas concluídas com chegada, entrada e saída (15 delas em dois armazéns), 4 não recebimentos (um por motivo), 2 pendências (uma aberta), 2 cancelados com vaga, e 45 boletins fechados (um por armazém que faz boletim, com e sem complemento).
- Tudo com `origem = teste`. Cadastros: 10.899 produtos, 872 fornecedores (`origem = historico`), 51 funcionários (15 com matrícula numérica e lotação Adubo; 36 das folhas, com matrícula igual ao nome).
- O grupo `IRG` (irrigação) existe no cadastro e não está no mapa: fica sem armazém e sem tipo de item; os produtos dele caem no armazém do depósito.

## 5. Next 16 (conferido em `node_modules/next/dist/docs/`)

- **Renderização dinâmica:** cada `app/<modulo>/layout.tsx` já traz `export const dynamic = "force-dynamic"` (vale para todas as páginas abaixo). Não remover. O build de aquecimento mostra os cinco módulos como `ƒ (Dynamic)`. Alternativa por função: `await connection()` de `next/server` antes da consulta.
- **`params` e `searchParams` são `Promise`**: `const { id } = await params`. Em route handler: `(request: Request, ctx: { params: Promise<{ id: string }> })`.
- **`cookies()` e `headers()` são assíncronos**: `const c = await cookies()`.
- **Upload em route handler:** `const form = await request.formData(); const arquivo = form.get("arquivo") as File; const bytes = Buffer.from(await arquivo.arrayBuffer());`. Confira o tamanho antes de gravar.
- **Download:** `new Response(bytes, { headers: { "Content-Type": tipo, "Content-Disposition": 'attachment; filename="nf.xml"' } })`.
- Route handler `GET` não é cacheado por padrão; mesmo assim, GET só lê.
- `better-sqlite3` já é pacote externo do servidor no Next: só importe `@/lib/db` em código de servidor (nunca em arquivo com `"use client"`).
- Abrir o `next dev` pelo celular: pedir à geral para pôr o IP do notebook em `allowedDevOrigins` do `next.config.ts` (só o hostname, sem porta).
- Antes de usar outra API do Next, leia o guia em `node_modules/next/dist/docs/01-app/`.

## 6. Quando algo sai do lugar

- **Banco da janela bagunçado:** peça ao humano para parar o `dev:sN`; `npm run db:clone:sN`; depois `npm run seed:<modulo>` se precisar. Nunca copie `.db` à mão.
- **`tsconfig.json` ou `next-env.d.ts` apareceram alterados:** nada. Foi o `next dev`. Não reverta, não conserte.
- **`tsc:sN` acusa erro em arquivo compartilhado:** siga com `test:sN` e escreva o pedido.
- **`SQLITE_BUSY`:** algum teste está usando `data/sN.db`. Use `createTestDb()`.
- **Dado gravado não aparece:** confira o `layout.tsx` dinâmico do módulo.
