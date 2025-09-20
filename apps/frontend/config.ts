// Frontend configuration
export const config = {
  // Backend API URL
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1',

  // Trading Configuration
  SUPPORTED_ASSETS: (process.env.NEXT_PUBLIC_SUPPORTED_ASSETS || 'BTC,ETH,SOL').split(','),
  DEFAULT_LEVERAGE: parseInt(process.env.NEXT_PUBLIC_DEFAULT_LEVERAGE || '10'),
  MAX_LEVERAGE: parseInt(process.env.NEXT_PUBLIC_MAX_LEVERAGE || '1000'),

  // TradingView Configuration
  TV_CHART_HEIGHT: parseInt(process.env.NEXT_PUBLIC_TV_CHART_HEIGHT || '600'),
};
