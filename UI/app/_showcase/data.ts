/** Dados de exemplo do style guide. Substitua pelos dados reais do projeto. */

export type Trend = "up" | "down";

export interface Kpi {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; period: string; trend: Trend; good: boolean };
  /** 0 a 1. Mostra um medidor abaixo do valor. */
  progress?: number;
  progressLabel?: string;
}

export const kpis: Kpi[] = [
  {
    label: "Deploys hoje",
    value: "38",
    delta: { value: "+6", period: "vs ontem", trend: "up", good: true },
  },
  {
    label: "Tempo médio de build",
    value: "47",
    unit: "s",
    delta: { value: "-8 s", period: "vs ontem", trend: "down", good: true },
  },
  {
    label: "Erros em produção",
    value: "3",
    delta: { value: "+2", period: "vs ontem", trend: "up", good: false },
  },
  {
    label: "Tarefas concluídas",
    value: "21",
    unit: "de 34",
    progress: 21 / 34,
    progressLabel: "62% do backlog",
  },
];

export const deploysPerDay: { day: string; value: number }[] = [
  { day: "18 set", value: 12 },
  { day: "19 set", value: 18 },
  { day: "20 set", value: 9 },
  { day: "21 set", value: 22 },
  { day: "22 set", value: 27 },
  { day: "23 set", value: 15 },
  { day: "24 set", value: 8 },
  { day: "25 set", value: 19 },
  { day: "26 set", value: 24 },
  { day: "27 set", value: 31 },
  { day: "28 set", value: 17 },
  { day: "29 set", value: 26 },
  { day: "30 set", value: 29 },
  { day: "Hoje", value: 38 },
];

export type ActivityStatus = "live" | "building" | "failed" | "review";

export interface Activity {
  name: string;
  initials: string;
  action: string;
  time: string;
  status: ActivityStatus;
}

export const activity: Activity[] = [
  { name: "Luana Prado", initials: "LP", action: "Deploy de main", time: "há 4 min", status: "live" },
  {
    name: "Caio Ventura",
    initials: "CV",
    action: "Preview de feat/onboarding",
    time: "há 18 min",
    status: "building",
  },
  {
    name: "Bia Nakamura",
    initials: "BN",
    action: "Deploy de fix/limite-upload",
    time: "há 1 h",
    status: "failed",
  },
  {
    name: "Tomás Herrera",
    initials: "TH",
    action: "PR #42: tela de pagamento",
    time: "há 3 h",
    status: "review",
  },
];
