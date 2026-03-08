/**
 * User-defined Setups and Mistakes for the trade table.
 * Setups are custom-only (no defaults). Trade Style uses a fixed list (Swing, Day Trade, etc.).
 */

const SETUPS_KEY = "tradelog_setups";
const MISTAKES_KEY = "tradelog_mistakes";

/** Fixed options for the Trade Style column (no user editing) */
export const TRADE_STYLE_OPTIONS: string[] = [
  "Breakout",
  "Scalp",
  "Swing",
  "Day Trade",
  "Momentum",
  "Reversal",
  "Other",
];

export function loadTradeStyleOptions(): string[] {
  return [...TRADE_STYLE_OPTIONS];
}

export function loadCustomSetups(): string[] {
  try {
    const raw = localStorage.getItem(SETUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveCustomSetups(items: string[]): void {
  try {
    localStorage.setItem(SETUPS_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/** Setup options: custom only (user adds their own in Settings → Setups) */
export function loadSetupOptions(): string[] {
  return loadCustomSetups();
}

export function loadMistakeOptions(): string[] {
  try {
    const raw = localStorage.getItem(MISTAKES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveMistakeOptions(items: string[]): void {
  try {
    localStorage.setItem(MISTAKES_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
