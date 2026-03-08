import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Settings } from 'lucide-react';
import { TradeManager } from '@/utils/tradeManager';
import { ReplayTrade, ReplayState } from '@/types/replay';
import { Trade } from '@/types/trade';
import { loadTrades } from '@/utils/storage';
import { useFilters } from '@/context/FilterContext';
import { ReplayTest } from '@/components/ReplayTest';
import { ReplayDemo } from '@/components/ReplayDemo';
import { TradeXChart } from '@/components/TradeXChart';
import { TIMEFRAME_MS } from '@/utils/chartData';

export const Replay = () => {
  const [tradeManager, setTradeManager] = useState<TradeManager | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<ReplayTrade | null>(null);
  const [replayState, setReplayState] = useState<ReplayState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isPaidSubscription, setIsPaidSubscription] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiStats, setApiStats] = useState<{ callsThisSecond: number; maxCallsPerSecond: number; isPaidSubscription: boolean } | null>(null);
  const [cacheStats, setCacheStats] = useState<{ size: number; keys: string[] } | null>(null);
  const [chartData, setChartData] = useState<Array<[number, number, number, number, number, number]>>([]);
  const [selectedTradeOriginal, setSelectedTradeOriginal] = useState<Trade | null>(null);
  const [chartSize, setChartSize] = useState({ width: 800, height: 600 });
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

  const { applyFilters } = useFilters();
  const filteredTrades = applyFilters(trades);

  // Load trades from storage and check for API key
  useEffect(() => {
    const loadedTrades = loadTrades();
    setTrades(loadedTrades);

    const envApiKey = import.meta.env.VITE_POLYGON_API_KEY;
    if (envApiKey) {
      setApiKey(envApiKey);
      setIsPaidSubscription(true);
    } else {
      setError('No API key found in environment variables. Please set VITE_POLYGON_API_KEY in your .env.local file.');
    }
  }, []);

  // Initialize trade manager when API key is provided (for Polygon data)
  useEffect(() => {
    if (apiKey && !tradeManager) {
      const manager = new TradeManager(apiKey, isPaidSubscription);
      setTradeManager(manager);
    }
  }, [apiKey, tradeManager, isPaidSubscription]);

  // Convert trades to replay format when manager and trades are available
  useEffect(() => {
    if (tradeManager && trades.length > 0) {
      trades.forEach(trade => tradeManager.convertTrade(trade));
    }
  }, [tradeManager, trades]);

  // Update replay state and stats periodically
  useEffect(() => {
    if (!tradeManager) return;

    const interval = setInterval(() => {
      const state = tradeManager.getReplayState();
      setReplayState(state);
      
      // Update API stats
      const stats = tradeManager.getApiStats();
      setApiStats(stats);
      
      // Update cache stats
      const cache = tradeManager.getCacheStats();
      setCacheStats(cache);
    }, 100);

    return () => clearInterval(interval);
  }, [tradeManager]);


  const handleTradeSelect = async (trade: Trade) => {
    if (!tradeManager) {
      setError('Trade manager not initialized');
      return;
    }

    try {
      console.log('Selected trade:', trade);
      setError(null);
      
      // Convert trade to replay format and add to manager
      const replayTrade = tradeManager.convertTrade(trade);
      setSelectedTrade(replayTrade);
      setSelectedTradeOriginal(trade);
      console.log('Converted to replay trade:', replayTrade);
      
      // Get the latest trades array (should include the newly added trade)
      const managerTrades = tradeManager.getTrades();
      console.log('Manager trades count:', managerTrades.length);
      
      if (managerTrades.length === 0) {
        throw new Error('No trades found in manager after conversion');
      }
      
      const tradeIndex = managerTrades.length - 1; // The last added trade
      console.log('Using trade index:', tradeIndex);
      
      // Initialize replay to fetch data
      console.log('Fetching historical data...');
      await tradeManager.initReplay(tradeIndex, chartContainerRef.current || document.createElement('div'));
      
      // Get the historical data for the chart
      const replayQueue = tradeManager.getReplayQueue();
      console.log('Replay queue length:', replayQueue.length);
      
      if (replayQueue.length === 0) {
        throw new Error('No historical data available');
      }
      
      const ohlcvData = replayQueue.map(bar => [
        bar.time,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume
      ] as [number, number, number, number, number, number]);
      
      setChartData(ohlcvData);
      setIsInitialized(true);
      console.log('Chart data prepared successfully with', ohlcvData.length, 'bars');
      
    } catch (err) {
      console.error('Replay initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize replay');
      setSelectedTrade(null);
      setSelectedTradeOriginal(null);
    }
  };

  // Execution markers from original trade (same as TradeDetailModal); ensure price is finite
  const executionMarkers = useMemo(() => {
    if (!selectedTradeOriginal?.executionsList?.length) return undefined;
    const entryPrice = Number(selectedTradeOriginal.entryPrice);
    const exitPrice = Number(selectedTradeOriginal.exitPrice);
    return selectedTradeOriginal.executionsList
      .map((e) => {
        const rawPrice = Number(e.price);
        const price =
          Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : e.qty > 0 ? entryPrice : exitPrice;
        if (!Number.isFinite(price) || price <= 0) return null;
        return {
          time: new Date(e.dateTime).getTime(),
          side: (e.qty > 0 ? 'buy' : 'sell') as 'buy' | 'sell',
          label: e.qty > 0 ? 'BUY' : 'SELL',
          price,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m != null);
  }, [selectedTradeOriginal]);

  // Size chart to container (same pattern as TradeDetailModal)
  useEffect(() => {
    const el = chartWrapperRef.current;
    if (!el || !selectedTrade || !isInitialized) return;
    const update = () =>
      setChartSize({
        width: Math.max(1, el.offsetWidth || 800),
        height: Math.max(1, el.offsetHeight || 600),
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedTrade, isInitialized, chartData.length]);

  const handlePlayPause = () => {
    if (tradeManager) {
      tradeManager.togglePlay();
    }
  };

  const handleStepForward = () => {
    if (tradeManager) {
      tradeManager.stepForward();
    }
  };

  const handleStepBackward = () => {
    if (tradeManager) {
      tradeManager.stepBackward();
    }
  };

  const handleSpeedChange = (speed: number[]) => {
    if (tradeManager) {
      tradeManager.updateSpeed(speed[0]);
    }
  };

  const handleReset = () => {
    if (tradeManager) {
      tradeManager.reset();
    }
  };

  const handlePreloadAllTrades = async () => {
    if (!tradeManager) {
      setError('Trade manager not initialized');
      return;
    }

    try {
      setError(null);
      await tradeManager.preloadAllTrades();
      console.log('All trades preloaded successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preload trades');
    }
  };

  const handleClearCache = () => {
    if (tradeManager) {
      tradeManager.clearCache();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (startTime: number, currentTime: number) => {
    const duration = Math.floor((currentTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!apiKey) {
    return (
      <div className="min-h-full bg-background">
        <div className="p-6">
          <div className="max-w-md mx-auto mt-20">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Settings className="h-5 w-5" />
                  API Key Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-destructive bg-destructive/10 p-4 rounded">
                  {error}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Please add your Polygon.io API key to the <code>.env.local</code> file:</p>
                  <div className="mt-2 p-2 bg-muted rounded font-mono text-xs">
                    VITE_POLYGON_API_KEY=your_api_key_here
                  </div>
                  <p className="mt-2">Get your API key at <a href="https://polygon.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">polygon.io</a></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Market Replay</h1>
            <p className="text-sm text-muted-foreground">
              Simulate historical price action for your trades
            </p>
            {apiKey && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>✓ Ready to replay with TradeX-chart</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            {isPaidSubscription && tradeManager && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePreloadAllTrades}
                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Preload All Trades
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearCache}
                  className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  Clear Cache
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Demo Trades */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Demo Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <ReplayDemo onTradeSelect={handleTradeSelect} />
          </CardContent>
        </Card>

        {/* Trade Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTrades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No trades found. Add some trades in the Dashboard to replay them here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTrades.map((trade) => (
                  <Card 
                    key={trade.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedTrade?.id === trade.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleTradeSelect(trade)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{trade.symbol}</span>
                        <Badge variant={trade.pnl >= 0 ? 'default' : 'destructive'}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Entry: ${trade.entryPrice} @ {new Date(trade.entryDate).toLocaleDateString()}</p>
                        <p>Exit: ${trade.exitPrice} @ {new Date(trade.exitDate).toLocaleDateString()}</p>
                        <p>Size: {trade.positionSize} shares</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart Container - same TradingView/lightweight-charts TradeXChart as in Trades with entry/exit markers */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={chartContainerRef}
              className="w-full h-[600px] bg-card rounded-lg min-h-0 flex flex-col"
            >
              {!isInitialized && !selectedTrade && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a trade to begin replay
                </div>
              )}
              {selectedTrade && !isInitialized && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading chart for {selectedTrade.symbol}...</p>
                    <p className="text-xs mt-2">Preparing historical data...</p>
                  </div>
                </div>
              )}
              {selectedTrade && isInitialized && chartData.length > 0 && (
                <div ref={chartWrapperRef} className="flex-1 min-h-0 w-full">
                  <TradeXChart
                    data={chartData}
                    symbol={selectedTrade.symbol}
                    width={chartSize.width}
                    height={chartSize.height}
                    timeframeBarMs={TIMEFRAME_MS['1m']}
                    markers={executionMarkers?.length ? executionMarkers : undefined}
                    entry={!executionMarkers?.length ? { time: selectedTrade.entryTime, price: selectedTrade.entryPrice } : undefined}
                    exit={!executionMarkers?.length ? { time: selectedTrade.exitTime, price: selectedTrade.exitPrice } : undefined}
                    onChartReady={(chartInstance) => {
                      chartInstanceRef.current = chartInstance;
                      if (tradeManager) {
                        tradeManager.setChartInstance(chartInstance);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Replay Controls */}
        {selectedTrade && (
          <Card>
            <CardHeader>
              <CardTitle>Replay Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Control Buttons */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handlePlayPause}
                    size="lg"
                    className="px-6"
                  >
                    {replayState?.isPlaying ? (
                      <Pause className="h-5 w-5 mr-2" />
                    ) : (
                      <Play className="h-5 w-5 mr-2" />
                    )}
                    {replayState?.isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  
                  <Button
                    onClick={handleStepBackward}
                    variant="outline"
                    size="lg"
                  >
                    <SkipBack className="h-5 w-5" />
                  </Button>
                  
                  <Button
                    onClick={handleStepForward}
                    variant="outline"
                    size="lg"
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>
                  
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Speed Control */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Speed: {replayState?.speed || 1}x
                  </label>
                  <Slider
                    value={[replayState?.speed || 1]}
                    onValueChange={handleSpeedChange}
                    min={0.1}
                    max={5}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Progress Info */}
                {replayState && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Time:</span>
                      <span className="ml-2 font-mono">
                        {formatTime(replayState.currentTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Progress:</span>
                      <span className="ml-2">
                        {replayState.currentIndex} / {replayState.totalBars} bars
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2">
                        {formatDuration(replayState.startTime, replayState.currentTime)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Trade Info */}
                {selectedTrade && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Trade Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Symbol:</span>
                        <span className="ml-2 font-semibold">{selectedTrade.symbol}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Position Size:</span>
                        <span className="ml-2">{selectedTrade.positionSize} shares</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Entry Price:</span>
                        <span className="ml-2">${selectedTrade.entryPrice}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Exit Price:</span>
                        <span className="ml-2">${selectedTrade.exitPrice}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected P&L:</span>
                        <span className={`ml-2 font-semibold ${selectedTrade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ${selectedTrade.pnl.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Strategy:</span>
                        <span className="ml-2">{selectedTrade.notes || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Stats for Paid Users */}
        {isPaidSubscription && apiStats && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>API Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Calls this second:</span>
                  <span className="ml-2 font-mono">{apiStats.callsThisSecond}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max calls per second:</span>
                  <span className="ml-2 font-mono">{apiStats.maxCallsPerSecond}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Paid Subscription:</span>
                  <span className="ml-2 font-mono">{apiStats.isPaidSubscription ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Suite */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test Suite</CardTitle>
          </CardHeader>
          <CardContent>
            <ReplayTest />
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mt-6 border-destructive">
            <CardContent className="pt-6">
              <div className="text-destructive">
                <strong>Error:</strong> {error}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};