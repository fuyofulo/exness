'use client';

import { useState, useEffect } from 'react';
import { tradingAPI } from '../lib/api';
import { BalanceData } from '../types';
import { RefreshCw, DollarSign, Wallet } from 'lucide-react';
import { useTrading } from '../lib/trading-context';

export function BalanceDisplay() {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setRefreshBalances } = useTrading();

  useEffect(() => {
    loadBalances();
    // Register refresh function with trading context
    setRefreshBalances(loadBalances);
  }, [setRefreshBalances]);

  const loadBalances = async () => {
    try {
      console.log('🔄 Loading balances...');
      const data = await tradingAPI.getBalance();
      console.log('📊 Raw balance data received:', data);
      console.log('📊 Data type:', typeof data);
      console.log('📊 Data keys:', Object.keys(data || {}));
      
      if (data && data.balances) {
        console.log('💰 Balances object:', data.balances);
        console.log('💰 Balance keys:', Object.keys(data.balances));
        Object.entries(data.balances).forEach(([asset, balance]) => {
          console.log(`💰 ${asset}:`, balance);
        });
      }
      
      setBalanceData(data);
      console.log('✅ Balance data set to state');
    } catch (error) {
      console.error('❌ Error fetching balances:', error);
      console.error('❌ Error details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalances = async () => {
    setIsRefreshing(true);
    await loadBalances();
    setIsRefreshing(false);
  };

  const formatBalance = (balance: number | { balance: number; decimals: number }, decimals?: number) => {
    console.log(`🔢 Formatting balance: ${balance}, decimals: ${decimals}`);
    
    let result: string;
    
    if (typeof balance === 'number') {
      // Direct number format (like USD: 4999.5616) - already formatted
      result = balance.toFixed(2); // Just format to 2 decimal places
    } else {
      // Object format (like { balance: 1000000, decimals: 6 }) - needs division
      const divisor = Math.pow(10, balance.decimals);
      result = (balance.balance / divisor).toFixed(balance.decimals);
    }
    
    console.log(`🔢 Formatted result: ${result}`);
    return result;
  };

  const getTotalUSDValue = () => {
    console.log('💵 Getting total USD value...');
    if (!balanceData) {
      console.log('💵 No balance data available');
      return '0.00';
    }
    
    console.log('💵 Balance data available:', balanceData);
    console.log('💵 Balances object:', balanceData.balances);
    
    // Check for USD balance (what we're actually getting from backend)
    const usdBalance = balanceData.balances['USD'];
    console.log('💵 USD balance:', usdBalance);
    
    if (usdBalance) {
      const result = formatBalance(usdBalance);
      console.log('💵 Total USD value:', result);
      return result;
    }
    
    // Fallback to USDC if USD not found
    const usdcBalance = balanceData.balances['USDC'];
    console.log('💵 USDC balance:', usdcBalance);
    
    if (usdcBalance) {
      const result = typeof usdcBalance === 'number' 
        ? formatBalance(usdcBalance)
        : formatBalance(usdcBalance.balance, usdcBalance.decimals);
      console.log('💵 Total USD value:', result);
      return result;
    }
    
    console.log('💵 No USD/USDC balance found, returning 0.00');
    return '0.00';
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
    <div className="bg-black rounded-lg border border-gray-800 p-4 font-mono">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Wallet className="h-5 w-5 text-white" />
          <h3 className="text-lg font-semibold text-white font-mono">ACCOUNT BALANCE</h3>
        </div>
        <button
          onClick={refreshBalances}
          disabled={isRefreshing}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {balanceData ? (
        <div className="space-y-3">
          {/* USD Balance */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-white" />
                <span className="text-gray-400 text-sm font-mono">USD</span>
              </div>
              <span className="text-white font-semibold text-lg font-mono">
                ${getTotalUSDValue()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm font-mono">FAILED TO LOAD BALANCES</p>
        </div>
      )}
    </div>
  );
}
