'use client';

import { BalanceDisplay } from './BalanceDisplay';
import { OpenOrders } from './OpenOrders';
import { TradeHistoryPage } from './TradeHistoryPage';

export function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col h-full p-6 overflow-y-auto font-mono">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white font-mono">DASHBOARD</h1>
        <p className="text-gray-400 font-mono">OVERVIEW OF YOUR TRADING ACCOUNT AND ACTIVITY</p>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balance Display */}
        <div className="lg:col-span-1">
          <BalanceDisplay />
        </div>

        {/* Open Orders */}
        <div className="lg:col-span-1">
          <div className="h-full">
            <OpenOrders />
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="flex-1">
        <TradeHistoryPage />
      </div>
    </div>
  );
}
