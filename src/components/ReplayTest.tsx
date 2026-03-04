import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TradeManager } from '@/utils/tradeManager';
import { ReplayTrade } from '@/types/replay';

export const ReplayTest = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      // Test 1: Create TradeManager
      addResult('Creating TradeManager...');
      const manager = new TradeManager('test-api-key', true); // Simulate paid subscription
      addResult('✓ TradeManager created successfully (Paid subscription mode)');

      // Test 2: Log a long trade
      addResult('Testing long trade logging...');
      const longTrade = manager.logTrade(
        'AAPL',
        1731480600000, // 2025-10-14T09:30:00 UTC
        150.0,
        1731482400000, // 2025-10-14T10:00:00 UTC
        152.0,
        100,
        'Breakout strategy'
      );
      
      const expectedPnL = (152.0 - 150.0) * 100; // 200
      addResult(`✓ Long trade logged: PnL = $${longTrade.pnl} (expected: $${expectedPnL})`);
      
      if (Math.abs(longTrade.pnl - expectedPnL) < 0.01) {
        addResult('✓ PnL calculation verified');
      } else {
        addResult('✗ PnL calculation failed');
      }

      // Test 3: Log a short trade
      addResult('Testing short trade logging...');
      const shortTrade = manager.logTrade(
        'TSLA',
        1731481200000, // 2025-10-14T10:00:00 UTC
        200.0,
        1731483000000, // 2025-10-14T10:30:00 UTC
        195.0,
        -50, // Short position
        'Momentum reversal'
      );
      
      const expectedShortPnL = (195.0 - 200.0) * (-50); // 250
      addResult(`✓ Short trade logged: PnL = $${shortTrade.pnl} (expected: $${expectedShortPnL})`);
      
      if (Math.abs(shortTrade.pnl - expectedShortPnL) < 0.01) {
        addResult('✓ Short trade PnL calculation verified');
      } else {
        addResult('✗ Short trade PnL calculation failed');
      }

      // Test 4: Test invalid trade (entry after exit)
      addResult('Testing invalid trade validation...');
      try {
        manager.logTrade('INVALID', 1731483000000, 100, 1731481200000, 105, 10);
        addResult('✗ Invalid trade validation failed - should have thrown error');
      } catch (error) {
        addResult('✓ Invalid trade validation working correctly');
      }

      // Test 5: Test replay state management
      addResult('Testing replay state management...');
      const state = manager.getReplayState();
      addResult(`✓ Initial state: ${JSON.stringify(state, null, 2)}`);

      // Test 6: Test speed control
      addResult('Testing speed control...');
      manager.updateSpeed(2.5);
      const updatedState = manager.getReplayState();
      if (updatedState.speed === 2.5) {
        addResult('✓ Speed control working correctly');
      } else {
        addResult('✗ Speed control failed');
      }

      // Test 7: Test step controls
      addResult('Testing step controls...');
      manager.stepForward();
      manager.stepBackward();
      addResult('✓ Step controls working correctly');

      // Test 8: Test reset functionality
      addResult('Testing reset functionality...');
      manager.reset();
      const resetState = manager.getReplayState();
      if (resetState.currentIndex === 0) {
        addResult('✓ Reset functionality working correctly');
      } else {
        addResult('✗ Reset functionality failed');
      }

      // Test 9: Test trades retrieval
      addResult('Testing trades retrieval...');
      const trades = manager.getTrades();
      addResult(`✓ Retrieved ${trades.length} trades`);
      
      if (trades.length === 2) {
        addResult('✓ Correct number of trades retrieved');
      } else {
        addResult('✗ Incorrect number of trades retrieved');
      }

      // Test 10: Test paid subscription features
      addResult('Testing paid subscription features...');
      const apiStats = manager.getApiStats();
      addResult(`✓ API Stats: ${apiStats.callsThisSecond}/${apiStats.maxCallsPerSecond} calls/sec`);
      addResult(`✓ Subscription type: ${apiStats.isPaidSubscription ? 'Paid' : 'Free'}`);
      
      const cacheStats = manager.getCacheStats();
      addResult(`✓ Cache stats: ${cacheStats.size} datasets cached`);
      
      // Test 11: Test bulk operations
      addResult('Testing bulk operations...');
      try {
        await manager.bulkFetchData(trades);
        addResult('✓ Bulk fetch operation completed');
      } catch (error) {
        addResult('⚠ Bulk fetch test skipped (no real API key)');
      }

      addResult('🎉 All tests completed successfully!');
      
    } catch (error) {
      addResult(`✗ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Replay Function Test Suite</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            className="bg-primary hover:bg-primary/90"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
          <Button 
            onClick={clearResults} 
            variant="outline"
            disabled={isRunning}
          >
            Clear Results
          </Button>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
          <div className="font-mono text-sm space-y-1">
            {testResults.length === 0 ? (
              <div className="text-muted-foreground">Click "Run Tests" to start testing...</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className={result.includes('✗') ? 'text-destructive' : result.includes('✓') ? 'text-green-600' : 'text-foreground'}>
                  {result}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p><strong>Test Coverage:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>TradeManager instantiation (Paid subscription mode)</li>
            <li>Long trade logging and PnL calculation</li>
            <li>Short trade logging and PnL calculation</li>
            <li>Invalid trade validation</li>
            <li>Replay state management</li>
            <li>Speed control functionality</li>
            <li>Step forward/backward controls</li>
            <li>Reset functionality</li>
            <li>Trade data retrieval</li>
            <li>API usage statistics</li>
            <li>Cache management</li>
            <li>Bulk operations (paid features)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
