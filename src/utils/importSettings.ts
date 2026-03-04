export type ImportMergeMode = "normal" | "split_when_possible";

export interface ImportSettings {
  mergeMode: ImportMergeMode;
  timeThresholdSec: number;
}

const STORAGE_KEY = "tradelog_import_settings";

const DEFAULTS: ImportSettings = {
  mergeMode: "split_when_possible",
  timeThresholdSec: 300,
};

export const loadImportSettings = (): ImportSettings => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return DEFAULTS;
    const parsed = JSON.parse(data);
    return {
      mergeMode: parsed.mergeMode ?? DEFAULTS.mergeMode,
      timeThresholdSec: Number(parsed.timeThresholdSec) || DEFAULTS.timeThresholdSec,
    };
  } catch {
    return DEFAULTS;
  }
};

export const saveImportSettings = (settings: ImportSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Error saving import settings:", e);
  }
};
