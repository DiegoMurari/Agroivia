# Hackathon Kit

Base de UI para a hackathon: Next.js 16, React 19, Tailwind CSS v4 e um design system pronto
(tokens, componentes e layout), com tema claro e escuro.

## Rodando

```bash
npm install
npm run dev
```

Abra http://localhost:3000. A página inicial é o style guide com um dashboard de exemplo.

## Onde fica cada coisa

| Caminho | Conteúdo |
| --- | --- |
| `app/globals.css` | Tokens de cor (claro e escuro), estilos base, foco e acessibilidade |
| `tailwind.config.ts` | Mapeamento dos tokens para classes: cores, fontes, títulos, raios, sombras, animações |
| `components/ui/` | `Button`, `Input` (com `Textarea`, `Label`, `Field`), `Card`, `Badge` |
| `components/layout/` | `Navbar`, `Sidebar`, `PageWrapper` |
| `components/` | `Providers` (tema e ícones) e `ThemeToggle` |
| `app/page.tsx` | Style guide / dashboard de exemplo |
| `app/_showcase/` | Peças usadas só pelo style guide. Pode apagar quando não precisar mais |
| `lib/utils.ts` | `cn()` para combinar classes |
| `lib/site.ts` | Nome e descrição do produto (título da aba e logo) |

Regras de design, tokens e API dos componentes: [DESIGN.md](DESIGN.md).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build de produção |
| `npm run lint` | ESLint |
