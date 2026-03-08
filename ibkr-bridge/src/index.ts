import 'dotenv/config';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import { IbkrClient, loadIbkrConfig } from './ibkrClient.js';
import { TradeBuilder } from './tradeBuilder.js';
import { getYahooGapForDate } from './yahooGap.js';
import { getYahooQuoteForSymbol } from './yahooQuote.js';
import type { BridgeMessage, IbkrBridgeStatus } from './types.js';

const ServerEnvSchema = z.object({
  BRIDGE_PORT: z.coerce.number().int().positive().default(4010),
  // Safer default: only bind locally unless explicitly overridden.
  BRIDGE_HOST: z.string().default('127.0.0.1'),
  BRIDGE_STRATEGY_TAG: z.string().default('Day Trade'),
});

const serverEnv = ServerEnvSchema.parse(process.env);
const ibkrCfg = loadIbkrConfig(process.env);

const builder = new TradeBuilder(serverEnv.BRIDGE_STRATEGY_TAG);

let status: IbkrBridgeStatus = { state: 'starting' };
const setStatus = (next: IbkrBridgeStatus) => {
  status = next;
  broadcast({ type: 'status', status, at: new Date().toISOString() });
};

// execId -> { account, symbol }
const execIndex = new Map<string, { account: string; symbol: string }>();
// execId -> fee (when fee arrives before fill)
const pendingFees = new Map<string, number>();

const server = http.createServer((req, res) => {
  // Very small API surface for the frontend.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'missing url' }));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status }));
    return;
  }

  if (req.url.startsWith('/api/trades')) {
    const trades = builder.getCompleted();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, trades }));
    return;
  }

  if (req.url?.startsWith('/api/yahoo-gap')) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const dateStr = url.searchParams.get('date');
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      getYahooGapForDate(dateStr)
        .then((result) => {
          if (res.writableEnded) return;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...result }));
        })
        .catch((err) => {
          if (res.writableEnded) return;
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
        });
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Missing or invalid date (YYYY-MM-DD)' }));
    return;
  }

  if (req.url?.startsWith('/api/yahoo-quote')) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const symbol = url.searchParams.get('symbol');
    if (symbol && symbol.trim()) {
      getYahooQuoteForSymbol(symbol.trim())
        .then((data) => {
          if (res.writableEnded) return;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...data }));
        })
        .catch((err) => {
          if (res.writableEnded) return;
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
        });
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Missing or invalid symbol' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  sockets.add(ws);
  ws.on('close', () => sockets.delete(ws));

  // Send current status and a snapshot of trades since startup.
  safeSend(ws, { type: 'status', status, at: new Date().toISOString() });
  safeSend(ws, { type: 'snapshot', trades: builder.getCompleted(), at: new Date().toISOString() });
});

function safeSend(ws: any, msg: BridgeMessage) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // ignore
  }
}

function broadcast(msg: BridgeMessage) {
  for (const ws of sockets) safeSend(ws as any, msg);
}

const ib = new IbkrClient(ibkrCfg);
ib.onEvent((evt) => {
  if (evt.type === 'status') {
    if (evt.state === 'connecting') {
      setStatus({
        state: 'connecting',
        host: ibkrCfg.IBKR_HOST,
        port: ibkrCfg.IBKR_PORT,
        clientId: ibkrCfg.IBKR_CLIENT_ID,
      });
      return;
    }
    if (evt.state === 'connected') {
      setStatus({
        state: 'connected',
        host: ibkrCfg.IBKR_HOST,
        port: ibkrCfg.IBKR_PORT,
        clientId: ibkrCfg.IBKR_CLIENT_ID,
      });
      return;
    }
    if (evt.state === 'disconnected') {
      setStatus({ state: 'disconnected', reason: evt.message });
      return;
    }
    if (evt.state === 'error') {
      setStatus({ state: 'error', message: evt.message ?? 'unknown error' });
      return;
    }
  }

  if (evt.type === 'fill') {
    execIndex.set(evt.fill.execId, { account: evt.fill.account, symbol: evt.fill.symbol });
    if (pendingFees.has(evt.fill.execId)) {
      const fee = pendingFees.get(evt.fill.execId)!;
      pendingFees.delete(evt.fill.execId);
      evt.fill.fees = fee;
    }

    const completed = builder.ingestFill(evt.fill);
    if (completed) {
      broadcast({ type: 'trade', trade: completed, at: new Date().toISOString() });
      // We no longer need account/symbol for these execIds once completed.
      for (const e of completed.executionsList ?? []) {
        if (e.execId) execIndex.delete(e.execId);
      }
    }
    return;
  }

  if (evt.type === 'fee') {
    const hit = execIndex.get(evt.execId);
    if (hit) {
      builder.applyFee(hit.account, hit.symbol, evt.execId, evt.fee);
      return;
    }

    // Might be late fee for a completed trade; try to apply by execId.
    const updated = builder.applyFeeByExecId(evt.execId, evt.fee);
    if (updated) {
      broadcast({ type: 'trade', trade: updated, at: new Date().toISOString() });
      return;
    }

    // Fee arrived before the fill details (or we didn't see the fill).
    pendingFees.set(evt.execId, evt.fee);
    return;
  }
});

server.listen(serverEnv.BRIDGE_PORT, serverEnv.BRIDGE_HOST, () => {
  // Start IBKR connection after server is listening.
  ib.start();
  setStatus({ state: 'connecting', host: ibkrCfg.IBKR_HOST, port: ibkrCfg.IBKR_PORT, clientId: ibkrCfg.IBKR_CLIENT_ID });
  // eslint-disable-next-line no-console
  console.log(`IBKR bridge listening on http://${serverEnv.BRIDGE_HOST}:${serverEnv.BRIDGE_PORT}`);
});

process.on('SIGINT', () => {
  ib.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  ib.stop();
  server.close(() => process.exit(0));
});

