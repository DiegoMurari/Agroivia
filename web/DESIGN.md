# Design System: Hackathon Kit

Minimalista, preciso e acessível, com a paleta da Agrovia: fundo cinza `#EBEBEB` com superfícies brancas, azul `#005BA0` de marca, verde nas ações e amarelo de detalhe, bordas hairline e sombras difusas em camadas. Tema claro e escuro desde
o início. A referência viva de tudo está em `/design` (`app/design/page.tsx`).

## Regras

1. **Só tokens semânticos.** `bg-card`, `text-muted-foreground`, `border-border`. Nunca `bg-zinc-100`, `text-gray-500` ou hex no componente.
2. **Cores Agrovia.** `brand` (azul) em links, foco, item ativo, títulos de página e seção e números em destaque. `primary` (verde) nas ações principais. `highlight` (amarelo) só decorativo, nunca texto. Sem gradientes, sem glow.
3. **Status nunca depende só da cor.** Sempre ícone + texto: `<Badge variant="success"><CircleCheck /> Aprovado</Badge>`.
4. **Formas fixas.** Controles (Button, Input) `rounded-md`. Superfícies (Card) `rounded-xl`. Indicadores (Badge, avatar) `rounded-full`.
5. **Todo clicável responde.** Hover, `:active` (escala 0.98) e foco visível. Nunca remova o outline de foco.
6. **Formulários.** Label acima, ajuda e erro abaixo, erro com causa + como corrigir. Placeholder não substitui label.
7. **Movimento com motivo.** Só `opacity` e `transform`, 150 a 500 ms, `ease-out-expo`. `prefers-reduced-motion` já desliga tudo no CSS global.
8. **Cards só quando a elevação ajuda.** Para agrupar conteúdo simples, prefira espaço em branco e `border-t`.
9. **Ícones:** apenas `lucide-react`, traço 1.75 (definido uma vez no `LucideProvider`). Botão só com ícone precisa de `aria-label`.
10. **Texto da interface:** frases curtas e concretas, sem travessão (—) e sem jargão de marketing ("revolucionário", "potencialize").

## Tokens

Valores em `app/globals.css` (`:root` = claro, `.dark` = escuro). Nomes mapeados em `tailwind.config.ts`.
Todos os pares texto/fundo passam WCAG AA (4.5:1) nos dois temas, inclusive os badges.

| Token | Uso | Classes |
| --- | --- | --- |
| `background` / `foreground` | Página e texto principal | `bg-background` `text-foreground` |
| `card` / `popover` | Superfícies elevadas | `bg-card` `bg-popover` |
| `primary` | Ação principal (verde Agrovia) | `bg-primary` `text-primary-foreground` |
| `secondary` / `muted` | Superfícies sutis, blocos de código | `bg-secondary` `bg-muted` |
| `accent` | Fundo de hover (ghost, outline, menus) | `hover:bg-accent` |
| `muted-foreground` | Texto secundário, placeholders | `text-muted-foreground` |
| `brand` | Marca (azul Agrovia): links, foco, item ativo, títulos, números | `text-brand` `bg-brand` `bg-brand/10` |
| `highlight` | Detalhe decorativo (amarelo Agrovia), nunca texto | `bg-highlight` `border-highlight` |
| `success` / `warning` / `destructive` | Status (texto ou fundo a 10%) | `text-success` `bg-destructive/10` |
| `border` / `input` / `ring` | Hairline, borda de campo, anel de foco | `border-border` `border-input` `outline-ring` |
| `chart-1` ... `chart-5` | Séries de gráfico, **nesta ordem** (validada para daltonismo) | `bg-chart-1` |
| `sidebar-*` | Sidebar (compatível com shadcn/ui) | `bg-sidebar` |

**Paleta:** cores da Agrovia, valores em `app/globals.css`. Ao mudar qualquer cor, mantenha 4.5:1 com `--background` e `--card`.

**Gráficos:** no tema claro, `chart-2`, `chart-3` e `chart-4` ficam abaixo de 3:1 sobre o card. Ao usá-las,
mostre rótulos visíveis ou uma tabela com os valores.

### Tipografia

Geist e Geist Mono pelo pacote `geist` (fontes locais, funciona sem internet).

