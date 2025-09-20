'use client';

import { useState, useEffect } from 'react';
import { TradingChart } from './TradingChart';  
import { TradingPanel } from './TradingPanel';
import { OpenOrders } from './OpenOrders';
import { BalanceDisplay } from './BalanceDisplay';
import { Timeframe } from '../types';
import { config } from '../config';

interface MarketsPageProps {
  asset: string;
}

export function MarketsPage({ asset }: MarketsPageProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1h');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // Fetch current price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setPriceLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/price?asset=${asset}_USDC`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const priceData = await response.json();
          console.log('Raw price data:', priceData);
          console.log('Price data type:', typeof priceData);
          
          if (priceData) {
            // Handle different possible data structures
            let rawPrice;
            if (typeof priceData === 'number') {
              rawPrice = priceData;
            } else if (priceData.price) {
              rawPrice = parseFloat(priceData.price);
            } else if (priceData.value) {
              rawPrice = parseFloat(priceData.value);
            } else {
              rawPrice = parseFloat(priceData);
            }
            
            console.log('Raw price:', rawPrice);
            
            // Try different conversion methods based on asset
            let formattedPrice;
            if (asset === 'BTC') {
              // BTC has 4 decimal places
              formattedPrice = rawPrice / 10000;
            } else if (rawPrice > 1000000) {
              // SOL/ETH have 6 decimal places (micro-units)
              formattedPrice = rawPrice / 1000000;
            } else if (rawPrice > 1000) {
              // Likely stored as milli-units (3 decimal places)
              formattedPrice = rawPrice / 1000;
            } else {
              // Already in correct format
              formattedPrice = rawPrice;
            }
            
            console.log('Formatted price:', formattedPrice);
            setCurrentPrice(formattedPrice);
          }
        }
      } catch (error) {
        console.error('Error fetching price:', error);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchPrice();
    
    // Refresh price every 5 seconds
    const interval = setInterval(fetchPrice, 5000);
    return () => clearInterval(interval);
  }, [asset]);

  return (
    <div className="flex-1 flex flex-col h-full font-mono">
      {/* Market Header with Current Price */}
      <div className="bg-black border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-white font-mono">{asset}/USDC</h2>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 font-mono">PRICE:</span>
              {priceLoading ? (
                <div className="animate-pulse bg-gray-700 h-6 w-20 rounded"></div>
              ) : currentPrice ? (
                <span className="text-white font-mono text-lg">${currentPrice.toFixed(2)}</span>
              ) : (
                <span className="text-gray-500 font-mono">N/A</span>
              )}
            </div>
          </div>

          <div className="flex space-x-2">
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors font-mono ${
                  selectedTimeframe === tf
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Chart and Orders */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Chart Section - Fixed height */}
          <div className="flex-none p-4 pb-2 bg-black">
            <TradingChart
              asset={asset}
              timeframe={selectedTimeframe}
            />
          </div>

          {/* Open Orders - Takes remaining space */}
          <div className="flex-1 p-4 pt-2 bg-black">
            <OpenOrders />
          </div>
        </div>

        {/* Right Side - Balance and Trading Panel */}
        <div className="w-96 bg-black border-l border-gray-800 flex flex-col">
          {/* Balance Display */}
          <div className="flex-none p-4 pb-2">
            <BalanceDisplay />
          </div>
          
          {/* Trading Panel */}
          <div className="flex-1 p-4 pt-2 overflow-y-auto">
            <TradingPanel
              selectedAsset={asset}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
