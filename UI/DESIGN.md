# Design System: Hackathon Kit

Minimalista, preciso e acessível, na linha Vercel/Linear: tinta quase preta sobre fundo quase branco,
uma única cor de marca (azul), bordas hairline e sombras difusas em camadas. Tema claro e escuro desde
o início. A referência viva de tudo está em `app/page.tsx` (rode `npm run dev`).

## Regras

1. **Só tokens semânticos.** `bg-card`, `text-muted-foreground`, `border-border`. Nunca `bg-zinc-100`, `text-gray-500` ou hex no componente.
2. **Uma cor de destaque: `brand`.** Aparece no foco, em links, no item ativo e no dado em ênfase de um gráfico. Sem gradientes, sem glow, sem roxo "de IA".
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
| `primary` | Ação principal (tinta) | `bg-primary` `text-primary-foreground` |
| `secondary` / `muted` | Superfícies sutis, blocos de código | `bg-secondary` `bg-muted` |
| `accent` | Fundo de hover (ghost, outline, menus) | `hover:bg-accent` |
| `muted-foreground` | Texto secundário, placeholders | `text-muted-foreground` |
| `brand` | Marca: links, foco, item ativo, ênfase | `text-brand` `bg-brand` `bg-brand/10` |
| `success` / `warning` / `destructive` | Status (texto ou fundo a 10%) | `text-success` `bg-destructive/10` |
| `border` / `input` / `ring` | Hairline, borda de campo, anel de foco | `border-border` `border-input` `outline-ring` |
| `chart-1` ... `chart-5` | Séries de gráfico, **nesta ordem** (validada para daltonismo) | `bg-chart-1` |
| `sidebar-*` | Sidebar (compatível com shadcn/ui) | `bg-sidebar` |

**Trocar a marca:** edite `--brand` em `:root` e em `.dark`. O `--ring` acompanha. Mantenha contraste
de pelo menos 4.5:1 com `--background` e `--card` (a marca também é cor de texto em links).

**Gráficos:** no tema claro, `chart-3`, `chart-4` e `chart-5` ficam abaixo de 3:1 sobre o card. Ao usá-las,
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