| Classe | Medida | Uso |
| --- | --- | --- |
| `text-display` | 48px, peso 600, tracking -0.045em | Hero |
| `text-h1` | 36px, peso 600, tracking -0.04em | Título de página (o `PageWrapper` já usa) |
| `text-h2` | 24px, peso 600, tracking -0.03em | Título de seção |
| `text-h3` | 18px, peso 600, tracking -0.02em | Título de card grande |
| `text-base` / `text-sm` | 16px / 14px | Corpo / interface |
| `font-mono text-[13px]` | 13px | Código e comandos |

### Raios, sombras e movimento

- `--radius: 0.5rem` gera `rounded-sm` 4px, `rounded-md` 6px, `rounded-lg` 8px, `rounded-xl` 12px, `rounded-2xl` 16px.
- Sombras em camadas: `shadow-xs` (controles), `shadow-card` (cards), `shadow-elevated` (hover, popovers), `shadow-overlay` (modais). No escuro viram borda + brilho sutil na aresta superior.
- Animações: `animate-fade-in`, `animate-fade-in-up`, `animate-fade-in-down`, `animate-scale-in`, `animate-fade-out`, `animate-shimmer`. Do `tw-animate-css`: `animate-in`/`animate-out` (`fade-in-0`, `zoom-in-95`, `slide-in-from-top-2`...) e `animate-accordion-down`/`up`.
- Carregamento: `<div className="skeleton h-4 w-32 rounded" />`. Prefira skeleton no formato do conteúdo a spinner.

## Componentes

Todos aceitam `className` (mesclado com `cn()`, a última classe vence) e as props nativas do elemento.

### Button (`components/ui/Button.tsx`)

- `variant`: `default` · `secondary` · `outline` · `ghost` · `link` · `destructive`
- `size`: `sm` · `md` · `lg` · `icon` · `icon-sm` · `icon-lg`
- `loading`: spinner + `aria-busy` + bloqueia clique duplo. `asChild`: aplica o estilo em `<Link>` ou `<a>`.

```tsx
<Button>Salvar</Button>
<Button variant="outline" size="sm"><Download /> Exportar</Button>
<Button loading={isPending}>Salvando</Button>
<Button asChild><Link href="/projetos/novo">Novo projeto</Link></Button>
<Button variant="ghost" size="icon" aria-label="Fechar"><X /></Button>
```

`buttonVariants({ variant, size })` gera só as classes, para estilizar outro elemento.

### Input, Textarea, Label e Field (`components/ui/Input.tsx`)

`Input` tem `size` `sm` · `md` · `lg` (alinhados às alturas do Button). Erro via `aria-invalid`.
`Field` liga label, ajuda, erro, `id`, `aria-describedby` e `aria-invalid` sozinho:

```tsx
<Field label="E-mail" description="Usado só para login" error={errors.email} required>
  <Input type="email" name="email" autoComplete="email" />
</Field>

<Field label="Descrição">
  <Textarea name="description" rows={3} />
</Field>
```

O filho do `Field` precisa ser o próprio controle. Para input com ícone, use `Label` + `Input` com `id` (exemplo no style guide).

### Card (`components/ui/Card.tsx`)

```tsx
<Card>
  <CardHeader>
    <CardTitle>Entrega final</CardTitle>
    <CardDescription>Sábado às 18h</CardDescription>
    <CardAction><Badge variant="warning"><TriangleAlert /> Pendente</Badge></CardAction>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter className="border-t">...</CardFooter>
</Card>

{/* Card clicável: hover com elevação e foco visível */}
<Card asChild interactive>
  <Link href="/projetos/radar">...</Link>
</Card>
```

`CardTitle` é um `<h3>`; troque o nível com `<CardTitle asChild><h2>...</h2></CardTitle>`.

### Badge (`components/ui/Badge.tsx`)

`variant`: `default` · `solid` · `outline` · `success` · `warning` · `destructive` · `info`.

### Select e Checkbox

`Select` é o `<select>` nativo com o visual do `Input` (mesmos `size`) e funciona dentro do `Field`. `Checkbox` aceita `label` e `description`.

```tsx
<Field label="Armazém"><Select name="armazem"><option value="2">Adubo</option></Select></Field>
<Checkbox name="fazBoletim" label="Faz boletim" defaultChecked />
```

