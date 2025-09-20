'use client';

import { useState } from 'react';
import { tradingAPI } from '../lib/api';
import { config } from '../config';
import toast from 'react-hot-toast';
import { useTrading } from '../lib/trading-context';

interface TradingPanelProps {
  selectedAsset: string;
}

export function TradingPanel({ selectedAsset }: TradingPanelProps) {
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [margin, setMargin] = useState('');
  const [leverage, setLeverage] = useState(config.DEFAULT_LEVERAGE.toString());
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { refreshBalances, refreshOpenOrders, refreshTradeHistory } = useTrading();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const marginValue = parseFloat(margin);
    const leverageValue = parseInt(leverage);
    const stopLossValue = stopLoss ? parseFloat(stopLoss) : undefined;
    const takeProfitValue = takeProfit ? parseFloat(takeProfit) : undefined;

    if (!marginValue || marginValue <= 0) {
      toast.error('Please enter a valid margin amount');
      return;
    }

    if (leverageValue < 10 || leverageValue > config.MAX_LEVERAGE) {
      toast.error(`Leverage must be between 10 and ${config.MAX_LEVERAGE}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await tradingAPI.executeTrade({
        command: 'CREATE_TRADE',
        asset: `${selectedAsset}_USDC`,
        direction,
        margin: marginValue,
        leverage: leverageValue,
        stopLossPrice: stopLossValue,
        takeProfitPrice: takeProfitValue,
      });

      console.log('📊 Trade response:', response);
      console.log('📊 Engine response:', response.engineResponse);
      
      if (response.success && response.engineResponse?.status === 'success') {
        toast.success('Trade created successfully!');
        // Reset form
        setMargin('');
        setStopLoss('');
        setTakeProfit('');
        
        // Refresh balances, open orders, and trade history
        console.log('🔄 Refreshing balances, open orders, and trade history after trade creation...');
        try {
          refreshBalances();
          refreshOpenOrders();
          refreshTradeHistory();
        } catch (refreshError) {
          console.error('Error refreshing data:', refreshError);
          // Don't show error toast for refresh failures
        }
      } else {
        console.log('❌ Trade failed:', response.engineResponse?.message || response.error);
        toast.error(response.engineResponse?.message || response.error || 'Failed to create trade');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create trade');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePositionSize = () => {
    const marginValue = parseFloat(margin) || 0;
    const leverageValue = parseInt(leverage) / 10 || 1; // Display leverage (divide by 10)
    return marginValue * leverageValue;
  };

  return (
    <div className="bg-black rounded-lg border border-gray-800 p-6 font-mono">
      <h3 className="text-lg font-semibold text-white mb-4 font-mono">CREATE {selectedAsset}/USDC TRADE</h3>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 font-mono">
            DIRECTION
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setDirection('LONG')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors font-mono ${
                direction === 'LONG'
                  ? 'bg-green-900 text-white border border-green-700'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
              }`}
            >
              LONG
            </button>
            <button
              type="button"
              onClick={() => setDirection('SHORT')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors font-mono ${
                direction === 'SHORT'
                  ? 'bg-red-900 text-white border border-red-700'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
              }`}
            >
              SHORT
            </button>
          </div>
        </div>

        {/* Margin */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 font-mono">
            MARGIN (USD)
          </label>
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent font-mono"
            placeholder="1000"
            step="0.01"
            min="0"
          />
        </div>

        {/* Leverage */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 font-mono">
            LEVERAGE ({parseInt(leverage) / 10}x)
          </label>
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1x</span>
            <span>100x</span>
          </div>
        </div>

        {/* Position Size Preview */}
        {margin && (
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <div className="text-sm text-gray-400 font-mono">
              POSITION SIZE: <span className="text-white font-semibold">${calculatePositionSize().toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Stop Loss */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 font-mono">
            STOP LOSS (OPTIONAL)
          </label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent font-mono"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        {/* Take Profit */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 font-mono">
            TAKE PROFIT (OPTIONAL)
          </label>
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent font-mono"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !margin}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors font-mono ${
            direction === 'LONG'
              ? 'bg-green-900 hover:bg-green-800 disabled:bg-gray-600 border border-green-700'
              : 'bg-red-900 hover:bg-red-800 disabled:bg-gray-600 border border-red-700'
          } text-white disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              CREATING TRADE...
            </div>
          ) : (
            `CREATE ${direction} TRADE`
          )}
        </button>
      </form>
    </div>
  );
}
