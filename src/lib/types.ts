export type StageKey = "general" | "preparation" | "experience" | "post";
export type Status = "done" | "nodiff" | "attention" | "missing";

export const STAGE_LABEL: Record<StageKey, string> = {
  general: "General documents",
  preparation: "Preparation",
  experience: "Experience",
  post: "Post-experience",
};
export const STAGE_ORDER: StageKey[] = ["general", "preparation", "experience", "post"];

export interface ItemDef {
  key: string;
  label: string;
  slug: string;
  stage: StageKey;
  standard: string; // e.g. "01 Personal Goal Setting"
  folder: string[]; // Drive path under the EP folder (without the item subfolder)
  owner?: "Home" | "Host";
  multi: boolean; // accepts several files (stored in its own subfolder)
  optional: boolean; // "(if change)" rows: can be marked "No difference"
  creditOnly: boolean;
  inRealization: boolean;
  mirrorsPrep: boolean; // one upload also fills the Preparation tab
}

export interface ItemState {
  status: Status;
  link?: string;
  note?: string;
  prepSynced?: boolean; // only meaningful when item.mirrorsPrep
}

export interface StageCount { done: number; total: number }

export interface EpView {
  key: string;
  name: string;
  short: string;
  breakTag?: string;
  number?: number;
  responsible: string;
  program: string;
  hostLC: string;
  credit: boolean;
  hasPrep: boolean;
  states: Record<string, ItemState>;
  done: number;
  total: number;
  attention: number;
  stages: Record<StageKey, StageCount>;
}

export interface Snapshot {
  eps: EpView[];
  items: ItemDef[];
  warnings: string[];
  sheetUrl: string;
  demo: boolean;
}

export const CHUNK_SIZE = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const MAX_FILE_BYTES = 250 * 1024 * 1024;
