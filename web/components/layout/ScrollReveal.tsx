"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Superfícies que entram com animação: cards, tabelas e blocos de seção. */
const ALVOS = "[data-reveal], main .shadow-card, main table, main [data-slot='card']";

/**
 * Faz os cards surgirem ao abrir a tela e conforme a rolagem chega neles.
 * Usa só atributos `data-rv` (o React não mexe neles) e CSS de opacity/transform em globals.css.
 * Sem JavaScript ou com `prefers-reduced-motion`, tudo aparece normalmente.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.getElementById("main-content");
    if (!main) return;

    const marcados = new Set<Element>();
    let fila = 0;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          const el = e.target as HTMLElement;
          // escalona os que aparecem juntos
          el.style.setProperty("--rv-delay", `${Math.min(fila++, 5) * 35}ms`);
          requestAnimationFrame(() => el.setAttribute("data-rv", "in"));
        }
        window.setTimeout(() => (fila = 0), 80);
      },
      { rootMargin: "0px 0px 160px 0px", threshold: 0 },
    );

    const varrer = () => {
      main.querySelectorAll(ALVOS).forEach((el) => {
        if (marcados.has(el) || el.hasAttribute("data-rv")) return;
        // só o card externo: o que está dentro de outro já vem junto
        if (el.parentElement?.closest(ALVOS) && main.contains(el.parentElement.closest(ALVOS))) return;
        marcados.add(el);
        el.setAttribute("data-rv", "out");
        io.observe(el);
      });
    };
    varrer();
    // conteúdo que chega depois (listas atualizadas, abas) também entra
    const mo = new MutationObserver(() => varrer());
    mo.observe(main, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      main.querySelectorAll("[data-rv]").forEach((el) => el.removeAttribute("data-rv"));
    };
  }, [pathname]);

  return null;
}
