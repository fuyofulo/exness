'use client';

import { useState, useEffect } from 'react';
import { tradingAPI } from '../lib/api';
import { BalanceData } from '../types';
import { Wallet, TrendingUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function BalancePanel() {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const data = await tradingAPI.getBalance();
      setBalanceData(data);
    } catch (error: any) {
      console.error('Failed to load balance:', error);
      if (error?.response?.status === 401) {
        toast.error('Please log in again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalance = async () => {
    setIsRefreshing(true);
    await loadBalance();
    setIsRefreshing(false);
    toast.success('Balance updated');
  };

  const formatBalance = (balance: number, decimals: number) => {
    return (balance / Math.pow(10, decimals)).toFixed(decimals);
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
          <Wallet className="h-5 w-5 mr-2" />
          Balance
        </h3>
        <button
          onClick={refreshBalance}
          disabled={isRefreshing}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {balanceData ? (
        <div className="space-y-3">
          {Object.entries(balanceData.balances).map(([asset, balance]) => (
            <div key={asset} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                <span className="text-white font-medium">{asset}</span>
              </div>
              <span className="text-white font-semibold">
                {formatBalance(balance.balance, balance.decimals)}
              </span>
            </div>
          ))}

          {/* Total USD Value */}
          {balanceData.balances.USD && (
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="flex items-center justify-between text-lg">
                <span className="text-gray-300">Total USD</span>
                <span className="text-green-400 font-bold">
                  ${formatBalance(balanceData.balances.USD.balance, balanceData.balances.USD.decimals)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Wallet className="h-12 w-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No balance data available</p>
          <button
            onClick={async () => {
              try {
                await tradingAPI.createAccount();
                toast.success('Account created successfully!');
                refreshBalance();
              } catch (error) {
                toast.error('Failed to create account');
              }
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Create Account
          </button>
        </div>
      )}
    </div>
  );
}
