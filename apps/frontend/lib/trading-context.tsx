'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface TradingContextType {
  refreshBalances: () => void;
  refreshOpenOrders: () => void;
  refreshTradeHistory: () => void;
  setRefreshBalances: (fn: () => void) => void;
  setRefreshOpenOrders: (fn: () => void) => void;
  setRefreshTradeHistory: (fn: () => void) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }: { children: ReactNode }) {
  let refreshBalancesFn: (() => void) | null = null;
  let refreshOpenOrdersFn: (() => void) | null = null;
  let refreshTradeHistoryFn: (() => void) | null = null;

  const setRefreshBalances = (fn: () => void) => {
    refreshBalancesFn = fn;
  };

  const setRefreshOpenOrders = (fn: () => void) => {
    refreshOpenOrdersFn = fn;
  };

  const setRefreshTradeHistory = (fn: () => void) => {
    refreshTradeHistoryFn = fn;
  };

  const refreshBalances = () => {
    if (refreshBalancesFn) {
      refreshBalancesFn();
    }
  };

  const refreshOpenOrders = () => {
    if (refreshOpenOrdersFn) {
      refreshOpenOrdersFn();
    }
  };

  const refreshTradeHistory = () => {
    if (refreshTradeHistoryFn) {
      refreshTradeHistoryFn();
    }
  };

  const value = {
    refreshBalances,
    refreshOpenOrders,
    refreshTradeHistory,
    setRefreshBalances,
    setRefreshOpenOrders,
    setRefreshTradeHistory,
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
}
