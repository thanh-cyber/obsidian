export interface ReplayTrade {
  id: string;
  symbol: string;
  entryTime: number; // Unix timestamp in milliseconds
  entryPrice: number;
  exitTime: number; // Unix timestamp in milliseconds
  exitPrice: number;
  positionSize: number;
  notes?: string;
  pnl: number;
}

export interface ReplayBar {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplayState {
  isPlaying: boolean;
  currentIndex: number;
  speed: number; // bars per second
  totalBars: number;
  currentTime: number;
  startTime: number;
  endTime: number;
}

export interface ReplayControls {
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

export interface PolygonConfig {
  apiKey: string;
  symbol: string;
  from: number; // Unix timestamp in milliseconds
  to: number; // Unix timestamp in milliseconds
  timespan: 'minute' | 'hour' | 'day';
  multiplier: number;
}

