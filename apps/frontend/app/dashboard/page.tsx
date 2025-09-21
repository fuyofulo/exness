'use client';

import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { TradingDashboard } from '../../components/TradingDashboard';

export default function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('🏠 Dashboard: isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', user);
    if (!isLoading && !isAuthenticated) {
      console.log('🏠 Dashboard: Redirecting to home page');
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to home page
  }

  return <TradingDashboard />;
}
