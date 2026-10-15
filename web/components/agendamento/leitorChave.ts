/**
 * Leitura da chave de acesso (44 números) no código de barras da NF-e, a partir de um quadro da câmera ou de uma foto.
 * O código da DANFE é pequeno: por isso cada quadro é lido em várias regiões, ampliadas, antes de desistir.
 */

type Regiao = { x: number; y: number; w: number; h: number; girar?: boolean };

interface DetectorNativo {
  detect: (fonte: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

const so44 = (texto: string) => {
  const d = texto.replace(/\D/g, "");
  return d.length === 44 ? d : null;
};

/** Regiões de um quadro ao vivo: a faixa da moldura primeiro (é onde a pessoa encaixa o código), depois o quadro todo. */
export const REGIOES_AO_VIVO: Regiao[] = [
  { x: 0.08, y: 0.33, w: 0.84, h: 0.34 },
  { x: 0, y: 0, w: 1, h: 1 },
];

/** Regiões de uma foto da nota inteira: o código pode estar em qualquer parte da folha, em qualquer orientação. */
export const REGIOES_DE_FOTO: Regiao[] = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 0, y: 0, w: 1, h: 0.4 },
  { x: 0, y: 0.3, w: 1, h: 0.4 },
  { x: 0, y: 0.6, w: 1, h: 0.4 },
  { x: 0, y: 0, w: 1, h: 1, girar: true },
];

export async function criarLeitor() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  const hints = new Map<number, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.ITF]);
  const zxing = new BrowserMultiFormatReader(hints as Map<never, never>);
  const Nativo = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorNativo }).BarcodeDetector;
  const nativo = Nativo ? new Nativo({ formats: ["code_128", "itf"] }) : null;
  const trabalho = document.createElement("canvas");
  const ctx = trabalho.getContext("2d", { willReadFrequently: true })!;

  /** Desenha a região (ampliada até ter largura útil) no canvas de trabalho. */
  function recortar(fonte: CanvasImageSource, larg: number, alt: number, r: Regiao) {
    const sx = Math.round(r.x * larg);
    const sy = Math.round(r.y * alt);
    const sw = Math.max(1, Math.round(r.w * larg));
    const sh = Math.max(1, Math.round(r.h * alt));
    const escala = sw < 1600 ? 1600 / sw : 1; // amplia regiões pequenas: barras de 1 pixel viram 2 ou 3
    const dw = Math.round((r.girar ? sh : sw) * escala);
    const dh = Math.round((r.girar ? sw : sh) * escala);
    trabalho.width = dw;
    trabalho.height = dh;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, dw, dh);
    if (r.girar) {
      ctx.save();
      ctx.translate(dw, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, sw * escala, sh * escala);
      ctx.restore();
    } else ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, dw, dh);
  }

  /** Procura a chave nas regiões, na ordem. Devolve os 44 números ou null. */
  async function ler(fonte: CanvasImageSource, larg: number, alt: number, regioes: Regiao[]): Promise<string | null> {
    for (const r of regioes) {
      recortar(fonte, larg, alt, r);
      try {
        if (nativo) {
          const achados = await nativo.detect(trabalho);
          for (const a of achados) {
            const k = so44(a.rawValue);
            if (k) return k;
          }
        }
        const k = so44(zxing.decodeFromCanvas(trabalho).getText());
        if (k) return k;
      } catch {
        // nada nesta região
      }
    }
    return null;
  }

  return { ler };
}

/** Lê uma foto (arquivo) inteira, no tamanho original. */
export async function lerChaveDeFoto(arquivo: File): Promise<string | null> {
  const bitmap = await createImageBitmap(arquivo);
  try {
    const leitor = await criarLeitor();
    return await leitor.ler(bitmap, bitmap.width, bitmap.height, REGIOES_DE_FOTO);
  } finally {
    bitmap.close();
  }
}
