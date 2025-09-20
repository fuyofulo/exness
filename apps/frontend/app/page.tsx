'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { TradingDashboard } from '../components/TradingDashboard';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <TradingDashboard />;
  }

  return <AuthPage />;
}

function AuthPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await login(email);
      toast.success('Check your email for the magic link!');
    } catch (error) {
      toast.error('Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono">TRADING EXCHANGE</h1>
          <p className="text-gray-400 font-mono">ENTER YOUR EMAIL TO GET STARTED</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2 font-mono">
              EMAIL ADDRESS
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white placeholder-gray-400 font-mono"
              placeholder="your@email.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors border border-gray-800 font-mono"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                SENDING...
              </div>
            ) : (
              'SEND MAGIC LINK'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-gray-400 font-mono">
          <p>WE'LL SEND YOU A SECURE MAGIC LINK TO YOUR EMAIL</p>
        </div>
      </div>
    </div>
  );
}