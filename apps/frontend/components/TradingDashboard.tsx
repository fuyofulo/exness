'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Sidebar, Page } from './Sidebar';
import { DashboardPage } from './DashboardPage';
import { MarketsPage } from './MarketsPage';

export function TradingDashboard() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('sol');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'btc':
        return <MarketsPage asset="BTC" />;
      case 'eth':
        return <MarketsPage asset="ETH" />;
      case 'sol':
        return <MarketsPage asset="SOL" />;
      default:
        return <MarketsPage asset="SOL" />;
    }
  };

  return (
    <div className="h-screen bg-black flex">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-black border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-end">
            <div className="text-sm text-gray-400 font-mono">
              WELCOME, <span className="text-white font-semibold">{user?.email}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        {renderCurrentPage()}
      </div>
    </div>
  );
}
