'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, CandlestickData } from 'lightweight-charts';
import { tradingAPI } from '../lib/api';
import { CandleData, Timeframe } from '../types';
import { config } from '../config';

interface TradingChartProps {
  asset: string;
  timeframe: Timeframe;
}

export function TradingChart({ asset, timeframe }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#000000' },
        textColor: '#ffffff',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      },
      grid: {
        vertLines: { color: '#1f1f1f' },
        horzLines: { color: '#1f1f1f' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1f1f1f',
        borderVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500, // Larger chart height to fill available space
    });

    // Create candlestick series
    let candlestickSeries;
    try {
      // Try the standard method first
      if (typeof chart.addCandlestickSeries === 'function') {
        candlestickSeries = chart.addCandlestickSeries({
          upColor: '#00ff00',
          downColor: '#ff0000',
          borderVisible: false,
          wickUpColor: '#00ff00',
          wickDownColor: '#ff0000',
        });
        console.log('Candlestick series created successfully');
      } else if (typeof (chart as any).addSeries === 'function') {
        // Try generic addSeries method
        candlestickSeries = (chart as any).addSeries('candlestick', {
          upColor: '#00ff00',
          downColor: '#ff0000',
          borderVisible: false,
          wickUpColor: '#00ff00',
          wickDownColor: '#ff0000',
        });
        console.log('Candlestick series created with addSeries');
      } else {
        console.error('No suitable method found for creating candlestick series');
        console.log('Available methods:', Object.getOwnPropertyNames(chart));
        return;
      }
    } catch (error) {
      console.error('Failed to create candlestick series:', error);
      return;
    }

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Load initial data
    loadCandles();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (error) {
          console.log('Chart already disposed');
        }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadCandles();
  }, [asset, timeframe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (error) {
          console.log('Chart cleanup - already disposed');
        }
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      }
    };
  }, []);

  const loadCandles = async () => {
    if (!candlestickSeriesRef.current || !chartRef.current) return;

    setIsLoading(true);
    try {
      const candles = await tradingAPI.getCandles(asset, timeframe);
      console.log('Raw candles data:', candles);

      // Transform candle data for TradingView
      const transformedData: CandlestickData[] = candles
        .filter((candle: any) => {
          // Filter out invalid candles - check for end date string and OHLC values
          const hasValidData = candle &&
                              typeof candle.end === 'string' &&
                              candle.close && candle.open && candle.high && candle.low;

          if (!hasValidData) {
            console.warn('Invalid candle data:', candle);
            return false;
          }
          return true;
        })
        .map((candle: any) => {
          // Parse the end date string to timestamp
          const timestamp = new Date(candle.end).getTime() / 1000; // Convert to seconds

          // Parse OHLC values as floats
          const open = parseFloat(candle.open);
          const high = parseFloat(candle.high);
          const low = parseFloat(candle.low);
          const close = parseFloat(candle.close);

          // Validate parsed values
          if (isNaN(timestamp) || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
            console.warn('Failed to parse candle data:', candle);
            return null;
          }

          return {
            time: timestamp as any,
            open,
            high,
            low,
            close,
          };
        })
        .filter((candle): candle is CandlestickData => candle !== null) // Remove null entries
        .sort((a, b) => (a.time as number) - (b.time as number)) // Sort by time ascending
        .filter((candle, index, array) => {
          // Remove duplicates and ensure ascending order
          if (index > 0 && (candle.time as number) <= (array[index - 1].time as number)) {
            console.warn('Removing duplicate or out-of-order candle:', candle);
            return false;
          }
          return true;
        });

      console.log('Transformed candles data:', transformedData);

      if (transformedData.length > 0) {
        if (candlestickSeriesRef.current && chartRef.current) {
          try {
            candlestickSeriesRef.current.setData(transformedData);

            // Fit content
            chartRef.current.timeScale().fitContent();
          } catch (error) {
            console.log('Chart operation failed - chart may be disposed:', error);
          }
        }
      } else {
        console.warn('No valid candle data to display');
      }
    } catch (error) {
      console.error('Failed to load candles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative bg-black rounded-lg border border-gray-800 p-4 h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg z-10">
          <div className="flex items-center space-x-2 text-gray-400 font-mono">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <span>LOADING CHART...</span>
          </div>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
