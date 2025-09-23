'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useTrading } from '../lib/trading-context';

interface Trade {
  tradeId: string;
  asset: string;
  direction: string;
  margin: string | null;
  leverage: string | null;
  entryPrice: string | null;
  entryPriceDecimals: number | null;
  liquidationPrice: string | null;
  liquidationPriceDecimals: number | null;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  triggerDecimals: number | null;
  exitPrice: string | null;
  exitPriceDecimals: number | null;
  pnl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  id: number;
}

export function TradeHistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setRefreshTradeHistory } = useTrading();

  useEffect(() => {
    loadTrades();
    // Register refresh function with trading context
    setRefreshTradeHistory(loadTrades);
  }, [setRefreshTradeHistory]);

  const loadTrades = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/trades`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Trades data:', data); // Debug log
        setTrades(data.trades);
      } else {
        console.error('Failed to fetch trades');
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTrades = async () => {
    setIsRefreshing(true);
    await loadTrades();
    setIsRefreshing(false);
  };

  const formatAmount = (amount: string | null) => {
    if (!amount) return 'N/A';
    return (parseInt(amount) / 10000).toFixed(2); // Convert from backend units
  };

  const formatLeverage = (leverage: string | null) => {
    if (!leverage) return 'N/A';
    return (parseInt(leverage) / 10).toFixed(1) + 'x'; // Convert from backend units
  };

  const formatPrice = (price: string | null, decimals: number | null) => {
    if (!price) return 'N/A';
    const divisor = Math.pow(10, decimals || 0);
    return (parseInt(price) / divisor).toFixed(decimals || 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-900/50 text-green-400';
      case 'CLOSED':
        return 'bg-blue-900/50 text-blue-400';
      case 'LIQUIDATED':
        return 'bg-red-900/50 text-red-400';
      case 'STOP_LOSS':
        return 'bg-orange-900/50 text-orange-400';
      case 'TAKE_PROFIT':
        return 'bg-purple-900/50 text-purple-400';
      default:
        return 'bg-gray-900/50 text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full p-6">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full p-6 overflow-y-auto font-mono">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-mono">TRADE HISTORY</h1>
          <p className="text-gray-400 font-mono">VIEW YOUR COMPLETE TRADING ACTIVITY</p>
        </div>
        <button
          onClick={refreshTrades}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-gray-200 disabled:bg-gray-600 text-black rounded-lg transition-colors font-mono"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>REFRESH</span>
        </button>
      </div>

      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
        {trades.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 font-mono">NO TRADE HISTORY</h3>
            <p className="text-gray-400 font-mono">YOUR TRADING HISTORY WILL APPEAR HERE ONCE YOU START TRADING.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    TRADE ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    ASSET
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    DIRECTION
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    MARGIN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    LEVERAGE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    ENTRY PRICE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    LIQUIDATION PRICE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    STOP LOSS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    TAKE PROFIT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    PNL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    STATUS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider font-mono">
                    CREATED
                  </th>
                </tr>
              </thead>
              <tbody className="bg-black divide-y divide-gray-800">
                {trades.map((trade) => (
                  <tr key={trade.tradeId} className="hover:bg-gray-900">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-400">
                      {trade.tradeId.slice(-8)}...
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-medium font-mono">
                      {trade.asset}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        {trade.direction === 'LONG' ? (
                          <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className={trade.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}>
                          {trade.direction}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                      ${formatAmount(trade.margin)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                      {formatLeverage(trade.leverage)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                      ${formatPrice(trade.entryPrice, trade.entryPriceDecimals)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                      ${formatPrice(trade.liquidationPrice, trade.liquidationPriceDecimals)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                      {trade.stopLossPrice ? `$${formatPrice(trade.stopLossPrice, trade.triggerDecimals)}` : 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                      {trade.takeProfitPrice ? `$${formatPrice(trade.takeProfitPrice, trade.triggerDecimals)}` : 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                      {trade.pnl ? (
                        <span className={parseFloat(trade.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {parseFloat(trade.pnl) >= 0 ? '+' : ''}${formatAmount(trade.pnl)}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full font-mono ${getStatusColor(trade.status)}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                      {formatDate(trade.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
