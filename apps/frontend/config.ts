// Frontend configuration
export const config = {
  // Backend API URL
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1',

  // Trading Configuration
  DEFAULT_LEVERAGE: parseInt(process.env.NEXT_PUBLIC_DEFAULT_LEVERAGE || '10'),
  MAX_LEVERAGE: parseInt(process.env.NEXT_PUBLIC_MAX_LEVERAGE || '1000'),
};
