import { useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type Time,
} from 'lightweight-charts';
import { SidewaysMarkersPrimitive } from './SidewaysMarkersPrimitive';
import { INDICATOR_PRESET_BY_KEY, type IndicatorKey } from '@/utils/indicatorPresets';
import type { IndicatorSettings } from '@/utils/indicatorSettingsSchema';
import { computeIndicatorSeries, type OhlcvBar } from '@/utils/indicators';
import { ensureTalib } from '@/utils/talibInit';

/** Execution marker: time in ms, side buy=entry or sell=exit; price = fill price for label (Tradervue-style) */
export type ExecutionMarker = { time: number; side: 'buy' | 'sell'; label?: string; price?: number };

interface TradeXChartProps {
  data: Array<[number, number, number, number, number, number]>; // [time (ms), open, high, low, close, volume]
  symbol: string;
  width?: number;
  height?: number;
  /** Toggleable indicator keys to render. */
  indicators?: IndicatorKey[];
  /** Per-indicator settings (inputs/style) - used when computing series (e.g. VWAP source/anchor). */
  indicatorSettings?: Record<string, IndicatorSettings>;
  /** Bar interval in ms (e.g. 60000 for 1m) - used to stagger same-bar markers and avoid overlap */
  timeframeBarMs?: number;
  onChartReady?: (chartApi: {
    chart: ReturnType<typeof createChart>;
    streamTick: (tickData: { t: number; o: number; h: number; l: number; c: number; v: number }) => void;
    jumpToTime: (timestamp: number) => void;
  }) => void;
  /** Multiple execution markers (one per fill) - preferred when available */
  markers?: ExecutionMarker[];
  /** Single entry/exit - fallback when no markers */
  entry?: { time: number; price: number };
  exit?: { time: number; price: number };
}

