/**
 * Lightweight-charts series primitive that draws TraderVue-style sideways triangles
 * at execution (time, price) points. Buy = triangle pointing right (→), Sell = triangle pointing left (←).
 */

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

const SIZE = 8; // half-width of triangle in px
const NEON_GREEN = "#39FF14";
const NEON_RED = "#FF3131";

export interface SidewaysMarkerPoint {
  time: number; // unix seconds
  price: number;
  side: "buy" | "sell";
  text?: string;
}

/** Series API that has priceToCoordinate (candlestick or line). Used for correct y when marker series is excluded from autoscale. */
type PriceScaleSeries = { priceToCoordinate: (price: number) => number | null };

class SidewaysMarkersPaneView implements IPrimitivePaneView {
  constructor(
    private _data: SidewaysMarkerPoint[],
    private _chart: SeriesAttachedParameter<Time>["chart"],
    private _priceSeries: PriceScaleSeries
  ) {}

  renderer(): IPrimitivePaneRenderer | null {
    const data = this._data;
    const chart = this._chart;
    const priceSeries = this._priceSeries;
    if (!data.length) return null;

    return {
      draw: (target) => {
        target.useMediaCoordinateSpace((scope) => {
          const ctx = scope.context;
          const timeScale = chart.timeScale();
          for (const m of data) {
            const x = timeScale.timeToCoordinate(m.time as Time);
            const y = priceSeries.priceToCoordinate(m.price);
            if (x == null || y == null) continue;
            ctx.save();
            try {
              if (m.side === "buy") {
                // Triangle pointing RIGHT (→): apex at (x+SIZE, y), base at x
                ctx.fillStyle = NEON_GREEN;
                ctx.beginPath();
                ctx.moveTo(x + SIZE, y);
                ctx.lineTo(x - SIZE, y - SIZE);
                ctx.lineTo(x - SIZE, y + SIZE);
                ctx.closePath();
                ctx.fill();
              } else {
                // Triangle pointing LEFT (←): apex at (x-SIZE, y), base at x
                ctx.fillStyle = NEON_RED;
                ctx.beginPath();
                ctx.moveTo(x - SIZE, y);
                ctx.lineTo(x + SIZE, y - SIZE);
                ctx.lineTo(x + SIZE, y + SIZE);
                ctx.closePath();
                ctx.fill();
              }
            } finally {
              ctx.restore();
            }
          }
        });
      },
    };
  }
}

/**
 * Primitive that draws sideways triangles at (time, price) for each marker.
 * Attach to the marker LineSeries after setData().
 * Pass priceSeries (e.g. candlestick) so y uses that scale when marker series is excluded from autoscale.
 */
export class SidewaysMarkersPrimitive implements ISeriesPrimitive<Time> {
  private _chart: SeriesAttachedParameter<Time>["chart"] | null = null;
  private _paneView: SidewaysMarkersPaneView | null = null;

  constructor(
    private _markers: SidewaysMarkerPoint[],
    private _priceSeries: PriceScaleSeries
  ) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._paneView = new SidewaysMarkersPaneView(
      this._markers,
      param.chart,
      this._priceSeries
    );
  }

  detached(): void {
    this._chart = null;
    this._paneView = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneView ? [this._paneView] : [];
  }
}
