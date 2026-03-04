import type { IndicatorKey } from "./indicatorPresets";

/** Source for price-based inputs (VWAP, etc.) */
export const VWAP_SOURCE_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
  { value: "close", label: "Close" },
  { value: "hl2", label: "hl2" },
  { value: "hlc3", label: "hlc3" },
  { value: "ohlc4", label: "ohlc4" },
] as const;

/** Anchor period for VWAP */
export const VWAP_ANCHOR_OPTIONS = [
  { value: "session", label: "Session" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "decade", label: "Decade" },
  { value: "century", label: "Century" },
] as const;

/** Precision for display */
export const PRECISION_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
] as const;

export type IndicatorInputDef =
  | { type: "number"; key: string; label: string; min?: number; max?: number; default: number }
  | { type: "select"; key: string; label: string; options: readonly { value: string; label: string }[]; default: string };

export type IndicatorStyleSettings = {
  color: string;
  lineWidth: number;
  precision: string;
  labelsOnPriceScale: boolean;
  valuesInStatusLine: boolean;
};

export type VisibilityRange = { min: number; max: number; enabled: boolean };
export type IndicatorVisibilitySettings = {
  minutes: VisibilityRange;
  hours: VisibilityRange;
  days: VisibilityRange;
  weeks: VisibilityRange;
  months: VisibilityRange;
};

export type IndicatorSettings = {
  inputs: Record<string, number | string>;
  style: IndicatorStyleSettings;
  visibility: IndicatorVisibilitySettings;
};

const defaultVisibility = (): IndicatorVisibilitySettings => ({
  minutes: { min: 1, max: 59, enabled: true },
  hours: { min: 1, max: 24, enabled: true },
  days: { min: 1, max: 366, enabled: true },
  weeks: { min: 1, max: 52, enabled: true },
  months: { min: 1, max: 12, enabled: true },
});

const defaultStyle = (): IndicatorStyleSettings => ({
  color: "#ffffff",
  lineWidth: 2,
  precision: "default",
  labelsOnPriceScale: true,
  valuesInStatusLine: true,
});

/** Input definitions per indicator (only keys with custom inputs listed; rest use period where applicable) */
export const INDICATOR_INPUT_DEFS: Partial<Record<IndicatorKey, IndicatorInputDef[]>> = {
  vwap: [
    { type: "select", key: "source", label: "Source", options: VWAP_SOURCE_OPTIONS, default: "hlc3" },
    { type: "select", key: "anchorPeriod", label: "Anchor Period", options: VWAP_ANCHOR_OPTIONS, default: "session" },
  ],
  sma20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  ema9: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 9 }],
  ema20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  wma20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  dema20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  tema20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  kama20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  linearreg20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  bbands20: [
    { type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 },
    { type: "number", key: "stdDev", label: "StdDev", min: 0.5, max: 5, default: 2 },
  ],
  accbands20: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 20 }],
  midpoint14: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 14 }],
  midprice14: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 14 }],
  t3_5: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 5 }],
  trima30: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 30 }],
  tsf14: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 14 }],
  atr14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  natr14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  rsi14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  macd: [
    { type: "number", key: "fastPeriod", label: "Fast Length", min: 1, max: 100, default: 12 },
    { type: "number", key: "slowPeriod", label: "Slow Length", min: 1, max: 100, default: 26 },
    { type: "number", key: "signalPeriod", label: "Signal Smoothing", min: 1, max: 100, default: 9 },
  ],
  macdfix: [{ type: "number", key: "signalPeriod", label: "Signal Smoothing", min: 1, max: 100, default: 9 }],
  stochastic: [
    { type: "number", key: "fastK_Period", label: "Fast %K", min: 1, max: 100, default: 14 },
    { type: "number", key: "slowK_Period", label: "Slow %K", min: 1, max: 100, default: 3 },
    { type: "number", key: "slowD_Period", label: "Slow %D", min: 1, max: 100, default: 3 },
  ],
  stochFast: [
    { type: "number", key: "fastK_Period", label: "Fast %K", min: 1, max: 100, default: 5 },
    { type: "number", key: "fastD_Period", label: "Fast %D", min: 1, max: 100, default: 3 },
  ],
  stochasticRsi: [
    { type: "number", key: "timePeriod", label: "RSI Length", min: 1, max: 100, default: 14 },
    { type: "number", key: "fastK_Period", label: "Fast %K", min: 1, max: 100, default: 5 },
    { type: "number", key: "fastD_Period", label: "Fast %D", min: 1, max: 100, default: 3 },
  ],
  cci20: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 20 }],
  williamsR14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  adx14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  adxr14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  apo: [
    { type: "number", key: "fastPeriod", label: "Fast Length", min: 1, max: 100, default: 12 },
    { type: "number", key: "slowPeriod", label: "Slow Length", min: 1, max: 100, default: 26 },
  ],
  aroon14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  aroonosc14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  ppo: [
    { type: "number", key: "fastPeriod", label: "Fast Length", min: 1, max: 100, default: 12 },
    { type: "number", key: "slowPeriod", label: "Slow Length", min: 1, max: 100, default: 26 },
  ],
  roc12: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 12 }],
  rocp10: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 10 }],
  adosc: [
    { type: "number", key: "fastPeriod", label: "Fast Length", min: 1, max: 100, default: 3 },
    { type: "number", key: "slowPeriod", label: "Slow Length", min: 1, max: 100, default: 10 },
  ],
  mfi14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  trix15: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 15 }],
  mom10: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 10 }],
  cmo14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  ultosc: [
    { type: "number", key: "timePeriod1", label: "Period 1", min: 1, max: 100, default: 7 },
    { type: "number", key: "timePeriod2", label: "Period 2", min: 1, max: 100, default: 14 },
    { type: "number", key: "timePeriod3", label: "Period 3", min: 1, max: 100, default: 28 },
  ],
  dx14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  imi14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  plusDi14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  minusDi14: [{ type: "number", key: "period", label: "Length", min: 1, max: 100, default: 14 }],
  linearRegAngle14: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 14 }],
  linearRegSlope14: [{ type: "number", key: "period", label: "Length", min: 1, max: 500, default: 14 }],
};

/** Default inputs for indicators not in INDICATOR_INPUT_DEFS (e.g. period from preset name) */
function getDefaultInputs(key: IndicatorKey): Record<string, number | string> {
  const defs = INDICATOR_INPUT_DEFS[key];
  if (defs) {
    const out: Record<string, number | string> = {};
    for (const d of defs) out[d.key] = d.default;
    return out;
  }
  return {};
}

export function getDefaultIndicatorSettings(key: IndicatorKey): IndicatorSettings {
  return {
    inputs: getDefaultInputs(key),
    style: defaultStyle(),
    visibility: defaultVisibility(),
  };
}

export function getIndicatorInputDefs(key: IndicatorKey): IndicatorInputDef[] {
  return INDICATOR_INPUT_DEFS[key] ?? [];
}