export const TradeXChart = ({
  data,
  symbol,
  width = 800,
  height = 600,
  indicators,
  indicatorSettings,
  timeframeBarMs,
  onChartReady,
  markers: executionMarkers,
  entry,
  exit,
}: TradeXChartProps) => {
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const oscChartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const oscChartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<{
    update: (data: { time: Time; open: number; high: number; low: number; close: number }) => void;
  } | null>(null);
  const onChartReadyRef = useRef(onChartReady);
  onChartReadyRef.current = onChartReady;

  const hasOscillator = useMemo(
    () => (indicators ?? []).some((k) => INDICATOR_PRESET_BY_KEY[k]?.pane === 'oscillator'),
    [indicators]
  );
  const w = Math.max(1, width);
  const mainH = Math.max(1, hasOscillator ? Math.floor(height * 0.72) : height);
  const oscH = Math.max(0, hasOscillator ? height - mainH : 0);

  useEffect(() => {
    if (!mainChartContainerRef.current) return;
    if (hasOscillator && oscH > 0 && !oscChartContainerRef.current) return;

    let cancelled = false;

    // TA-Lib (talib-web) must be initialized before computing indicators
    ensureTalib().then(() => {
      const mainContainer = mainChartContainerRef.current;
      const oscContainer = oscChartContainerRef.current;
      if (cancelled || !mainContainer) return;
      if (hasOscillator && oscH > 0 && !oscContainer) return;

      // Clean up existing chart
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
      if (oscChartRef.current) {
        oscChartRef.current.remove();
        oscChartRef.current = null;
      }

      // Use only valid rows (length >= 6, all OHLCV finite) to avoid NaN in chart/indicators
      const validRows = data.filter(
        (row) =>
          Array.isArray(row) &&
          row.length >= 6 &&
          Number.isFinite(row[0]) &&
          Number.isFinite(row[1]) &&
          Number.isFinite(row[2]) &&
          Number.isFinite(row[3]) &&
          Number.isFinite(row[4]) &&
          Number.isFinite(row[5])
      ) as Array<[number, number, number, number, number, number]>;

      const bars: OhlcvBar[] = validRows.map(([timeMs, open, high, low, close, volume]) => ({
        timeMs,
        timeSec: timeMs / 1000,
        open,
        high,
        low,
        close,
        volume,
      }));

      const overlayKeys = (indicators ?? []).filter((k) => INDICATOR_PRESET_BY_KEY[k]?.pane === 'overlay');
      const oscillatorKeys = (indicators ?? []).filter((k) => INDICATOR_PRESET_BY_KEY[k]?.pane === 'oscillator');

      // Create main chart
      const chart = createChart(mainContainer, {
      layout: {
        background: { type: ColorType.Solid, color: '#141414' },
        textColor: '#ccc',
      },
      width: w,
      height: Math.max(1, mainH),
      grid: {
        vertLines: { color: '#333' },
        horzLines: { color: '#333' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#666',
      },
      timeScale: {
        borderColor: '#666',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series (v5 API) - TraderVue-style solid colors
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    // Convert data to Lightweight Charts format (time in seconds for v5)
    const chartData = validRows.map(([time, open, high, low, close, volume]) => ({
      time: (time / 1000) as Time,
      open,
      high,
      low,
      close,
    }));
    const volumeData = validRows.map(([time, open, , , close, volume]) => ({
      time: (time / 1000) as Time,
      value: volume,
      color: close >= open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));

    candlestickSeries.setData(chartData);
    candlestickSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.06 },
    });

    // Overlay indicators (VWAP/MA/Bands/ATR/Keltner/Chandelier/PSAR)
    const overlayColor = (key: string) =>
      key === 'vwap' ? 'rgba(251, 191, 36, 0.95)'
      : key.startsWith('ema') ? 'rgba(168, 85, 247, 0.9)'
      : key.startsWith('sma') ? 'rgba(34, 211, 238, 0.9)'
      : key === 'atr14' ? 'rgba(249, 115, 22, 0.9)'
      : key === 'psar' ? 'rgba(236, 72, 153, 0.9)'
      : 'rgba(255, 255, 255, 0.9)';

    for (const k of overlayKeys) {
      const inputs = indicatorSettings?.[k]?.inputs;
      const computed = computeIndicatorSeries(k, bars, inputs);
      if (!computed) continue;

      if (computed.key === 'bbands20' || computed.key === 'accbands20') {
        const upper = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.85)', lineWidth: 1 });
        const middle = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.55)', lineWidth: 1 });
        const lower = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.85)', lineWidth: 1 });
        upper.setData(computed.lines.upper.map((p) => ({ time: p.time as Time, value: p.value })));
        middle.setData(computed.lines.middle.map((p) => ({ time: p.time as Time, value: p.value })));
        lower.setData(computed.lines.lower.map((p) => ({ time: p.time as Time, value: p.value })));
      } else if (computed.key === 'mama') {
        const mamaLine = chart.addSeries(LineSeries, { color: 'rgba(168, 85, 247, 0.95)', lineWidth: 2 });
        const famaLine = chart.addSeries(LineSeries, { color: 'rgba(34, 211, 238, 0.9)', lineWidth: 1 });
        mamaLine.setData(computed.lines.mama.map((p) => ({ time: p.time as Time, value: p.value })));
        famaLine.setData(computed.lines.fama.map((p) => ({ time: p.time as Time, value: p.value })));
      } else {
        const firstLine = Object.values(computed.lines)[0] ?? [];
        const series = chart.addSeries(LineSeries, { color: overlayColor(computed.key), lineWidth: 2 });
        series.setData(firstLine.map((p) => ({ time: p.time as Time, value: p.value })));
      }
    }

    // Build bar lookup: bar start (ms) -> bar index, so we can snap execution time to the bar that contains it.
    const barMs = timeframeBarMs ?? 60 * 1000;
    const barTimesMs = validRows.map((row) => row[0]);
    const firstBarMs = barTimesMs[0] ?? 0;
    const lastBarMs = barTimesMs[barTimesMs.length - 1] ?? 0;

    const getBarTimeForExecution = (execTimeMs: number): number => {
      if (execTimeMs <= firstBarMs) return firstBarMs;
      if (execTimeMs >= lastBarMs + barMs) return lastBarMs;
      for (let i = 0; i < barTimesMs.length; i++) {
        const barStart = barTimesMs[i];
        if (execTimeMs >= barStart && execTimeMs < barStart + barMs) return barStart;
      }
      return firstBarMs;
    };

    // Helper: get bar close at exec time as fallback when execution price is invalid/zero (avoids markers at bottom/volume)
    const getBarCloseAt = (execTimeMs: number): number | null => {
      const barStartMs = getBarTimeForExecution(execTimeMs);
      const idx = barTimesMs.indexOf(barStartMs);
      if (idx >= 0 && validRows[idx]) {
        const close = validRows[idx][4];
        return Number.isFinite(close) && close > 0 ? close : null;
      }
      return null;
    };

    // Execution markers: snap time to containing bar; use real price or bar close fallback (never 0/invalid - would render in volume)
    const markerPoints: { time: Time; value: number }[] = [];
    const sidewaysData: { time: number; price: number; side: 'buy' | 'sell'; text?: string }[] = [];
    if (executionMarkers?.length) {
      const sorted = [...executionMarkers].sort((a, b) => a.time - b.time);
      const barCount = new Map<number, number>();
      for (const m of sorted) {
        let price = Number(m.price ?? 0);
        if (!Number.isFinite(price) || price <= 0) {
          const fallback = getBarCloseAt(m.time);
          if (fallback == null) continue;
          price = fallback;
        }
        const barStartMs = getBarTimeForExecution(m.time);
        const barTimeSec = barStartMs / 1000;
        const idx = barCount.get(barStartMs) ?? 0;
        barCount.set(barStartMs, idx + 1);
        const t = idx === 0 ? barTimeSec : barTimeSec + idx; // unique time so LineSeries setData accepts (no TIME DUPLICATES)
        markerPoints.push({ time: t as Time, value: price });
        sidewaysData.push({
          time: t,
          price,
          side: m.side,
          text: m.price != null ? m.price.toFixed(2) : undefined,
        });
      }
    } else if (entry || exit) {
      let entryT: number | null = null;
      if (entry) {
        const barStartMs = getBarTimeForExecution(entry.time);
        const t = barStartMs / 1000;
        entryT = t;
        let price = Number(entry.price);
        if (!Number.isFinite(price) || price <= 0) price = getBarCloseAt(entry.time) ?? 0;
        if (Number.isFinite(price) && price > 0) {
          markerPoints.push({ time: t as Time, value: price });
          sidewaysData.push({ time: t, price, side: 'buy', text: price.toFixed(2) });
        }
      }
      if (exit) {
        const barStartMs = getBarTimeForExecution(exit.time);
        let t = barStartMs / 1000;
        if (entryT !== null && t === entryT) t += 1; // unique time if same bar
        let price = Number(exit.price);
        if (!Number.isFinite(price) || price <= 0) price = getBarCloseAt(exit.time) ?? 0;
        if (Number.isFinite(price) && price > 0) {
          markerPoints.push({ time: t as Time, value: price });
          sidewaysData.push({ time: t, price, side: 'sell', text: price.toFixed(2) });
        }
      }
    }
    if (markerPoints.length > 0) {
      const markerSeries = chart.addSeries(LineSeries, {
        color: 'rgba(0,0,0,0)',
        lineVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceScaleId: 'right',
      });
      markerSeries.setData(markerPoints);
      // Attach primitive to marker series so priceToCoordinate uses marker's scale; avoids markers ending up in volume pane
      const sidewaysPrimitive = new SidewaysMarkersPrimitive(sidewaysData, markerSeries);
      markerSeries.attachPrimitive(sidewaysPrimitive as Parameters<typeof markerSeries.attachPrimitive>[0]);
    }

    // Add volume histogram at bottom (TraderVue-style)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(volumeData);

    // Store reference
    mainChartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Oscillator pane (RSI / MACD)
    let oscChart: ReturnType<typeof createChart> | null = null;
    type VisibleTimeRange = Parameters<ReturnType<typeof chart.timeScale>['setVisibleRange']>[0];
    let onMainRangeChange: ((range: VisibleTimeRange | null) => void) | null = null;
    let onOscRangeChange: ((range: VisibleTimeRange | null) => void) | null = null;
    if (oscillatorKeys.length > 0 && oscH > 0 && oscContainer) {
      oscChart = createChart(oscContainer, {
        layout: {
          background: { type: ColorType.Solid, color: '#141414' },
          textColor: '#ccc',
        },
        width: w,
        height: Math.max(1, oscH),
        grid: {
          vertLines: { color: '#333' },
          horzLines: { color: '#333' },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: '#666',
        },
        timeScale: {
          borderColor: '#666',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      for (const k of oscillatorKeys) {
        const inputs = indicatorSettings?.[k]?.inputs;
        const computed = computeIndicatorSeries(k, bars, inputs);
        if (!computed) continue;

        if (computed.key === 'rsi14') {
          const rsiSeries = oscChart.addSeries(LineSeries, { color: 'rgba(34, 197, 94, 0.95)', lineWidth: 2 });
          rsiSeries.setData((computed.lines.rsi ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
        } else if (computed.key === 'macd' || computed.key === 'macdfix') {
          const hist = oscChart.addSeries(HistogramSeries, { priceScaleId: 'right' });
          hist.setData((computed.lines.histogram ?? []).map((p) => ({
            time: p.time as Time,
            value: p.value,
            color: p.value >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
          })));
          const macdLine = oscChart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.95)', lineWidth: 2 });
          const signalLine = oscChart.addSeries(LineSeries, { color: 'rgba(251, 191, 36, 0.95)', lineWidth: 2 });
          macdLine.setData((computed.lines.macd ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
          signalLine.setData((computed.lines.signal ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
        } else if (computed.key === 'stochastic' || computed.key === 'stochFast' || computed.key === 'stochasticRsi') {
          const kLine = oscChart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.95)', lineWidth: 2 });
          const dLine = oscChart.addSeries(LineSeries, { color: 'rgba(251, 191, 36, 0.95)', lineWidth: 2 });
          kLine.setData((computed.lines.k ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
          dLine.setData((computed.lines.d ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
        } else if (computed.key === 'aroon14') {
          const upLine = oscChart.addSeries(LineSeries, { color: 'rgba(34, 197, 94, 0.95)', lineWidth: 2 });
          const downLine = oscChart.addSeries(LineSeries, { color: 'rgba(239, 68, 68, 0.95)', lineWidth: 2 });
          upLine.setData((computed.lines.up ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
          downLine.setData((computed.lines.down ?? []).map((p) => ({ time: p.time as Time, value: p.value })));
        } else {
          const firstLine = Object.values(computed.lines)[0] ?? [];
          const series = oscChart.addSeries(LineSeries, { color: 'rgba(34, 197, 94, 0.95)', lineWidth: 2 });
          series.setData(firstLine.map((p) => ({ time: p.time as Time, value: p.value })));
        }
      }

      oscChartRef.current = oscChart;

      // Keep pan/zoom synchronized between panes
      let syncing = false;
      onMainRangeChange = (range: VisibleTimeRange | null) => {
        if (!oscChart || syncing) return;
        syncing = true;
        if (range) oscChart.timeScale().setVisibleRange(range);
        syncing = false;
      };
      onOscRangeChange = (range: VisibleTimeRange | null) => {
        if (!oscChart || syncing) return;
        syncing = true;
        if (range) chart.timeScale().setVisibleRange(range);
        syncing = false;
      };
      chart.timeScale().subscribeVisibleTimeRangeChange(onMainRangeChange);
      oscChart.timeScale().subscribeVisibleTimeRangeChange(onOscRangeChange);
    }

    // Fit content
    chart.timeScale().fitContent();
    if (oscChart) oscChart.timeScale().fitContent();

      // Expose API (use ref so effect does not re-run when parent passes new callback)
      const cb = onChartReadyRef.current;
      if (cb) {
        cb({
          chart,
          streamTick: (tickData: { t: number; o: number; h: number; l: number; c: number; v: number }) => {
            const series = seriesRef.current;
            if (!series) return;
            series.update({
              time: (tickData.t / 1000) as Time,
              open: tickData.o,
              high: tickData.h,
              low: tickData.l,
              close: tickData.c,
            });
          },
          jumpToTime: (timestamp: number) => {
            chart.timeScale().setVisibleRange({
              from: (timestamp / 1000) as Time,
              to: ((timestamp + 3600000) / 1000) as Time, // 1 hour range
            });
          },
        });
      }
    });

    // Cleanup
    return () => {
      cancelled = true;
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
      if (oscChartRef.current) {
        oscChartRef.current.remove();
        oscChartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [data, symbol, w, mainH, oscH, hasOscillator, indicators, indicatorSettings, timeframeBarMs, executionMarkers, entry, exit]);

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div ref={mainChartContainerRef} style={{ width: '100%', height: `${mainH}px` }} />
      <div
        ref={oscChartContainerRef}
        style={{ width: '100%', height: `${oscH}px`, display: oscH > 0 ? 'block' : 'none' }}
      />
    </div>
  );
};