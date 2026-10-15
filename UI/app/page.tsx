import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Circle,
  CircleCheck,
  CircleX,
  GitBranch,
  Hexagon,
  Info,
  Layers,
  LayoutDashboard,
  MousePointerClick,
  Palette,
  PanelsTopLeft,
  Plus,
  Rocket,
  Search,
  Tag,
  TextCursorInput,
  TriangleAlert,
  Type,
  Users,
  Wind,
  Zap,
} from "lucide-react";

import { Navbar, type NavItem } from "@/components/layout/Navbar";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Sidebar, type SidebarSection } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Field, Input, Label } from "@/components/ui/Input";
import { site } from "@/lib/site";

import { ActivityFeed } from "./_showcase/ActivityFeed";
import { activity, deploysPerDay, kpis } from "./_showcase/data";
import { CopyButton, MotionDemo, ProjectFormDemo, PublishButtonDemo } from "./_showcase/Demos";
import { DeploysChart } from "./_showcase/DeploysChart";
import { Code, Section, Specimen } from "./_showcase/Section";
import { StatTile } from "./_showcase/StatTile";
import { ColorTokens, TypeScale } from "./_showcase/Tokens";

export const metadata: Metadata = {
  title: "Style guide",
};

const navItems: NavItem[] = [
  { label: "Style guide", href: "/" },
  { label: "Ícones", href: "https://lucide.dev/icons", external: true },
  { label: "Tailwind", href: "https://tailwindcss.com/docs", external: true },
  { label: "Next.js", href: "https://nextjs.org/docs", external: true },
];

const sidebarSections: SidebarSection[] = [
  {
    title: "Exemplo",
    items: [{ label: "Dashboard", href: "#dashboard", icon: <LayoutDashboard /> }],
  },
  {
    title: "Componentes",
    items: [
      { label: "Botões", href: "#botoes", icon: <MousePointerClick /> },
      { label: "Formulários", href: "#formularios", icon: <TextCursorInput /> },
      { label: "Badges", href: "#badges", icon: <Tag /> },
      { label: "Cards", href: "#cards", icon: <PanelsTopLeft /> },
    ],
  },
  {
    title: "Fundamentos",
    items: [
      { label: "Cores", href: "#cores", icon: <Palette /> },
      { label: "Tipografia", href: "#tipografia", icon: <Type /> },
      { label: "Movimento", href: "#movimento", icon: <Wind /> },
    ],
  },
];

const deliveryChecklist = [
  { label: "README com instruções de uso", done: true },
  { label: "Deploy de produção funcionando", done: true },
  { label: "Vídeo de demonstração de 2 minutos", done: false },
];

const deploysTotal = deploysPerDay.reduce((sum, point) => sum + point.value, 0);

