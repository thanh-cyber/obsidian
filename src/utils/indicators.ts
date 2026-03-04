import {
  AD,
  ADOSC,
  ADX,
  ADXR,
  AROON,
  AROONOSC,
  APO,
  ATR,
  AVGPRICE,
  BBANDS,
  BOP,
  CCI,
  CMO,
  DEMA,
  DX,
  EMA,
  IMI,
  KAMA,
  LINEARREG,
  LINEARREG_ANGLE,
  LINEARREG_SLOPE,
  MACD,
  MACDFIX,
  MAMA,
  MFI,
  MEDPRICE,
  MIDPOINT,
  MIDPRICE,
  MINUS_DI,
  MOM,
  NATR,
  OBV,
  PLUS_DI,
  PPO,
  ROC,
  ROCP,
  RSI,
  SAR,
  SAREXT,
  SMA,
  STOCH,
  STOCHF,
  STOCHRSI,
  T3,
  TEMA,
  TRIMA,
  TRIX,
  TSF,
  TYPPRICE,
  ULTOSC,
  WCLPRICE,
  WILLR,
  WMA,
  ACCBANDS,
} from "talib-web";
import type { IndicatorKey } from "./indicatorPresets";

export type OhlcvBar = {
  timeMs: number;
  timeSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type LinePoint = { time: number; value: number };

export type ComputedIndicatorSeries =
  | { key: "vwap" | "sma20" | "ema9" | "ema20" | "wma20" | "dema20" | "tema20" | "kama20" | "linearreg20" | "midpoint14" | "midprice14" | "t3_5" | "trima30" | "tsf14" | "atr14" | "natr14" | "psar" | "sarext" | "avgprice" | "medprice" | "typprice" | "wclprice" | "rsi14" | "obv" | "roc12" | "rocp10" | "trix15" | "adl" | "cci20" | "williamsR14" | "adx14" | "adxr14" | "apo" | "aroonosc14" | "ppo" | "mfi14" | "mom10" | "cmo14" | "ultosc" | "bop" | "dx14" | "imi14" | "plusDi14" | "minusDi14" | "linearRegAngle14" | "linearRegSlope14"; lines: Record<string, LinePoint[]> }
  | { key: "bbands20" | "accbands20"; lines: { upper: LinePoint[]; middle: LinePoint[]; lower: LinePoint[] } }
  | { key: "mama"; lines: { mama: LinePoint[]; fama: LinePoint[] } }
  | { key: "aroon14"; lines: { up: LinePoint[]; down: LinePoint[] } }
  | { key: "macd" | "macdfix"; lines: { macd: LinePoint[]; signal: LinePoint[]; histogram: LinePoint[] } }
  | { key: "stochastic" | "stochFast" | "stochasticRsi"; lines: { k: LinePoint[]; d: LinePoint[] } };

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function safeBars(bars: OhlcvBar[]): OhlcvBar[] {
  return bars.filter(
    (b) =>
      isFiniteNumber(b.timeMs) &&
      isFiniteNumber(b.timeSec) &&
      isFiniteNumber(b.open) &&
      isFiniteNumber(b.high) &&
      isFiniteNumber(b.low) &&
      isFiniteNumber(b.close) &&
      isFiniteNumber(b.volume)
  );
}

/** Align talib output (same length or shorter, possibly with leading NaN) to bar times. */
function alignTalibToBars(
  bars: OhlcvBar[],
  values: number[],
  firstValueBarIndex: number,
  mapper: (v: number) => number = (v) => v
): LinePoint[] {
  const out: LinePoint[] = [];
  for (let j = 0; j < values.length; j++) {
    const bar = bars[firstValueBarIndex + j];
    if (!bar) break;
    const v = mapper(values[j]);
    if (!Number.isFinite(v)) continue;
    out.push({ time: bar.timeSec, value: v });
  }
  return out;
}

export type VWAPOptions = {
  source?: "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4";
  anchorPeriod?: "session" | "week" | "month" | "quarter" | "year" | "decade" | "century";
};

function vwapPrice(bar: OhlcvBar, source: VWAPOptions["source"]): number {
  const s = source ?? "hlc3";
  switch (s) {
    case "open": return bar.open;
    case "high": return bar.high;
    case "low": return bar.low;
    case "close": return bar.close;
    case "hl2": return (bar.high + bar.low) / 2;
    case "hlc3": return (bar.high + bar.low + bar.close) / 3;
    case "ohlc4": return (bar.open + bar.high + bar.low + bar.close) / 4;
    default: return (bar.high + bar.low + bar.close) / 3;
  }
}

function vwapAnchorKey(timeMs: number, anchorPeriod: VWAPOptions["anchorPeriod"]): string {
  const period = anchorPeriod ?? "session";
  const d = new Date(timeMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const date = d.getUTCDate();
  switch (period) {
    case "session":
      return `${y}-${m}-${date}`;
    case "week": {
      const weekMs = 7 * 24 * 3600 * 1000;
      return `W${Math.floor(timeMs / weekMs)}`;
    }
    case "month":
      return `${y}-${m}`;
    case "quarter":
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case "year":
      return `${y}`;
    case "decade":
      return `D${Math.floor(y / 10) * 10}`;
    case "century":
      return `C${Math.floor(y / 100) * 100}`;
    default:
      return `${y}-${m}-${date}`;
  }
}

function computeVWAP(barsIn: OhlcvBar[], options?: VWAPOptions): LinePoint[] {
  const bars = safeBars(barsIn);
  const source = (options?.source as VWAPOptions["source"]) ?? "hlc3";
  const anchorPeriod = (options?.anchorPeriod as VWAPOptions["anchorPeriod"]) ?? "session";
  let cumulativePV = 0;
  let cumulativeV = 0;
  let lastAnchorKey: string | null = null;
  const out: LinePoint[] = [];

  for (const b of bars) {
    const anchorKey = vwapAnchorKey(b.timeMs, anchorPeriod);
    if (lastAnchorKey !== null && anchorKey !== lastAnchorKey) {
      cumulativePV = 0;
      cumulativeV = 0;
    }
    lastAnchorKey = anchorKey;
    const price = vwapPrice(b, source);
    const v = Math.max(0, b.volume);
    cumulativePV += price * v;
    cumulativeV += v;
    if (cumulativeV <= 0) continue;
    out.push({ time: b.timeSec, value: cumulativePV / cumulativeV });
  }
  return out;
}

/** TA-Lib output length: often same as input with leading NaN, or inputLength - lookback. */
function firstBarIndex(barsLength: number, outputLength: number): number {
  return Math.max(0, barsLength - outputLength);
}

/** Read numeric input from settings with fallback; optional min/max clamp. */
function numIn(
  inputs: Record<string, number | string> | undefined,
  key: string,
  def: number,
  min?: number,
  max?: number
): number {
  const v = inputs?.[key];
  let n = def;
  if (typeof v === "number" && Number.isFinite(v)) n = v;
  else if (typeof v === "string") {
    const x = Number(v);
    if (Number.isFinite(x)) n = x;
  }
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
}

export function computeIndicatorSeries(
  key: IndicatorKey,
  barsIn: OhlcvBar[],
  inputs?: Record<string, number | string>
): ComputedIndicatorSeries | null {
  const bars = safeBars(barsIn);
  if (bars.length === 0) return null;

  const opens = bars.map((b) => b.open);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  try {
    switch (key) {
      case "vwap": {
        const source = (inputs?.source as VWAPOptions["source"]) ?? "hlc3";
        const anchorPeriod = (inputs?.anchorPeriod as VWAPOptions["anchorPeriod"]) ?? "session";
        return { key, lines: { vwap: computeVWAP(bars, { source, anchorPeriod }) } };
      }

      case "sma20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = SMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { sma: alignTalibToBars(bars, r.output, start) } };
      }
      case "ema9": {
        const period = numIn(inputs, "period", 9, 1, 500);
        const r = EMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { ema: alignTalibToBars(bars, r.output, start) } };
      }
      case "ema20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = EMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { ema: alignTalibToBars(bars, r.output, start) } };
      }
      case "wma20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = WMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { wma: alignTalibToBars(bars, r.output, start) } };
      }
      case "dema20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = DEMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { dema: alignTalibToBars(bars, r.output, start) } };
      }
      case "tema20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = TEMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { tema: alignTalibToBars(bars, r.output, start) } };
      }
      case "kama20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = KAMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { kama: alignTalibToBars(bars, r.output, start) } };
      }
      case "linearreg20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = LINEARREG({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { linearreg: alignTalibToBars(bars, r.output, start) } };
      }

      case "bbands20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const nbDev = numIn(inputs, "stdDev", 2, 0.5, 5);
        const r = BBANDS({ inReal: closes, timePeriod: period, nbDevUp: nbDev, nbDevDn: nbDev });
        const start = firstBarIndex(bars.length, r.upperBand.length);
        return {
          key,
          lines: {
            upper: alignTalibToBars(bars, r.upperBand, start),
            middle: alignTalibToBars(bars, r.middleBand, start),
            lower: alignTalibToBars(bars, r.lowerBand, start),
          },
        };
      }
      case "atr14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = ATR({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { atr: alignTalibToBars(bars, r.output, start) } };
      }
      case "psar": {
        const r = SAR({ high: highs, low: lows, acceleration: 0.02, maximum: 0.2 });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { psar: alignTalibToBars(bars, r.output, start) } };
      }
      case "accbands20": {
        const period = numIn(inputs, "period", 20, 1, 500);
        const r = ACCBANDS({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.upperBand.length);
        return {
          key,
          lines: {
            upper: alignTalibToBars(bars, r.upperBand, start),
            middle: alignTalibToBars(bars, r.middleBand, start),
            lower: alignTalibToBars(bars, r.lowerBand, start),
          },
        };
      }
      case "mama": {
        const r = MAMA({ inReal: closes, fastLimit: 0.5, slowLimit: 0.05 });
        const start = firstBarIndex(bars.length, r.MAMA.length);
        return {
          key,
          lines: {
            mama: alignTalibToBars(bars, r.MAMA, start),
            fama: alignTalibToBars(bars, r.FAMA, start),
          },
        };
      }
      case "midpoint14": {
        const period = numIn(inputs, "period", 14, 1, 500);
        const r = MIDPOINT({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { midpoint: alignTalibToBars(bars, r.output, start) } };
      }
      case "midprice14": {
        const period = numIn(inputs, "period", 14, 1, 500);
        const r = MIDPRICE({ high: highs, low: lows, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { midprice: alignTalibToBars(bars, r.output, start) } };
      }
      case "t3_5": {
        const period = numIn(inputs, "period", 5, 1, 500);
        const r = T3({ inReal: closes, timePeriod: period, VFactor: 0.7 });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { t3: alignTalibToBars(bars, r.output, start) } };
      }
      case "trima30": {
        const period = numIn(inputs, "period", 30, 1, 500);
        const r = TRIMA({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { trima: alignTalibToBars(bars, r.output, start) } };
      }
      case "tsf14": {
        const period = numIn(inputs, "period", 14, 1, 500);
        const r = TSF({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { tsf: alignTalibToBars(bars, r.output, start) } };
      }
      case "natr14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = NATR({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { natr: alignTalibToBars(bars, r.output, start) } };
      }
      case "sarext": {
        const r = SAREXT({ high: highs, low: lows });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { sarext: alignTalibToBars(bars, r.output, start) } };
      }
      case "avgprice": {
        const r = AVGPRICE({ open: opens, high: highs, low: lows, close: closes });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { avgprice: alignTalibToBars(bars, r.output, start) } };
      }
      case "medprice": {
        const r = MEDPRICE({ high: highs, low: lows });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { medprice: alignTalibToBars(bars, r.output, start) } };
      }
      case "typprice": {
        const r = TYPPRICE({ high: highs, low: lows, close: closes });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { typprice: alignTalibToBars(bars, r.output, start) } };
      }
      case "wclprice": {
        const r = WCLPRICE({ high: highs, low: lows, close: closes });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { wclprice: alignTalibToBars(bars, r.output, start) } };
      }

      case "rsi14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = RSI({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { rsi: alignTalibToBars(bars, r.output, start) } };
      }
      case "macd": {
        const fastPeriod = numIn(inputs, "fastPeriod", 12, 1, 100);
        const slowPeriod = numIn(inputs, "slowPeriod", 26, 1, 100);
        const signalPeriod = numIn(inputs, "signalPeriod", 9, 1, 100);
        const r = MACD({ inReal: closes, fastPeriod, slowPeriod, signalPeriod });
        const start = firstBarIndex(bars.length, r.MACD.length);
        return {
          key,
          lines: {
            macd: alignTalibToBars(bars, r.MACD, start),
            signal: alignTalibToBars(bars, r.MACDSignal, start),
            histogram: alignTalibToBars(bars, r.MACDHist, start),
          },
        };
      }
      case "macdfix": {
        const signalPeriod = numIn(inputs, "signalPeriod", 9, 1, 100);
        const r = MACDFIX({ inReal: closes, signalPeriod });
        const start = firstBarIndex(bars.length, r.MACD.length);
        return {
          key,
          lines: {
            macd: alignTalibToBars(bars, r.MACD, start),
            signal: alignTalibToBars(bars, r.MACDSignal, start),
            histogram: alignTalibToBars(bars, r.MACDHist, start),
          },
        };
      }
      case "stochastic": {
        const fastK = numIn(inputs, "fastK_Period", 14, 1, 100);
        const slowK = numIn(inputs, "slowK_Period", 3, 1, 100);
        const slowD = numIn(inputs, "slowD_Period", 3, 1, 100);
        const r = STOCH({
          high: highs,
          low: lows,
          close: closes,
          fastK_Period: fastK,
          slowK_Period: slowK,
          slowD_Period: slowD,
        });
        const start = firstBarIndex(bars.length, r.fastK.length);
        return {
          key,
          lines: {
            k: alignTalibToBars(bars, r.fastK, start),
            d: alignTalibToBars(bars, r.fastD, start),
          },
        };
      }
      case "stochasticRsi": {
        const period = numIn(inputs, "timePeriod", 14, 1, 100);
        const fastK = numIn(inputs, "fastK_Period", 5, 1, 100);
        const fastD = numIn(inputs, "fastD_Period", 3, 1, 100);
        const r = STOCHRSI({ inReal: closes, timePeriod: period, fastK_Period: fastK, fastD_Period: fastD });
        const start = firstBarIndex(bars.length, r.fastK.length);
        return {
          key,
          lines: {
            k: alignTalibToBars(bars, r.fastK, start),
            d: alignTalibToBars(bars, r.fastD, start),
          },
        };
      }
      case "stochFast": {
        const fastK = numIn(inputs, "fastK_Period", 5, 1, 100);
        const fastD = numIn(inputs, "fastD_Period", 3, 1, 100);
        const r = STOCHF({ high: highs, low: lows, close: closes, fastK_Period: fastK, fastD_Period: fastD });
        const start = firstBarIndex(bars.length, r.fastK.length);
        return {
          key,
          lines: {
            k: alignTalibToBars(bars, r.fastK, start),
            d: alignTalibToBars(bars, r.fastD, start),
          },
        };
      }
      case "cci20": {
        const period = numIn(inputs, "period", 20, 1, 100);
        const r = CCI({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { cci: alignTalibToBars(bars, r.output, start) } };
      }
      case "williamsR14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = WILLR({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { williams: alignTalibToBars(bars, r.output, start) } };
      }
      case "adx14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = ADX({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { adx: alignTalibToBars(bars, r.output, start) } };
      }
      case "adxr14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = ADXR({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { adxr: alignTalibToBars(bars, r.output, start) } };
      }
      case "apo": {
        const fastPeriod = numIn(inputs, "fastPeriod", 12, 1, 100);
        const slowPeriod = numIn(inputs, "slowPeriod", 26, 1, 100);
        const r = APO({ inReal: closes, fastPeriod, slowPeriod });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { apo: alignTalibToBars(bars, r.output, start) } };
      }
      case "aroon14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = AROON({ high: highs, low: lows, timePeriod: period });
        const start = firstBarIndex(bars.length, r.aroonUp.length);
        return {
          key,
          lines: {
            up: alignTalibToBars(bars, r.aroonUp, start),
            down: alignTalibToBars(bars, r.aroonDown, start),
          },
        };
      }
      case "aroonosc14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = AROONOSC({ high: highs, low: lows, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { aroonosc: alignTalibToBars(bars, r.output, start) } };
      }
      case "ppo": {
        const fastPeriod = numIn(inputs, "fastPeriod", 12, 1, 100);
        const slowPeriod = numIn(inputs, "slowPeriod", 26, 1, 100);
        const r = PPO({ inReal: closes, fastPeriod, slowPeriod });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { ppo: alignTalibToBars(bars, r.output, start) } };
      }
      case "roc12": {
        const period = numIn(inputs, "period", 12, 1, 100);
        const r = ROC({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { roc: alignTalibToBars(bars, r.output, start) } };
      }
      case "rocp10": {
        const period = numIn(inputs, "period", 10, 1, 100);
        const r = ROCP({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { rocp: alignTalibToBars(bars, r.output, start) } };
      }
      case "adosc": {
        const fastPeriod = numIn(inputs, "fastPeriod", 3, 1, 100);
        const slowPeriod = numIn(inputs, "slowPeriod", 10, 1, 100);
        const r = ADOSC({ high: highs, low: lows, close: closes, volume: volumes, fastPeriod, slowPeriod });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { adosc: alignTalibToBars(bars, r.output, start) } };
      }
      case "bop": {
        const r = BOP({ open: opens, high: highs, low: lows, close: closes });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { bop: alignTalibToBars(bars, r.output, start) } };
      }
      case "dx14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = DX({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { dx: alignTalibToBars(bars, r.output, start) } };
      }
      case "imi14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = IMI({ open: opens, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { imi: alignTalibToBars(bars, r.output, start) } };
      }
      case "plusDi14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = PLUS_DI({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { plusDi: alignTalibToBars(bars, r.output, start) } };
      }
      case "minusDi14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = MINUS_DI({ high: highs, low: lows, close: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { minusDi: alignTalibToBars(bars, r.output, start) } };
      }
      case "linearRegAngle14": {
        const period = numIn(inputs, "period", 14, 1, 500);
        const r = LINEARREG_ANGLE({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { angle: alignTalibToBars(bars, r.output, start) } };
      }
      case "linearRegSlope14": {
        const period = numIn(inputs, "period", 14, 1, 500);
        const r = LINEARREG_SLOPE({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { slope: alignTalibToBars(bars, r.output, start) } };
      }
      case "obv": {
        const r = OBV({ inReal: closes, volume: volumes });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { obv: alignTalibToBars(bars, r.output, start) } };
      }
      case "mfi14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = MFI({ high: highs, low: lows, close: closes, volume: volumes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { mfi: alignTalibToBars(bars, r.output, start) } };
      }
      case "trix15": {
        const period = numIn(inputs, "period", 15, 1, 100);
        const r = TRIX({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { trix: alignTalibToBars(bars, r.output, start) } };
      }
      case "adl": {
        const r = AD({ high: highs, low: lows, close: closes, volume: volumes });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { adl: alignTalibToBars(bars, r.output, start) } };
      }
      case "mom10": {
        const period = numIn(inputs, "period", 10, 1, 100);
        const r = MOM({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { mom: alignTalibToBars(bars, r.output, start) } };
      }
      case "cmo14": {
        const period = numIn(inputs, "period", 14, 1, 100);
        const r = CMO({ inReal: closes, timePeriod: period });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { cmo: alignTalibToBars(bars, r.output, start) } };
      }
      case "ultosc": {
        const p1 = numIn(inputs, "timePeriod1", 7, 1, 100);
        const p2 = numIn(inputs, "timePeriod2", 14, 1, 100);
        const p3 = numIn(inputs, "timePeriod3", 28, 1, 100);
        const r = ULTOSC({ high: highs, low: lows, close: closes, timePeriod1: p1, timePeriod2: p2, timePeriod3: p3 });
        const start = firstBarIndex(bars.length, r.output.length);
        return { key, lines: { ultosc: alignTalibToBars(bars, r.output, start) } };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
