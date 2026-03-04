import IB from 'ib';
import { z } from 'zod';
import { formatIbkrFilterTime, parseIbkrTime } from './time.js';
import type { NormalizedFill } from './tradeBuilder.js';

export type IbkrEvent =
  | { type: 'status'; state: 'connecting' | 'connected' | 'disconnected' | 'error'; message?: string }
  | { type: 'fill'; fill: NormalizedFill }
  | { type: 'fee'; account: string; symbol: string; execId: string; fee: number };

const EnvSchema = z.object({
  IBKR_HOST: z.string().default('127.0.0.1'),
  IBKR_PORT: z.coerce.number().int().positive().default(7497), // 7497 paper / 7496 live
  IBKR_CLIENT_ID: z.coerce.number().int().nonnegative().default(101),
  IBKR_LOOKBACK_DAYS: z.coerce.number().int().min(0).max(365).default(7),
});

export type IbkrConfig = z.infer<typeof EnvSchema>;

export function loadIbkrConfig(env: NodeJS.ProcessEnv): IbkrConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid IBKR config: ${msg}`);
  }
  return parsed.data;
}

type Listener = (evt: IbkrEvent) => void;

export class IbkrClient {
  private ib: any | null = null;
  private listener: Listener | null = null;
  private reqId = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;

  constructor(private readonly cfg: IbkrConfig) {}

  onEvent(listener: Listener) {
    this.listener = listener;
  }

  start() {
    this.emit({ type: 'status', state: 'connecting' });
    this.connect();
  }

  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    try {
      this.ib?.disconnect?.();
    } catch {
      // ignore
    }
    this.ib = null;
    this.emit({ type: 'status', state: 'disconnected', message: 'stopped' });
  }

  private connect() {
    const { IBKR_HOST: host, IBKR_PORT: port, IBKR_CLIENT_ID: clientId } = this.cfg;

    // eslint-disable-next-line new-cap
    const ib = new (IB as any)({ host, port, clientId });
    this.ib = ib;

    ib.on('connected', () => {
      this.reconnectAttempt = 0;
      this.emit({ type: 'status', state: 'connected' });
      this.requestRecentExecutions();
    });

    ib.on('disconnected', () => {
      this.emit({ type: 'status', state: 'disconnected', message: 'ib disconnected' });
      this.scheduleReconnect();
    });

    ib.on('error', (err: any) => {
      const msg = typeof err === 'string' ? err : err?.message ?? JSON.stringify(err);
      this.emit({ type: 'status', state: 'error', message: msg });
      // Many errors are non-fatal; do not force disconnect here.
    });

    ib.on('execDetails', (_reqId: number, contract: any, execution: any) => {
      const symbol =
        (contract?.localSymbol as string | undefined) ||
        (contract?.symbol as string | undefined) ||
        'UNKNOWN';

      const account = (execution?.acctNumber as string | undefined) || 'UNKNOWN';
      const execId = String(execution?.execId ?? '');
      if (!execId) return;

      const side = String(execution?.side ?? '');
      const shares = Number(execution?.shares ?? 0);
      const price = Number(execution?.price ?? 0);
      const timeStr = String(execution?.time ?? '');
      const time = parseIbkrTime(timeStr);

      const qty = side === 'BOT' ? shares : side === 'SLD' ? -shares : 0;
      if (!qty || !Number.isFinite(price) || price <= 0) return;

      const fill: NormalizedFill = {
        account,
        symbol,
        time,
        qty,
        price,
        execId,
        fees: 0,
      };
      this.emit({ type: 'fill', fill });
    });

    ib.on('commissionReport', (r: any) => {
      const execId = String(r?.execId ?? '');
      if (!execId) return;
      const commission = Number(r?.commission ?? 0);
      if (!Number.isFinite(commission)) return;

      // Commission report does not include account/symbol reliably. We emit minimal and let
      // the bridge match execId to in-progress trades by searching fills (done in index).
      this.emit({ type: 'fee', account: 'UNKNOWN', symbol: 'UNKNOWN', execId, fee: commission });
    });

    ib.connect();
  }

  private requestRecentExecutions() {
    if (!this.ib) return;
    const lookbackDays = this.cfg.IBKR_LOOKBACK_DAYS;
    const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const filter = {
      time: formatIbkrFilterTime(from),
    };
    try {
      this.ib.reqExecutions(this.reqId++, filter);
    } catch (e: any) {
      this.emit({ type: 'status', state: 'error', message: e?.message ?? String(e) });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const attempt = ++this.reconnectAttempt;
    const delayMs = Math.min(30_000, 1000 * Math.pow(2, Math.min(6, attempt - 1)));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private emit(evt: IbkrEvent) {
    this.listener?.(evt);
  }
}

