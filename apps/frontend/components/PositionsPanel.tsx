'use client';

import { useState, useEffect } from 'react';
import { tradingAPI } from '../lib/api';
import { TradePosition } from '../types';
import { TrendingUp, TrendingDown, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function PositionsPanel() {
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    try {
      // For now, we'll get positions from balance data
      // In a full implementation, you'd have a dedicated endpoint
      const balanceData = await tradingAPI.getBalance();
      // This is a placeholder - you'd need to implement a positions endpoint
      setPositions([]);
    } catch (error) {
      console.error('Failed to load positions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closePosition = async (tradeId: string) => {
    try {
      await tradingAPI.executeTrade({
        command: 'CLOSE_TRADE',
        tradeId,
      });
      toast.success('Position closed successfully!');
      loadPositions();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to close position');
    }
  };

  const refreshPositions = async () => {
    setIsRefreshing(true);
    await loadPositions();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Open Positions
        </h3>
        <button
          onClick={refreshPositions}
          disabled={isRefreshing}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-8">
          <TrendingUp className="h-12 w-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No open positions</p>
          <p className="text-sm text-gray-500 mt-2">Create a trade to see your positions here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((position) => (
            <div key={position.tradeId} className="p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {position.direction === 'LONG' ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <h4 className="text-white font-semibold">{position.asset}</h4>
                    <p className="text-sm text-gray-400">
                      {position.direction} • {position.leverage}x leverage
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => closePosition(position.tradeId)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Close Position"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Margin</p>
                  <p className="text-white font-semibold">${position.margin.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Entry Price</p>
                  <p className="text-white font-semibold">${position.entryPrice.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-gray-400">P&L</p>
                  <p className={`font-semibold ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${position.pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    position.status === 'OPEN'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-gray-900/50 text-gray-400'
                  }`}>
                    {position.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
