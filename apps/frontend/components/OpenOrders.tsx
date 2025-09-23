'use client';

import { useState, useEffect } from 'react';
import { tradingAPI } from '../lib/api';
import { RefreshCw, X, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTrading } from '../lib/trading-context';

interface Order {
  orderId: string;
  command: string;
  status: string;
  asset: string | null;
  direction: string | null;
  amount: string | null;
  leverage: string | null;
  tradeId: string | null;
  latencyMs: number | null;
}

export function OpenOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setRefreshOpenOrders, refreshBalances, refreshTradeHistory } = useTrading();

  useEffect(() => {
    loadOrders();
    // Register refresh function with trading context
    setRefreshOpenOrders(loadOrders);
  }, [setRefreshOpenOrders]);

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/orders`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('All orders:', data.orders); // Debug log
        // Filter for open orders (only OPEN status)
        const openOrders = data.orders.filter((order: Order) =>
          order.status === 'OPEN' && order.command === 'CREATE_TRADE'
        );
        console.log('Filtered open orders:', openOrders); // Debug log
        setOrders(openOrders);
      } else {
        console.error('Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrders = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  };

  const closeOrder = async (orderId: string) => {
    try {
      // For now, we'll use the tradeId if available, otherwise show message
      const order = orders.find(o => o.orderId === orderId);
      if (order?.tradeId) {
        const response = await tradingAPI.executeTrade({
          command: 'CLOSE_TRADE',
          tradeId: order.tradeId,
        });
        
        console.log('📊 Close trade response:', response);
        console.log('📊 Engine response:', response.engineResponse);
        
        if (response.success && response.engineResponse?.status === 'success') {
          toast.success('Position closed successfully!');
          
          // Refresh balances, open orders, and trade history
          console.log('🔄 Refreshing balances, open orders, and trade history after trade closure...');
          try {
            refreshBalances();
            refreshOrders();
            refreshTradeHistory();
          } catch (refreshError) {
            console.error('Error refreshing data:', refreshError);
            // Don't show error toast for refresh failures
          }
        } else {
          console.log('❌ Close trade failed:', response.engineResponse?.message);
          toast.error(response.engineResponse?.message || 'Failed to close position');
        }
      } else {
        toast.error('Cannot close order - trade not yet executed');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to close position');
    }
  };

  const formatAmount = (amount: string | null) => {
    if (!amount) return 'N/A';
    return (parseInt(amount) / 10000).toFixed(2); // Convert from backend units
  };

  const formatLeverage = (leverage: string | null) => {
    if (!leverage) return 'N/A';
    return (parseInt(leverage) / 10).toFixed(1) + 'x'; // Convert from backend units
  };

  if (isLoading) {
    return (
      <div className="bg-black rounded-lg border border-gray-800 p-4 font-mono">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black rounded-lg border border-gray-800 p-4 h-full flex flex-col font-mono">
      <div className="flex items-center justify-between mb-4 flex-none">
        <h3 className="text-lg font-semibold text-white font-mono">OPEN ORDERS</h3>
        <button
          onClick={refreshOrders}
          disabled={isRefreshing}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-6 flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm font-mono">NO OPEN ORDERS</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.orderId} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="grid gap-3 items-center" style={{ gridTemplateColumns: 'auto auto auto auto auto' }}>
                  {/* Market */}
                  <div className="flex items-center space-x-2 min-w-0">
                    {order.direction === 'LONG' ? (
                      <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-white font-medium text-base whitespace-nowrap font-mono">
                      {order.asset} {order.direction}
                    </span>
                  </div>

                  {/* Margin */}
                  <div>
                    <p className="text-gray-400 text-sm mb-1 font-mono">MARGIN</p>
                    <p className="text-white font-medium text-base font-mono">${formatAmount(order.amount)}</p>
                  </div>

                  {/* Leverage */}
                  <div>
                    <p className="text-gray-400 text-sm mb-1 font-mono">LEVERAGE</p>
                    <p className="text-white font-medium text-base font-mono">{formatLeverage(order.leverage)}</p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-gray-400 text-sm mb-1 font-mono">STATUS</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium font-mono ${
                      order.status === 'OPEN'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-yellow-900/50 text-yellow-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Close Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => closeOrder(order.orderId)}
                      className="px-3 py-2 bg-red-900 hover:bg-red-800 text-white font-medium text-sm rounded transition-colors border border-red-700 font-mono"
                      title="Close Order"
                    >
                      CLOSE
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
