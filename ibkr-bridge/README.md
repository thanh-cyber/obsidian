# IBKR Bridge (local)

This service connects to **Interactive Brokers TWS / IB Gateway** via the IB API socket and streams **completed trades** (flat-to-flat per symbol) into the Replay Art frontend over WebSocket.

## Requirements

- **Trader Workstation (TWS)** or **IB Gateway** running on this machine
- In TWS/Gateway: **Enable ActiveX and Socket Clients**
- API port:
  - Paper: `7497` (default)
  - Live: `7496`

## Setup

1. Install dependencies:

```bash
cd ibkr-bridge
npm install
```

2. Set environment variables (PowerShell example):

```powershell
$env:IBKR_HOST="127.0.0.1"
$env:IBKR_PORT="7497"
$env:IBKR_CLIENT_ID="101"
$env:IBKR_LOOKBACK_DAYS="7"
$env:BRIDGE_PORT="4010"
```

3. Start the bridge:

```bash
npm run dev
```

## Frontend

In the app, open **Settings → Interactive Brokers (IBKR) Sync**:

- Set **Bridge URL** to `http://localhost:4010`
- Click **Test connection**
- Enable **Auto-sync trades**

Then open the **Trades** page — new completed trades will merge into local storage automatically.

## Notes / current behavior

- Trades are built **per account + symbol** and finalized when the position returns to **0**.
- Executions are included in `executionsList` (fills, cumulative position, and fees when available).

