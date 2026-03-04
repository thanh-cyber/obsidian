import { z } from "zod";
import type { Trade } from "@/types/trade";

const LS_KEYS = {
  bridgeUrl: "ibkr_bridge_url",
  autoSync: "ibkr_auto_sync",
} as const;

export function getIbkrBridgeUrl(): string {
  const saved = localStorage.getItem(LS_KEYS.bridgeUrl);
  if (saved && saved.trim()) return saved.trim().replace(/\/+$/, "");
  const env = import.meta.env.VITE_IBKR_BRIDGE_URL as string | undefined;
  return (env?.trim() ? env.trim() : "http://localhost:4010").replace(/\/+$/, "");
}

export function setIbkrBridgeUrl(url: string): void {
  localStorage.setItem(LS_KEYS.bridgeUrl, url.trim().replace(/\/+$/, ""));
}

export function getIbkrAutoSyncEnabled(): boolean {
  const raw = localStorage.getItem(LS_KEYS.autoSync);
  if (raw == null) return false; // default OFF (avoid surprise network calls)
  return raw === "true";
}

export function setIbkrAutoSyncEnabled(enabled: boolean): void {
  localStorage.setItem(LS_KEYS.autoSync, enabled ? "true" : "false");
}

export async function testIbkrBridge(
  baseUrl: string
): Promise<{ ok: boolean; status?: BridgeStatus }> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, { method: "GET" });
  if (!res.ok) return { ok: false };
  const json = await res.json().catch(() => null);
  const parsed = StatusSchema.safeParse(json?.status);
  return { ok: true, status: parsed.success ? parsed.data : undefined };
}

const StatusSchema = z.object({
  state: z.string(),
  host: z.string().optional(),
  port: z.number().optional(),
  clientId: z.number().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
});

const TradeExecutionSchema = z.object({
  dateTime: z.string(),
  qty: z.number(),
  price: z.number(),
  position: z.number(),
  fees: z.number().optional(),
  execId: z.string().optional(),
});

const TradeSchema: z.ZodType<Trade> = z.object({
  id: z.string(),
  symbol: z.string(),
  entryDate: z.string(),
  entryPrice: z.number(),
  exitDate: z.string(),
  exitPrice: z.number(),
  positionSize: z.number(),
  strategyTag: z.string(),
  emotionalNotes: z.string().optional(),
  riskPercentage: z.number().optional(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  pnl: z.number(),
  pnlPercentage: z.number(),
  duration: z.number(),
  executions: z.number().optional(),
  executionsList: z.array(TradeExecutionSchema).optional(),
  source: z.enum(["csv", "manual", "ibkr"]).optional(),
  account: z.string().optional(),
});

const BridgeMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), status: StatusSchema, at: z.string() }),
  z.object({ type: z.literal("snapshot"), trades: z.array(TradeSchema), at: z.string() }),
  z.object({ type: z.literal("trade"), trade: TradeSchema, at: z.string() }),
]);

export type BridgeStatus = z.infer<typeof StatusSchema>;

export function connectIbkrBridge(opts: {
  baseUrl?: string;
  onStatus?: (s: BridgeStatus) => void;
  onSnapshot?: (trades: Trade[]) => void;
  onTrade?: (trade: Trade) => void;
  onError?: (err: Error) => void;
}): { close: () => void } {
  const baseUrl = (opts.baseUrl ?? getIbkrBridgeUrl()).replace(/\/+$/, "");
  const wsUrl = baseUrl.replace(/^http/i, "ws") + "/ws";

  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: number | null = null;
  let attempt = 0;

  const connect = () => {
    if (closed) return;
    attempt += 1;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      scheduleReconnect(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    ws.onopen = () => {
      attempt = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data));
        const parsed = BridgeMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        const msg = parsed.data;
        if (msg.type === "status") opts.onStatus?.(msg.status);
        if (msg.type === "snapshot") opts.onSnapshot?.(msg.trades);
        if (msg.type === "trade") opts.onTrade?.(msg.trade);
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };

    ws.onclose = () => {
      if (closed) return;
      scheduleReconnect(new Error("IBKR bridge disconnected"));
    };
  };

  const scheduleReconnect = (err: Error) => {
    opts.onError?.(err);
    if (reconnectTimer != null || closed) return;
    const delay = Math.min(15000, 500 * Math.pow(2, Math.min(5, attempt)));
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    },
  };
}

export function mergeTradesById(existing: Trade[], incoming: Trade[]): Trade[] {
  const byId = new Map<string, Trade>();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) {
    const existingTrade = byId.get(t.id);
    const merged: Trade = { ...t };
    // Keep existing executionsList if incoming has none (e.g. CSV had 11 fills, IBKR sync has no fills)
    if (
      existingTrade?.executionsList?.length &&
      (!merged.executionsList || merged.executionsList.length === 0)
    ) {
      merged.executionsList = existingTrade.executionsList;
      merged.executions = existingTrade.executions ?? existingTrade.executionsList.length;
    }
    byId.set(t.id, merged);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
  );
}

