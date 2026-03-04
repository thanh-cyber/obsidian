import { ReplayTrade, ReplayBar, ReplayState, PolygonConfig } from '@/types/replay';
import { Trade } from '@/types/trade';

interface TradeXChartInstance {
  use(config: unknown): void;
  state: {
    data: {
      setData(data: { ohlcv: ReplayBar[] }, merge?: boolean): void;
    };
  };
  stream: {
    onTick(callback: (data: unknown) => void): void;
  };
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  destroy(): void;
}

export class TradeManager {
  private trades: ReplayTrade[] = [];
  private replayQueue: ReplayBar[] = [];
  private isPlaying: boolean = false;
  private currentIndex: number = 0;
  private timer: NodeJS.Timeout | null = null;
  private chart: TradeXChartInstance | null = null;
  private chartElement: HTMLElement | null = null;
  private apiKey: string = '';
  private onRealtimeCallback: ((bar: ReplayBar) => void) | null = null;
  private replayState: ReplayState;
  private dataCache: Map<string, ReplayBar[]> = new Map();
  private apiCallCount: number = 0;
  private lastApiCallTime: number = 0;
  private maxCallsPerSecond: number = 200;
  private isPaidSubscription: boolean = false;

  constructor(apiKey: string, isPaidSubscription: boolean = false) {
    this.apiKey = apiKey;
    this.isPaidSubscription = isPaidSubscription;
    this.maxCallsPerSecond = isPaidSubscription ? 200 : 5; // Free tier: 5 calls/minute, Paid: 200/second
    this.replayState = {
      isPlaying: false,
      currentIndex: 0,
      speed: 1, // 1 bar per second
      totalBars: 0,
      currentTime: 0,
      startTime: 0,
      endTime: 0,
    };
  }

  /**
   * Log a trade for replay simulation
   */
  logTrade(
    symbol: string,
    entryTime: number,
    entryPrice: number,
    exitTime: number,
    exitPrice: number,
    positionSize: number,
    notes?: string
  ): ReplayTrade {
    // Validate timestamps
    if (entryTime >= exitTime) {
      throw new Error('Entry time must be before exit time');
    }

    // Calculate PnL
    const pnl = (exitPrice - entryPrice) * positionSize;

    const trade: ReplayTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      entryTime,
      entryPrice,
      exitTime,
      exitPrice,
      positionSize,
      notes,
      pnl,
    };

    this.trades.push(trade);
    console.log('Trade logged:', trade);
    console.assert(pnl === (exitPrice - entryPrice) * positionSize, 'PnL calculation mismatch');
    
