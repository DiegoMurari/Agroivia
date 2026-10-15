"use client";

import * as React from "react";
import { Camera, CameraOff, ImageUp, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { criarLeitor, lerChaveDeFoto, REGIOES_AO_VIVO } from "./leitorChave";

type Estado = "iniciando" | "lendo" | "negada" | "sem_camera" | "erro";

interface Props {
  /** Chamado uma vez, com os 44 números da chave de acesso lida no código de barras. A câmera desliga sozinha. */
  aoLer: (chave: string) => void;
  /** Pausa a leitura (por exemplo, enquanto confere com o banco). */
  pausado?: boolean;
  /** Mudar este número religa a câmera (botão "ler outra nota"). */
  ciclo: number;
}

const MENSAGEM: Record<Exclude<Estado, "iniciando" | "lendo">, string> = {
  negada: "A câmera está bloqueada. Libere o uso da câmera no navegador e tente de novo, ou digite a chave.",
  sem_camera: "Este aparelho não tem câmera disponível. Digite a chave ou anexe o XML.",
  erro: "Não foi possível abrir a câmera. Feche outros apps que a usam e tente de novo.",
};

/**
 * Câmera ao vivo que procura o código de barras da NF-e (44 números) e entrega a chave assim que lê.
 * Cada execução cuida do próprio stream: ligar e desligar nunca mexe no vídeo de outra execução
 * (o React roda o efeito duas vezes em desenvolvimento).
 */
export function LeitorCamera({ aoLer, pausado = false, ciclo }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = React.useState<Estado>("iniciando");
  const [tentativa, setTentativa] = React.useState(0);
  const [demora, setDemora] = React.useState(false);
  const [lendoFoto, setLendoFoto] = React.useState(false);
  const [erroFoto, setErroFoto] = React.useState<string | null>(null);
  const fotoRef = React.useRef<HTMLInputElement>(null);
  const aoLerRef = React.useRef(aoLer);
  React.useEffect(() => {
    aoLerRef.current = aoLer;
  });

  React.useEffect(() => {
    if (pausado) return;
    const video = videoRef.current;
    if (!video) return;
    let parado = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let avisoTimer: ReturnType<typeof setTimeout> | undefined;

    function desligar() {
      parado = true;
      setDemora(false);
      if (timer) clearTimeout(timer);
      if (avisoTimer) clearTimeout(avisoTimer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video && video.srcObject === stream) video.srcObject = null;
    }

    async function ligar() {
      setEstado("iniciando");
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("sem_camera");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
        // foco contínuo, quando a câmera deixa: o código pequeno só lê nítido
        await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
        if (parado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video!.srcObject = stream;
        video!.setAttribute("playsinline", "true");
        await video!.play().catch(() => undefined);
        if (parado) return;
        setEstado("lendo");

        const leitor = await criarLeitor();
        if (parado) return;
        avisoTimer = setTimeout(() => setDemora(true), 8000);

        const varrer = async () => {
          if (parado) return;
          try {
            if (video!.readyState >= 2 && video!.videoWidth > 0) {
              const chave = await leitor.ler(video!, video!.videoWidth, video!.videoHeight, REGIOES_AO_VIVO);
              if (chave && !parado) {
                desligar();
                aoLerRef.current(chave);
                return;
              }
            }
          } catch {
            // nenhum código neste quadro: segue procurando
          }
          timer = setTimeout(varrer, 120);
        };
        void varrer();
      } catch (e) {
        if (parado) return;
        const nome = e instanceof DOMException ? e.name : "";
        setEstado(nome === "NotAllowedError" || nome === "SecurityError" ? "negada" : nome === "NotFoundError" || nome === "OverconstrainedError" ? "sem_camera" : "erro");
      }
    }
    void ligar();

    return desligar;
  }, [pausado, ciclo, tentativa]);

  const falhou = estado === "negada" || estado === "sem_camera" || estado === "erro";

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-foreground/90 sm:aspect-video">
        <video ref={videoRef} className="size-full object-cover" muted playsInline autoPlay aria-label="Câmera para ler o código de barras da nota fiscal" />
        {estado === "lendo" && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] top-[33%] h-[34%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)] motion-safe:animate-pulse" />
            <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">Encaixe só o código de barras nesta faixa</span>
          </>
        )}
        {(estado === "iniciando" || falhou) && (
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-card p-6 text-center">
            {falhou ? <CameraOff className="size-10 text-muted-foreground" aria-hidden="true" /> : <Camera className="size-10 animate-pulse text-brand" aria-hidden="true" />}
            <p className="max-w-sm text-base text-muted-foreground" role={falhou ? "alert" : "status"}>
              {falhou ? MENSAGEM[estado] : "Abrindo a câmera. Se o navegador perguntar, toque em Permitir."}
            </p>
          </div>
        )}
      </div>
      <p className="text-base text-muted-foreground" role="status">
        {estado === "lendo"
          ? demora
            ? "Ainda não li. Aproxime a nota até o código de barras ocupar a faixa inteira, com boa luz e sem reflexo. Se não der, tire uma foto."
            : "Aproxime a nota até o código de barras ocupar a faixa. A conferência começa assim que ele for lido."
          : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" loading={lendoFoto} onClick={() => fotoRef.current?.click()}>
          <ImageUp /> Tirar foto da nota
        </Button>
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={async (e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (!arquivo) return;
            setErroFoto(null);
            setLendoFoto(true);
            try {
              const chave = await lerChaveDeFoto(arquivo);
              if (chave) aoLerRef.current(chave);
              else setErroFoto("Não achei o código de barras na foto. Chegue mais perto, deixe a nota reta e com luz, ou digite a chave.");
            } catch {
              setErroFoto("Não consegui abrir a foto. Tente de novo ou digite a chave.");
            }
            setLendoFoto(false);
          }}
        />
        {erroFoto && <p role="alert" className="text-base text-destructive">{erroFoto}</p>}
      </div>
      {falhou && (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setTentativa((n) => n + 1)}>
          <RefreshCw /> Tentar de novo
        </Button>
      )}
    </div>
  );
}