export default function StyleGuidePage() {
  return (
    <>
      <Navbar
        logo={<Logo />}
        items={navItems}
        actions={
          <>
            <ThemeToggle />
            <ProfileAvatar name="Luana Prado" initials="LP" />
          </>
        }
      />

      <div className="flex flex-col md:flex-row">
        <Sidebar sections={sidebarSections} />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <PageWrapper
            title="Style guide"
            description="Tokens, componentes e padrões do projeto. Use esta página como referência rápida durante a hackathon."
            actions={
              <>
                <Button variant="outline" asChild>
                  <Link href="#cores">Ver tokens</Link>
                </Button>
                <Button asChild>
                  <Link href="#botoes">
                    Ver componentes
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            }
          >
            <div className="space-y-20">
              <Section
                id="dashboard"
                title="Dashboard de exemplo"
                description="Um painel montado só com os componentes do kit. Os números são dados de exemplo."
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {kpis.map((kpi) => (
                    <StatTile key={kpi.label} {...kpi} />
                  ))}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-5">
                  <Card className="lg:col-span-3">
                    <CardHeader>
                      <CardTitle>Deploys por dia</CardTitle>
                      <CardDescription>Últimos 14 dias</CardDescription>
                      <CardAction>
                        <Badge variant="outline">{deploysTotal} no período</Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <DeploysChart />
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Atividade recente</CardTitle>
                      <CardDescription>Deploys e revisões do time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ActivityFeed items={activity} />
                    </CardContent>
                  </Card>
                </div>
              </Section>

              <Section
                id="botoes"
                title="Botões"
                description="Seis variantes e seis tamanhos. Todos têm hover, foco visível pelo teclado e resposta ao clique."
              >
                <Card className="gap-0 divide-y py-0">
                  <Specimen label="Variantes" hint={'variant="outline"'}>
                    <Button>Salvar</Button>
                    <Button variant="secondary">Duplicar</Button>
                    <Button variant="outline">Exportar</Button>
                    <Button variant="ghost">Cancelar</Button>
                    <Button variant="destructive">Excluir</Button>
                    <Button variant="link">Ver detalhes</Button>
                  </Specimen>
                  <Specimen label="Tamanhos" hint={'size="sm"'}>
                    <Button size="sm">Pequeno</Button>
                    <Button size="md">Médio</Button>
                    <Button size="lg">Grande</Button>
                  </Specimen>
                  <Specimen label="Só ícone" hint={'size="icon"'}>
                    <Button variant="outline" size="icon-sm" aria-label="Adicionar">
                      <Plus />
                    </Button>
                    <Button variant="outline" size="icon" aria-label="Adicionar">
                      <Plus />
                    </Button>
                    <Button variant="outline" size="icon-lg" aria-label="Adicionar">
                      <Plus />
                    </Button>
                  </Specimen>
                  <Specimen label="Com ícone" hint="<Search /> Buscar">
                    <Button variant="secondary">
                      <Search />
                      Buscar
                    </Button>
                    <Button variant="outline">
                      Continuar
                      <ArrowRight />
                    </Button>
                  </Specimen>
                  <Specimen label="Estados" hint="loading, disabled, asChild">
                    <PublishButtonDemo />
                    <Button variant="outline" disabled>
                      Indisponível
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="#formularios">Link com estilo de botão</Link>
                    </Button>
                  </Specimen>
                </Card>
              </Section>

              <Section
                id="formularios"
                title="Formulários"
                description={
                  <>
                    Label acima, ajuda e erro abaixo. O <Code>Field</Code> liga id, aria-describedby e aria-invalid
                    sozinho.
                  </>
                }
              >
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Estados do campo</CardTitle>
                      <CardDescription>Clique em um campo para ver o anel de foco.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                      <Field label="Nome do projeto" description="Aparece no topo do dashboard.">
                        <Input placeholder="Ex.: Radar de Enchentes" />
                      </Field>
                      <Field label="E-mail" error="Use um e-mail válido, como time@exemplo.com.">
                        <Input type="email" defaultValue="time@exemplo" />
                      </Field>
                      <Field label="Slug" description="Gerado a partir do nome.">
                        <Input defaultValue="radar-de-enchentes" disabled />
                      </Field>
                      <div className="grid gap-2">
                        <Label htmlFor="busca">Com ícone</Label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="busca" type="search" placeholder="Buscar componentes" className="pl-9" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="convite">Com botão ao lado</Label>
                        <div className="flex gap-2">
                          <Input id="convite" type="email" placeholder="nome@email.com" />
                          <Button variant="secondary">Convidar</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <ProjectFormDemo />
                </div>
              </Section>

              <Section
                id="badges"
                title="Badges"
                description="Para tags e status. Status sempre combina cor, ícone e texto, nunca só a cor."
              >
                <Card className="gap-0 divide-y py-0">
                  <Specimen label="Neutros" hint={'variant="solid"'}>
                    <Badge>Rascunho</Badge>
                    <Badge variant="solid">Novo</Badge>
                    <Badge variant="outline">Frontend</Badge>
                  </Specimen>
                  <Specimen label="Status" hint={'variant="success"'}>
                    <Badge variant="success">
                      <CircleCheck />
                      Aprovado
                    </Badge>
                    <Badge variant="warning">
                      <TriangleAlert />
                      Pendente
                    </Badge>
                    <Badge variant="destructive">
                      <CircleX />
                      Falhou
                    </Badge>
                    <Badge variant="info">
                      <Info />
                      Em revisão
                    </Badge>
                  </Specimen>
                </Card>
              </Section>

              <Section
                id="cards"
                title="Cards"
                description="Borda sutil, sombra difusa e cantos de 12px. Use quando a elevação ajuda a separar conteúdo."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Entrega final</CardTitle>
                      <CardDescription>Sábado às 18h. O repositório precisa estar público.</CardDescription>
                      <CardAction>
                        <Badge variant="warning">
                          <TriangleAlert />
                          Pendente
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid gap-2.5 text-sm">
                        {deliveryChecklist.map((item) => (
                          <li key={item.label} className="flex items-center gap-2.5">
                            {item.done ? (
                              <CircleCheck className="size-4 text-success" />
                            ) : (
                              <Circle className="size-4 text-muted-foreground" />
                            )}
                            <span className="sr-only">{item.done ? "Concluído:" : "A fazer:"}</span>
                            <span className={item.done ? "text-muted-foreground" : "text-foreground"}>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter className="border-t text-[13px] text-muted-foreground">2 de 3 itens prontos</CardFooter>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Rodar localmente</CardTitle>
                      <CardDescription>Instale as dependências e suba o servidor de desenvolvimento.</CardDescription>
                      <CardAction>
                        <CopyButton value="npm install && npm run dev" />
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <pre className="overflow-x-auto rounded-lg border bg-muted/60 px-4 py-3 font-mono text-[13px] text-foreground">
                        <code>npm install && npm run dev</code>
                      </pre>
                    </CardContent>
                    <CardFooter className="border-t text-[13px] text-muted-foreground">
                      Requer Node 20.9 ou superior.
                    </CardFooter>
                  </Card>

                  <Card asChild interactive>
                    <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer">
                      <CardHeader>
                        <CardTitle>Biblioteca de ícones</CardTitle>
                        <CardDescription>Todos os ícones do Lucide já seguem o traço padrão do kit.</CardDescription>
                      </CardHeader>
                      <CardContent aria-hidden="true" className="flex flex-wrap gap-2 text-muted-foreground">
                        {[Rocket, Search, Palette, Bell, Users, GitBranch, Zap, Layers].map((Icon) => (
                          <span key={Icon.displayName} className="grid size-9 place-items-center rounded-md border bg-muted/40">
                            <Icon className="size-4" />
                          </span>
                        ))}
                      </CardContent>
                      <CardFooter className="gap-1 text-sm font-medium text-brand">
                        Abrir lucide.dev
                        <ArrowUpRight className="size-4" />
                        <span className="sr-only">(abre em nova aba)</span>
                      </CardFooter>
                    </a>
                  </Card>

                  <Card>
                    <CardContent className="flex flex-col items-center gap-4 py-4 text-center">
                      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                        <Rocket className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <CardTitle>Nenhum deploy ainda</CardTitle>
                        <CardDescription>Conecte o repositório para publicar a primeira versão.</CardDescription>
                      </div>
                      <Button variant="outline" size="sm">
                        <Plus />
                        Conectar repositório
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </Section>

              <Section
                id="cores"
                title="Cores"
                description={
                  <>
                    Tokens semânticos em OKLCH, com contraste AA nos dois temas. Para mudar a marca, edite{" "}
                    <Code>--brand</Code> em <Code>app/globals.css</Code>.
                  </>
                }
              >
                <ColorTokens />
              </Section>

              <Section
                id="tipografia"
                title="Tipografia"
                description="Geist na interface e Geist Mono para código. Títulos com tracking negativo, corpo em text-sm e text-base."
              >
                <TypeScale />
              </Section>

              <Section
                id="movimento"
                title="Movimento"
                description="Animações curtas, só com opacidade e transform. Todas desligam com prefers-reduced-motion."
              >
                <MotionDemo />
              </Section>
            </div>
          </PageWrapper>
        </main>
      </div>
    </>
  );
}

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md text-[15px] font-semibold tracking-[-0.02em] text-foreground"
    >
      <span className="grid size-7 place-items-center rounded-md bg-brand text-brand-foreground shadow-xs">
        <Hexagon className="size-4" strokeWidth={2.25} />
      </span>
      {site.name}
    </Link>
  );
}

function ProfileAvatar({ name, initials }: { name: string; initials: string }) {
  return (
    <span
      title={name}
      className="ml-1 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border"
    >
      <span aria-hidden="true">{initials}</span>
      <span className="sr-only">Perfil: {name}</span>
    </span>
  );
}
