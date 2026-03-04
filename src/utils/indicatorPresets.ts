export type IndicatorPane = "overlay" | "oscillator";

/**
 * TA-Lib (talib-web) chart-friendly indicators only.
 * Excludes: math/trig, candlestick patterns, pure stats, min/max/index.
 * See docs/TALIB_WEB_FUNCTIONS.md for full list.
 */
export type IndicatorKey =
  // Overlays
  | "vwap"
  | "sma20"
  | "ema9"
  | "ema20"
  | "wma20"
  | "dema20"
  | "tema20"
  | "kama20"
  | "linearreg20"
  | "bbands20"
  | "accbands20"
  | "mama"
  | "midpoint14"
  | "midprice14"
  | "t3_5"
  | "trima30"
  | "tsf14"
  | "atr14"
  | "natr14"
  | "psar"
  | "sarext"
  | "avgprice"
  | "medprice"
  | "typprice"
  | "wclprice"
  // Oscillators
  | "rsi14"
  | "macd"
  | "macdfix"
  | "stochastic"
  | "stochFast"
  | "stochasticRsi"
  | "cci20"
  | "williamsR14"
  | "adx14"
  | "adxr14"
  | "apo"
  | "aroon14"
  | "aroonosc14"
  | "ppo"
  | "roc12"
  | "rocp10"
  | "obv"
  | "mfi14"
  | "trix15"
  | "adl"
  | "adosc"
  | "mom10"
  | "cmo14"
  | "ultosc"
  | "bop"
  | "dx14"
  | "imi14"
  | "plusDi14"
  | "minusDi14"
  | "linearRegAngle14"
  | "linearRegSlope14";

export type IndicatorPreset = {
  key: IndicatorKey;
  label: string;
  pane: IndicatorPane;
};

/** Chart presets: overlays + oscillators from TA-Lib + custom VWAP */
export const INDICATOR_PRESETS: IndicatorPreset[] = [
  // Overlays
  { key: "vwap", label: "VWAP", pane: "overlay" },
  { key: "sma20", label: "SMA (20)", pane: "overlay" },
  { key: "ema9", label: "EMA (9)", pane: "overlay" },
  { key: "ema20", label: "EMA (20)", pane: "overlay" },
  { key: "wma20", label: "WMA (20)", pane: "overlay" },
  { key: "dema20", label: "DEMA (20)", pane: "overlay" },
  { key: "tema20", label: "TEMA (20)", pane: "overlay" },
  { key: "kama20", label: "KAMA (20)", pane: "overlay" },
  { key: "linearreg20", label: "Linear Regression (20)", pane: "overlay" },
  { key: "bbands20", label: "Bollinger Bands (20, 2)", pane: "overlay" },
  { key: "accbands20", label: "Acceleration Bands (20)", pane: "overlay" },
  { key: "mama", label: "MESA Adaptive MA (MAMA)", pane: "overlay" },
  { key: "midpoint14", label: "Midpoint (14)", pane: "overlay" },
  { key: "midprice14", label: "Midpoint Price (14)", pane: "overlay" },
  { key: "t3_5", label: "T3 (5)", pane: "overlay" },
  { key: "trima30", label: "Triangular MA (30)", pane: "overlay" },
  { key: "tsf14", label: "Time Series Forecast (14)", pane: "overlay" },
  { key: "atr14", label: "Average True Range (14)", pane: "overlay" },
  { key: "natr14", label: "Normalized ATR (14)", pane: "overlay" },
  { key: "psar", label: "Parabolic SAR", pane: "overlay" },
  { key: "sarext", label: "Parabolic SAR Extended", pane: "overlay" },
  { key: "avgprice", label: "Average Price", pane: "overlay" },
  { key: "medprice", label: "Median Price", pane: "overlay" },
  { key: "typprice", label: "Typical Price", pane: "overlay" },
  { key: "wclprice", label: "Weighted Close Price", pane: "overlay" },
  // Oscillators
  { key: "rsi14", label: "RSI (14)", pane: "oscillator" },
  { key: "macd", label: "MACD (12, 26, 9)", pane: "oscillator" },
  { key: "macdfix", label: "MACD Fix (12, 26)", pane: "oscillator" },
  { key: "stochastic", label: "Stochastic (14, 3, 3)", pane: "oscillator" },
  { key: "stochFast", label: "Stochastic Fast", pane: "oscillator" },
  { key: "stochasticRsi", label: "Stochastic RSI (14, 3, 3)", pane: "oscillator" },
  { key: "cci20", label: "Commodity Channel Index (20)", pane: "oscillator" },
  { key: "williamsR14", label: "Williams %R (14)", pane: "oscillator" },
  { key: "adx14", label: "Average Directional Index (14)", pane: "oscillator" },
  { key: "adxr14", label: "ADX Rating (14)", pane: "oscillator" },
  { key: "apo", label: "Absolute Price Oscillator (12, 26)", pane: "oscillator" },
  { key: "aroon14", label: "Aroon (14)", pane: "oscillator" },
  { key: "aroonosc14", label: "Aroon Oscillator (14)", pane: "oscillator" },
  { key: "ppo", label: "Percentage Price Oscillator (12, 26, 9)", pane: "oscillator" },
  { key: "roc12", label: "Rate of Change (12)", pane: "oscillator" },
  { key: "rocp10", label: "ROC Percentage (10)", pane: "oscillator" },
  { key: "obv", label: "On Balance Volume", pane: "oscillator" },
  { key: "mfi14", label: "Money Flow Index (14)", pane: "oscillator" },
  { key: "trix15", label: "TRIX (15)", pane: "oscillator" },
  { key: "adl", label: "Accumulation/Distribution", pane: "oscillator" },
  { key: "adosc", label: "Chaikin A/D Oscillator (3, 10)", pane: "oscillator" },
  { key: "mom10", label: "Momentum (10)", pane: "oscillator" },
  { key: "cmo14", label: "Chande Momentum Oscillator (14)", pane: "oscillator" },
  { key: "ultosc", label: "Ultimate Oscillator (7, 14, 28)", pane: "oscillator" },
  { key: "bop", label: "Balance of Power", pane: "oscillator" },
  { key: "dx14", label: "Directional Movement Index (14)", pane: "oscillator" },
  { key: "imi14", label: "Intraday Momentum Index (14)", pane: "oscillator" },
  { key: "plusDi14", label: "Plus Directional Indicator (14)", pane: "oscillator" },
  { key: "minusDi14", label: "Minus Directional Indicator (14)", pane: "oscillator" },
  { key: "linearRegAngle14", label: "Linear Reg Angle (14)", pane: "oscillator" },
  { key: "linearRegSlope14", label: "Linear Reg Slope (14)", pane: "oscillator" },
];

export const INDICATOR_PRESET_BY_KEY: Record<IndicatorKey, IndicatorPreset> = Object.fromEntries(
  INDICATOR_PRESETS.map((p) => [p.key, p])
) as Record<IndicatorKey, IndicatorPreset>;
