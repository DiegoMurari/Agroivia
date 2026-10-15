import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Gera os PNG dos diagramas: lê os blocos ```mermaid dos .md de docs/artefatos/, renderiza com a
 * biblioteca mermaid no Chromium do Playwright (sem rede) e grava em docs/artefatos/img/.
 *   npm run artefatos:png            → todos os .md
 *   npm run artefatos:png -- der     → só docs/artefatos/der.md
 * Nome do arquivo: <artefato>-<n>.png, na ordem dos blocos.
 */

const ARTEFATOS = path.resolve("..", "docs", "artefatos");
const SAIDA = path.join(ARTEFATOS, "img");
const MERMAID = path.resolve("node_modules", "mermaid", "dist", "mermaid.min.js");
const ESCALA = 2;

function blocosMermaid(markdown: string): string[] {
  return [...markdown.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
}

async function main(): Promise<void> {
  const filtro = process.argv.slice(2);
  const arquivos = fs
    .readdirSync(ARTEFATOS)
    .filter((nome) => nome.endsWith(".md"))
    .filter((nome) => filtro.length === 0 || filtro.includes(path.basename(nome, ".md")));
  fs.mkdirSync(SAIDA, { recursive: true });

  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ deviceScaleFactor: ESCALA, viewport: { width: 2400, height: 1600 } });
    await pagina.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="alvo" style="display:inline-block;padding:24px"></div></body></html>');
    await pagina.addScriptTag({ path: MERMAID });
    await pagina.evaluate(() => {
      // @ts-expect-error mermaid vem do script injetado na página
      window.mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose", er: { useMaxWidth: false }, flowchart: { useMaxWidth: false } });
    });

    let gerados = 0;
    for (const arquivo of arquivos) {
      const blocos = blocosMermaid(fs.readFileSync(path.join(ARTEFATOS, arquivo), "utf8"));
      for (const [i, codigo] of blocos.entries()) {
        const destino = path.join(SAIDA, `${path.basename(arquivo, ".md")}-${i + 1}.png`);
        await pagina.evaluate(async ([texto, id]) => {
          // @ts-expect-error mermaid vem do script injetado na página
          const { svg } = await window.mermaid.render(id, texto);
          document.getElementById("alvo")!.innerHTML = svg;
        }, [codigo, `diagrama${gerados}`] as const);
        await pagina.locator("#alvo").screenshot({ path: destino });
        gerados++;
        console.log(`${arquivo} bloco ${i + 1} → ${path.relative(path.resolve(".."), destino)}`);
      }
    }
    console.log(`${gerados} PNG gerados em docs/artefatos/img/.`);
  } finally {
    await navegador.close();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