### Table (`components/ui/Table.tsx`)

`Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`. Rola na horizontal no mobile. Números: `className="text-right tabular-nums"`.

### Tabs e Dialog (client components)

```tsx
<Tabs defaultValue="safra">
  <TabsList aria-label="Período"><TabsTrigger value="safra">Safra</TabsTrigger><TabsTrigger value="entressafra">Entressafra</TabsTrigger></TabsList>
  <TabsContent value="safra">...</TabsContent>
</Tabs>

<Dialog open={aberto} onClose={() => setAberto(false)} title="Cancelar agendamento" description="A vaga volta para a agenda."
  footer={<><Button variant="outline" onClick={fechar}>Voltar</Button><Button variant="destructive">Cancelar</Button></>}>
  <Field label="Motivo"><Textarea name="motivo" /></Field>
</Dialog>
```

`Tabs` também aceita `value` e `onValueChange` (controlado). `Dialog` usa o `<dialog>` nativo: Esc, X e clique fora chamam `onClose`.

### Alert, Stat e EmptyState

```tsx
<Alert variant="destructive" title="Horário cheio">A próxima data disponível é 06/10 às 08:00.</Alert>
<Stat label="Complemento pago" value="73,71" unit="R$" description="17/11/2025, Adubo" badge={<Badge variant="outline">Teste</Badge>} />
<EmptyState icon={<CalendarX />} title="Nenhum agendamento hoje" description="..." action={<Button>Novo</Button>} />
```

`Alert`: `variant` `info` · `success` · `warning` · `destructive` (o ícone acompanha). `Stat`: `tone` `default` · `success` · `warning` · `destructive` para o número que é veredito.

### Layout (`components/layout`)

```tsx
<Navbar
  logo={<Logo />}
  items={[{ label: "Projetos", href: "/projetos" }, { label: "Docs", href: "https://...", external: true }]}
  actions={<ThemeToggle />}
/>
<div className="flex flex-col md:flex-row">
  <Sidebar sections={[{ title: "Geral", items: [{ label: "Visão geral", href: "/", icon: <LayoutDashboard /> }] }]} />
  <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
    <PageWrapper title="Projetos" description="..." actions={<Button>Novo</Button>}>
      ...
    </PageWrapper>
  </main>
</div>
```

- **Navbar:** fixo com blur, item ativo pela rota, menu no mobile (fecha com Esc) e link "Pular para o conteúdo" apontando para `#main-content`.
- **Sidebar:** recolhe para só ícones (com tooltip). No mobile vira uma faixa rolável. Item ativo pela rota ou, em links `#âncora`, pela seção visível. `icon` recebe o elemento (`<LayoutDashboard />`) para funcionar em Server Components.
- **AppShell:** já está no layout raiz (`app/layout.tsx`): barra com a navegação dos módulos, o seletor de papel e o tema, mais o `<main id="main-content">`. As páginas não repetem `Navbar` nem `<main>`.
- **PageWrapper:** container com respiro, entrada suave e cabeçalho opcional. `size`: `narrow` (formulários) · `default` · `wide` (tabelas) · `full`.

### Tema

`ThemeToggle` alterna claro/escuro (padrão: tema do sistema). Para estilos que só mudam no escuro, use
`dark:` (ex.: `dark:bg-input/30`), mas prefira tokens, que já trocam sozinhos.

## shadcn/ui

Os nomes dos tokens seguem o shadcn/ui, então componentes adicionados com `npx shadcn add` herdam este tema.
Os arquivos daqui usam PascalCase (`Button.tsx`) e o shadcn importa `@/components/ui/button`: ao adicionar
um componente que depende de button, input, card ou badge, ajuste o import para o nome com maiúscula.

## Checklist de cada tela

- [ ] 375, 768, 1024 e 1440px sem scroll horizontal
- [ ] Conferida no tema claro e no escuro
- [ ] Navegável só com teclado, foco sempre visível
- [ ] Estados de carregando (skeleton), vazio e erro
- [ ] Status com ícone + texto; botões só com ícone têm `aria-label`

## Padrão das telas aprovadas (Hoje é a referência)