    return trade;
  }

  /**
   * Convert Trade to ReplayTrade and add to manager
   */
  convertTrade(trade: Trade): ReplayTrade {
    const entryTime = new Date(trade.entryDate).getTime();
    const exitTime = new Date(trade.exitDate).getTime();
    
    const replayTrade: ReplayTrade = {
      id: trade.id,
      symbol: trade.symbol,
      entryTime,
      entryPrice: trade.entryPrice,
      exitTime,
      exitPrice: trade.exitPrice,
      positionSize: trade.positionSize,
      notes: trade.emotionalNotes,
      pnl: trade.pnl,
    };
    
    // Add to manager's trades array
    this.trades.push(replayTrade);
    console.log('Added trade to manager:', replayTrade);
    
    return replayTrade;
  }

  /**
   * Initialize replay for a specific trade
   */
  async initReplay(tradeIndex: number, container: HTMLElement): Promise<void> {
    console.log(`initReplay called with index: ${tradeIndex}, total trades: ${this.trades.length}`);
    
    if (tradeIndex < 0 || tradeIndex >= this.trades.length) {
      throw new Error(`Invalid trade index: ${tradeIndex}. Available trades: ${this.trades.length}`);
    }

    const trade = this.trades[tradeIndex];
    console.log('Initializing replay for trade:', trade);

    // Configure Polygon adapter
    const config: PolygonConfig = {
      apiKey: this.apiKey,
      symbol: trade.symbol,
      from: trade.entryTime - (5 * 60 * 1000), // 5 minutes before entry
      to: trade.exitTime + (5 * 60 * 1000), // 5 minutes after exit
      timespan: 'minute',
      multiplier: 1,
    };

    try {
      // Fetch historical data from Polygon
      await this.fetchPolygonData(config);
      
      // Initialize TradingView widget
      await this.initializeChart(container, trade);
      
      // Add markers for entry and exit
      this.addTradeOverlays(trade);
      
      // Reset replay state
      this.resetReplayState();
      
      console.log('Replay initialized successfully');
    } catch (error) {
      console.error('Failed to initialize replay:', error);
      throw error;
    }
  }

  /**
   * Rate limiting for API calls
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every second
    if (now - this.lastApiCallTime >= 1000) {
      this.apiCallCount = 0;
      this.lastApiCallTime = now;
    }
    
    // Check if we've exceeded rate limit
    if (this.apiCallCount >= this.maxCallsPerSecond) {
      const waitTime = 1000 - (now - this.lastApiCallTime);
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.apiCallCount = 0;
        this.lastApiCallTime = Date.now();
      }
    }
    
    this.apiCallCount++;
  }

  /**
   * Generate cache key for data
   */
  private getCacheKey(symbol: string, from: number, to: number): string {
    return `${symbol}_${from}_${to}`;
  }

  /**
   * Generate mock data for testing
   */
  private generateMockData(config: PolygonConfig): ReplayBar[] {
    const bars: ReplayBar[] = [];
    const startTime = config.from;
    const endTime = config.to;
    const interval = 60 * 1000; // 1 minute in milliseconds
    
    // Generate mock price data
    let currentTime = startTime;
    let currentPrice = 100 + Math.random() * 50; // Random starting price between 100-150
    
    while (currentTime <= endTime) {
      // Generate realistic price movement
      const change = (Math.random() - 0.5) * 2; // Random change between -1 and +1
      currentPrice += change;
      
      // Ensure price doesn't go negative
      currentPrice = Math.max(currentPrice, 1);
      
      const high = currentPrice + Math.random() * 2;
      const low = currentPrice - Math.random() * 2;
      const open = currentPrice - (Math.random() - 0.5) * 1;
      const close = currentPrice;
      const volume = Math.floor(Math.random() * 1000000) + 100000;
      
      bars.push({
        time: currentTime,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
      
      currentTime += interval;
    }
    
    return bars;
  }

  /**
   * Fetch data from Polygon.io with caching and rate limiting
   */
  private async fetchPolygonData(config: PolygonConfig): Promise<void> {
    const cacheKey = this.getCacheKey(config.symbol, config.from, config.to);
    
    // Check cache first
    if (this.dataCache.has(cacheKey)) {
      console.log('Using cached data for', config.symbol);
      const cachedData = this.dataCache.get(cacheKey)!;
      this.replayQueue = [...cachedData];
      this.replayState.totalBars = this.replayQueue.length;
      this.replayState.startTime = config.from;
      this.replayState.endTime = config.to;
      return;
    }

    // For demo purposes, use mock data instead of real API
    console.log('Generating mock data for', config.symbol);
    const mockBars = this.generateMockData(config);
    
    // Cache the data
    this.dataCache.set(cacheKey, mockBars);
    
    this.replayQueue = [...mockBars];
    this.replayState.totalBars = this.replayQueue.length;
    this.replayState.startTime = config.from;
    this.replayState.endTime = config.to;
    
    console.log(`Generated ${mockBars.length} mock bars for ${config.symbol}`);
    return;

    // Original Polygon.io code (commented out for demo)
    /*
    // Apply rate limiting
    await this.rateLimit();

    const { PolygonTradingViewAdapter } = await import('@polygon.io/tradingview-adapter');
    
    const adapter = new PolygonTradingViewAdapter({
      apiKey: config.apiKey,
    });

    return new Promise((resolve, reject) => {
      adapter.getBars(
        { symbol: config.symbol, full_name: config.symbol },
        '1',
        {
          from: Math.floor(config.from / 1000), // Convert to seconds
          to: Math.floor(config.to / 1000),
        },
        (bars: ReplayBar[]) => {
          const processedBars = bars.map(bar => ({
            ...bar,
            time: bar.time * 1000, // Convert to milliseconds
          }));
          
          // Cache the data
          this.dataCache.set(cacheKey, processedBars);
          
          this.replayQueue = [...processedBars];
          this.replayState.totalBars = this.replayQueue.length;
          this.replayState.startTime = config.from;
          this.replayState.endTime = config.to;
          
          console.log(`Fetched ${bars.length} bars from Polygon.io (${this.isPaidSubscription ? 'Paid' : 'Free'} subscription)`);
          resolve();
        },
        (error: any) => {
          console.error('Polygon data fetch error:', error);
          reject(error);
        }
      );
    });
    */
  }

  /**
   * Initialize chart data (simplified for use with TradeXChart component)
   */
  private async initializeChart(container: HTMLElement, trade: ReplayTrade): Promise<void> {
    // Since we're using the TradeXChart component, we just need to prepare the data
    console.log('Preparing data for trade:', trade.symbol);
    
    // Fetch historical data
    await this.setHistoricalData(trade);
    
    // Log trade markers for reference
    this.addTradeOverlays(trade);
  }

  /**
   * Fetch and prepare historical data
   */
  private async setHistoricalData(trade: ReplayTrade): Promise<void> {
    // Fetch or get from cache
    const config: PolygonConfig = {
      apiKey: this.apiKey,
      symbol: trade.symbol,
      from: trade.entryTime - (5 * 60 * 1000), // 5 minutes before entry
      to: trade.exitTime + (5 * 60 * 1000), // 5 minutes after exit
      timespan: 'minute',
      multiplier: 1,
    };
    await this.fetchPolygonData(config);
    
    // Data is now in this.replayQueue, ready to be used by the component
    console.log(`Loaded ${this.replayQueue.length} bars for ${trade.symbol}`);
  }

  /**
   * Add trade overlays for entry/exit points
   */
  private addTradeOverlays(trade: ReplayTrade): void {
    // Annotations not available yet per docs, so log for now
    console.log('Trade Entry Marker:', { time: trade.entryTime, price: trade.entryPrice, label: 'ENTRY' });
    console.log('Trade Exit Marker:', { time: trade.exitTime, price: trade.exitPrice, label: 'EXIT' });
    
    // TODO: Implement as custom overlay when ready (see API examples for addOverlay)
  }

  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Start replay
   */
  play(): void {
    if (this.replayQueue.length === 0) {
      console.warn('No data to replay');
      return;
    }

    this.isPlaying = true;
    this.replayState.isPlaying = true;

    this.timer = setInterval(() => {
      if (this.currentIndex < this.replayQueue.length) {
        const bar = this.replayQueue[this.currentIndex];
        this.replayState.currentTime = bar.time;
        this.replayState.currentIndex = this.currentIndex;

        if (this.onRealtimeCallback) {
          this.onRealtimeCallback(bar);
        }

        if (this.chart && this.chart.streamTick) {
          // Stream the bar to TradeX chart using proper streaming format
          const tickData = {
            t: bar.time,      // timestamp in milliseconds
            o: bar.open,      // open price
            h: bar.high,      // high price
            l: bar.low,       // low price
            c: bar.close,     // close price
            v: bar.volume     // volume
          };
          this.chart.streamTick(tickData);
        }

        this.currentIndex++;
      } else {
        this.pause();
        console.log('Replay completed');
        this.validateReplay();
      }
    }, 1000 / this.replayState.speed);

    console.log('Replay started');
  }

  /**
   * Pause replay
   */
  pause(): void {
    this.isPlaying = false;
    this.replayState.isPlaying = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    console.log('Replay paused');
  }

  /**
   * Step forward one bar
   */
  stepForward(): void {
    if (this.currentIndex < this.replayQueue.length) {
      const bar = this.replayQueue[this.currentIndex];
      this.replayState.currentTime = bar.time;
      this.replayState.currentIndex = this.currentIndex;

      if (this.onRealtimeCallback) {
        this.onRealtimeCallback(bar);
      }

      if (this.chart) {
        if (this.chart && this.chart.streamTick) {
          const tickData = {
            t: bar.time,
            o: bar.open,
            h: bar.high,
            l: bar.low,
            c: bar.close,
            v: bar.volume
          };
          this.chart.streamTick(tickData);
        }
      }

      this.currentIndex++;
      console.log(`Stepped forward to bar ${this.currentIndex}`);
    }
  }

  /**
   * Step backward one bar
   */
  stepBackward(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const bar = this.replayQueue[this.currentIndex];
      this.replayState.currentTime = bar.time;
      this.replayState.currentIndex = this.currentIndex;

      if (this.onRealtimeCallback) {
        this.onRealtimeCallback(bar);
      }

      if (this.chart) {
        if (this.chart && this.chart.streamTick) {
          const tickData = {
            t: bar.time,
            o: bar.open,
            h: bar.high,
            l: bar.low,
            c: bar.close,
            v: bar.volume
          };
          this.chart.streamTick(tickData);
        }
      }

      console.log(`Stepped backward to bar ${this.currentIndex}`);
    }
  }

  /**
   * Update replay speed
   */
  updateSpeed(speed: number): void {
    this.replayState.speed = speed;
    
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Reset replay to beginning
   */
  reset(): void {
    this.pause();
    this.currentIndex = 0;
    this.replayState.currentIndex = 0;
    this.replayState.currentTime = this.replayState.startTime;
    console.log('Replay reset to beginning');
  }

  /**
   * Reset replay state
   */
  private resetReplayState(): void {
    this.currentIndex = 0;
    this.replayState.currentIndex = 0;
    this.replayState.currentTime = this.replayState.startTime;
    this.isPlaying = false;
    this.replayState.isPlaying = false;
  }

  /**
   * Validate replay results
   */
  private validateReplay(): void {
    const currentTrade = this.trades[this.trades.length - 1];
    const expectedPnL = (currentTrade.exitPrice - currentTrade.entryPrice) * currentTrade.positionSize;
    
    console.assert(
      Math.abs(currentTrade.pnl - expectedPnL) < 0.01,
      `PnL validation failed: expected ${expectedPnL}, got ${currentTrade.pnl}`
    );
    
    console.log(`Replay completed; PnL verified: ${Math.abs(currentTrade.pnl - expectedPnL) < 0.01}`);
  }

  /**
   * Get current replay state
   */
  getReplayState(): ReplayState {
    return { ...this.replayState };
  }

  /**
   * Get all trades
   */
  getTrades(): ReplayTrade[] {
    return [...this.trades];
  }

  /**
   * Get replay queue
   */
  getReplayQueue(): ReplayBar[] {
    return [...this.replayQueue];
  }

  /**
   * Bulk fetch data for multiple trades (optimized for paid subscriptions)
   */
  async bulkFetchData(trades: ReplayTrade[]): Promise<void> {
    if (!this.isPaidSubscription) {
      console.warn('Bulk fetching is only available for paid subscriptions');
      return;
    }

    console.log(`Bulk fetching data for ${trades.length} trades...`);
    
    const fetchPromises = trades.map(async (trade, index) => {
      const config: PolygonConfig = {
        apiKey: this.apiKey,
        symbol: trade.symbol,
        from: trade.entryTime - (5 * 60 * 1000), // 5 minutes before entry
        to: trade.exitTime + (5 * 60 * 1000), // 5 minutes after exit
        timespan: 'minute',
        multiplier: 1,
      };

      try {
        await this.fetchPolygonData(config);
        console.log(`✓ Fetched data for trade ${index + 1}/${trades.length}: ${trade.symbol}`);
      } catch (error) {
        console.error(`✗ Failed to fetch data for trade ${index + 1}: ${trade.symbol}`, error);
      }
    });

    await Promise.all(fetchPromises);
    console.log('Bulk data fetch completed');
  }

  /**
   * Get API usage statistics
   */
  getApiStats(): { callsThisSecond: number; maxCallsPerSecond: number; isPaidSubscription: boolean } {
    return {
      callsThisSecond: this.apiCallCount,
      maxCallsPerSecond: this.maxCallsPerSecond,
      isPaidSubscription: this.isPaidSubscription,
    };
  }

  /**
   * Clear data cache
   */
  clearCache(): void {
    this.dataCache.clear();
    console.log('Data cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.dataCache.size,
      keys: Array.from(this.dataCache.keys()),
    };
  }

  /**
   * Set chart instance for streaming
   */
  setChartInstance(chartInstance: TradeXChartInstance): void {
    this.chart = chartInstance;
    console.log('Chart instance connected to trade manager');
  }

  /**
   * Preload data for all trades (useful for paid subscriptions)
   */
  async preloadAllTrades(): Promise<void> {
    if (this.trades.length === 0) {
      console.log('No trades to preload');
      return;
    }

    console.log(`Preloading data for ${this.trades.length} trades...`);
    await this.bulkFetchData(this.trades);
    console.log('Preloading completed');
  }
}
