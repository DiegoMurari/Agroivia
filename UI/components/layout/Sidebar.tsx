"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  label: string;
  /** Rota ("/projetos") ou âncora da página ("#botoes"). */
  href: string;
  /** Elemento do ícone, ex.: <LayoutDashboard />. Funciona em Server Components. */
  icon: React.ReactNode;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps extends Omit<React.ComponentProps<"aside">, "children"> {
  sections: SidebarSection[];
  /** Estado inicial quando não controlado. */
  defaultCollapsed?: boolean;
  /** Modo controlado. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Nome acessível da navegação. */
  label?: string;
}

/**
 * Barra lateral recolhível com ícones.
 * - Desktop (md+): coluna fixa que recolhe para só ícones (com tooltip).
 * - Mobile: vira uma faixa horizontal rolável abaixo do Navbar.
 * - Item ativo: rota atual ou, para links "#âncora", a seção visível na tela.
 *
 * Coloque dentro de um container `flex flex-col md:flex-row`, ao lado do <main>.
 */
export function Sidebar({
  sections,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  label = "Navegação lateral",
  className,
  ...props
}: SidebarProps) {
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = React.useState(defaultCollapsed);
  const collapsed = collapsedProp ?? uncontrolledCollapsed;
  const generatedId = React.useId();
  const asideId = props.id ?? generatedId;

  const items = sections.flatMap((section) => section.items);
  const activeHref = useActiveHref(items.map((item) => item.href));

  function toggle() {
    const next = !collapsed;
    if (collapsedProp === undefined) setUncontrolledCollapsed(next);
    onCollapsedChange?.(next);
  }

  return (
    <>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "sticky top-(--header-height) z-30 hidden h-[calc(100dvh-var(--header-height))] w-60 shrink-0 flex-col md:flex",
          "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[width] duration-200 ease-out-expo data-[collapsed=true]:w-16",
          className,
        )}
        {...props}
        id={asideId}
      >
        <nav aria-label={label} className={cn("flex-1 px-3 py-4", collapsed ? "overflow-visible" : "overflow-y-auto")}>
          {sections.map((section, index) => (
            <div key={section.title ?? index} className="mb-6 last:mb-0">
              {section.title &&
                (collapsed ? (
                  <div aria-hidden="true" className="mx-auto mb-2 h-px w-5 bg-sidebar-border" />
                ) : (
                  <p className="mb-1.5 truncate px-3 text-xs font-medium text-muted-foreground">{section.title}</p>
                ))}
              <ul className="grid gap-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink item={item} active={activeHref === item.href} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-controls={asideId}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            className={cn(
              "w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
              collapsed && "justify-center px-0 has-[>svg]:px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!collapsed && <span>Recolher</span>}
          </Button>
        </div>
      </aside>

      <nav
        aria-label={label}
        className={cn(
          "sticky top-(--header-height) z-30 border-b bg-background/80 backdrop-blur-xl md:hidden",
          "[@media(prefers-reduced-transparency:reduce)]:bg-background",
        )}
      >
        <ul className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <li key={item.href} className="shrink-0">
              <SidebarLink item={item} active={activeHref === item.href} compact />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function SidebarLink({
  item,
  active,
  collapsed = false,
  compact = false,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed?: boolean;
  /** Versão em pílula para a faixa horizontal do mobile. */
  compact?: boolean;
}) {
  const ariaCurrent = active ? (item.href.startsWith("#") ? "true" : "page") : undefined;

  if (compact) {
    return (
      <Link
        href={item.href}
        aria-current={ariaCurrent}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
          active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <ItemIcon>{item.icon}</ItemIcon>
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={ariaCurrent}
      className={cn(
        "group/item relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 -left-3 w-0.5 rounded-full bg-brand" />}
      <ItemIcon>{item.icon}</ItemIcon>
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
      {collapsed && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md border bg-popover px-2 py-1",
            "text-xs font-medium whitespace-nowrap text-popover-foreground shadow-elevated",
            "opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-visible/item:opacity-100",
          )}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

function ItemIcon({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
      {children}
    </span>
  );
}

/** Rota atual para links normais; seção visível (scrollspy) para links "#âncora". */
function useActiveHref(hrefs: string[]) {
  const pathname = usePathname();
  const anchorKey = hrefs.filter((href) => href.startsWith("#")).join(" ");
  const [visibleAnchor, setVisibleAnchor] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!anchorKey) return;
    const ids = anchorKey.split(" ").map((href) => href.slice(1));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setVisibleAnchor(`#${first}`);
      },
      // Faixa de ativação: logo abaixo do cabeçalho até 40% da altura da tela
      { rootMargin: "-80px 0px -60% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [anchorKey]);

  const routeMatch = hrefs.find(
    (href) =>
      href.startsWith("/") &&
      (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)),
  );

  return routeMatch ?? visibleAnchor ?? hrefs.find((href) => href.startsWith("#"));
}