Regras tiradas do que já foi aprovado em `/dia` e dos componentes de `components/ui`, e reforçadas com três referências externas: *taste-skill* (hierarquia clara, espaçamento generoso, nada de UI genérica ou inacabada), *ui-ux-pro-max-skill* (contraste 4.5:1, foco visível, `cursor-pointer`, status nunca só por cor, funcionar em 375, 768, 1024 e 1440 px, sem truncar sem caminho para o valor completo) e *awesome-claude-design* (um DESIGN.md com tema, cores com papel, tipografia, componentes, layout, elevação, faça e não faça, comportamento responsivo). Antes de criar ou mexer em uma tela, leia `app/dia` e `components/dia`.

### Tema e atmosfera
App de operação para quem está de pé no pátio: informação em cartões brancos sobre fundo cinza `#EBEBEB`, azul `#005BA0` para título e destaque, verde só na ação principal, letra legível de longe. Densidade média: tudo o que importa cabe na tela sem rolar em 1440 por 900.

### Layout (um padrão só)
- **Largura:** `PageWrapper` com `size="wide"` (1400 px) em toda tela de lista, painel ou operação. `default` é o mesmo valor. `narrow` só para formulário de uma coluna (login, portaria, link do fornecedor). `scrollbar-gutter: stable` evita o menu pular.
- **Cabeçalho da página:** o menu já diz onde a pessoa está, então o título da página é só para leitor de tela. O conteúdo abre direto no que importa: faixa de avisos (se houver), números do dia e a lista.
- **Títulos:** `text-h2 text-brand` (24 px) para a seção principal da tela; `text-h3` (18 px) para título de cartão e de bloco. Subseção de apoio ("Finalizadas") pode ser `text-muted-foreground`. Não inventar outro tamanho.
- **Números de resumo (KPI):** cartão branco com ícone num círculo `bg-brand/10`, número em `text-brand` e rótulo `text-sm text-muted-foreground`. Uma cor de destaque nos números (azul); cor semântica só para veredito, com ícone e texto.
- **Ritmo:** `gap-4` ou `gap-5` entre cartões, `gap-6` entre seções, `p-4` dentro do cartão. Tela de operação cabe na janela (`h-[calc(100dvh-…)]` com rolagem só nas listas internas), como o boletim.
- **Voltar:** toda tela de dentro de um módulo tem "Voltar para …" (`BotaoVoltar`, calculado pela rota).

### Componentes e cor
- **Cartão de lista:** `rounded-2xl border bg-card shadow-card`, cabeçalho com tom suave da cor da situação, hover que sobe 1 px (`hover:-translate-y-1`), entrada `animate-drop-in` ou `animate-fade-in-up` com atraso por posição (no máximo 8).
- **Ação:** principal em verde sólido (`Button`), secundária em `outline`. "Abrir detalhe" é sempre o mesmo estilo (`outline` com seta), nunca link solto numa tela e botão em outra.
- **Status:** o mesmo mapa em toda tela. Concluído verde, em andamento e agendado azul ou neutro, atraso e pendência azul com ícone de alerta, erro e não recebido vermelho, cancelado cinza. Sempre ícone + texto.
- **Cor por entidade:** uma cor só (azul da marca). Diferenciar equipe, armazém ou usuário por nome, ícone e posição, não por cor nova.
- **Carrossel:** `Carrossel` com setas numa calha lateral (nunca por cima do cartão) e `CartaoFantasma` borrado quando não há nada; "Ver todas" abre a lista inteira.
- **Avisos:** `FaixaDeAvisos` passando no topo, pausa no hover, fechável, sem duplicar o mesmo aviso.

### Impressão
Papel A4 com a mesma linguagem da tela: logo, data, bloco com borda lateral e tom suave, nomes grandes. `@page` definido pelo componente, `print:p-0` no `PageWrapper`, tudo o que é controle com `print:hidden`. Conferir sempre que cabe em uma folha.

### Faça e não faça
- Faça: copiar o componente aprovado antes de criar outro; tokens semânticos; foco visível; conferir 375, 768, 1024 e 1440 px.
- Não faça: amarelo em texto ou cabeçalho, gradiente, emoji como ícone, largura de container própria, tamanho de título novo, cor nova para um tipo de item, avisos duplicados.
