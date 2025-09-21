import axios from 'axios';
import { config } from '../config';
import { TradeRequest, TradeResponse, CandleData, BalanceData, Timeframe } from '../types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: config.API_URL,
  withCredentials: true, // Important for cookie-based auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Methods
export const tradingAPI = {
  // Execute trading commands
  async executeTrade(request: TradeRequest): Promise<TradeResponse> {
    const response = await api.post('/engine', request);
    return response.data;
  },

  // Get user balance
  async getBalance(): Promise<BalanceData> {
    console.log('🌐 API: Making GET_BALANCE request...');
    const response = await api.post('/engine', { command: 'GET_BALANCE' });
    console.log('🌐 API: Raw response:', response);
    console.log('🌐 API: Response data:', response.data);
    console.log('🌐 API: Engine response:', response.data.engineResponse);
    console.log('🌐 API: Engine response data:', response.data.engineResponse?.data);
    
    const result = response.data.engineResponse.data;
    console.log('🌐 API: Returning balance data:', result);
    return result;
  },

  // Get candles data
  async getCandles(asset: string, interval: Timeframe = '1h'): Promise<CandleData[]> {
    const response = await api.get('/candles', {
      params: { asset, interval }
    });
    return response.data;
  },

  // Get current price
  async getPrice(asset: string) {
    const response = await api.get('/price', {
      params: { asset: `${asset}_USDC` }
    });
    return response.data;
  },
};

// Authentication API
export const authAPI = {
  // Signup - sends email
  async signup(email: string): Promise<{ message: string }> {
    const response = await api.post('/user/signup', { email });
    return response.data;
  },

  // Signin - completes signup via email link
  async signin(token: string): Promise<{ message: string }> {
    const response = await api.get('/user/signin/post', {
      params: { token }
    });
    return response.data;
  },

  // Delete user account
  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    const response = await api.delete('/user/delete');
    return response.data;
  },
};

export default api;
