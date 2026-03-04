import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TradeManager } from '@/utils/tradeManager';
import { ReplayTrade } from '@/types/replay';
import { Trade } from '@/types/trade';

interface ReplayDemoProps {
  onTradeSelect: (trade: Trade) => void;
}

export const ReplayDemo = ({ onTradeSelect }: ReplayDemoProps) => {
  const [demoTrades, setDemoTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadDemoTrades = () => {
    // Sample trades for demonstration - create as Trade objects
    const sampleTrades: Trade[] = [
      {
        id: 'demo_aapl_1',
        symbol: 'AAPL',
        entryDate: '2024-01-15T09:30:00Z',
        entryPrice: 185.50,
        exitDate: '2024-01-15T10:15:00Z',
        exitPrice: 188.75,
        positionSize: 100,
        strategyTag: 'Breakout',
        emotionalNotes: 'Breakout strategy - strong volume',
        pnl: 325.00, // (188.75 - 185.50) * 100
        pnlPercentage: 1.75, // (188.75 - 185.50) / 185.50 * 100
        duration: 45 // minutes
      },
      {
        id: 'demo_tsla_1',
        symbol: 'TSLA',
        entryDate: '2024-01-16T10:00:00Z',
        entryPrice: 245.30,
        exitDate: '2024-01-16T11:30:00Z',
        exitPrice: 238.90,
        positionSize: -50, // Short position
        strategyTag: 'Momentum',
        emotionalNotes: 'Momentum reversal - overbought conditions',
        pnl: 320.00, // (245.30 - 238.90) * 50
        pnlPercentage: 2.61, // (245.30 - 238.90) / 245.30 * 100
        duration: 90 // minutes
      },
      {
        id: 'demo_msft_1',
        symbol: 'MSFT',
        entryDate: '2024-01-17T09:45:00Z',
        entryPrice: 415.20,
        exitDate: '2024-01-17T14:20:00Z',
        exitPrice: 422.80,
        positionSize: 75,
        strategyTag: 'Swing',
        emotionalNotes: 'Swing trade - earnings anticipation',
        pnl: 570.00, // (422.80 - 415.20) * 75
        pnlPercentage: 1.83, // (422.80 - 415.20) / 415.20 * 100
        duration: 275 // minutes
      }
    ];

    setDemoTrades(sampleTrades);
    setIsLoaded(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatPnL = (pnl: number) => {
    return pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
  };

  const getPositionType = (positionSize: number) => {
    return positionSize > 0 ? 'Long' : 'Short';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Demo Trades</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sample trades to demonstrate the replay functionality
        </p>
      </CardHeader>
      <CardContent>
        {!isLoaded ? (
          <div className="text-center py-8">
            <Button onClick={loadDemoTrades} className="bg-primary hover:bg-primary/90">
              Load Demo Trades
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Click to load sample trades for testing the replay feature
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {demoTrades.length} demo trades loaded
              </p>
              <Button 
                onClick={() => {
                  setDemoTrades([]);
                  setIsLoaded(false);
                }}
                variant="outline"
                size="sm"
              >
                Clear Demo
              </Button>
            </div>
            
            <div className="grid gap-4">
              {demoTrades.map((trade, index) => (
                <Card 
                  key={trade.id} 
                  className="border-l-4 border-l-primary cursor-pointer hover:border-l-green-500 hover:shadow-md transition-all duration-200"
                  onClick={() => onTradeSelect(trade)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{trade.symbol}</span>
                        <Badge variant={trade.positionSize > 0 ? 'default' : 'secondary'}>
                          {getPositionType(trade.positionSize)}
                        </Badge>
                        <Badge variant={trade.pnl >= 0 ? 'default' : 'destructive'}>
                          {formatPnL(trade.pnl)}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Trade #{index + 1}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Entry:</strong> ${trade.entryPrice} @ {formatDate(trade.entryDate)}</p>
                        <p><strong>Exit:</strong> ${trade.exitPrice} @ {formatDate(trade.exitDate)}</p>
                      </div>
                      <div>
                        <p><strong>Position Size:</strong> {Math.abs(trade.positionSize)} shares</p>
                        <p><strong>Strategy:</strong> {trade.emotionalNotes || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex justify-between text-sm">
                        <span>Duration: {trade.duration} minutes</span>
                        <span>Return: {trade.pnlPercentage.toFixed(2)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">How to Use:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>API key is automatically loaded from environment variables</li>
                <li>Select one of the demo trades to start replay</li>
                <li>Use the replay controls to play, pause, step through, or adjust speed</li>
                <li>Watch the chart replay the historical price action with entry/exit markers</li>
                <li>Observe the P&L calculation and trade validation in the console</li>
                <li><strong>Note:</strong> Demo uses mock data for testing - real API integration available</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
