'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authAPI } from '../../lib/api';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle } from 'lucide-react';

function SigninContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No token provided');
      return;
    }

    const completeSignin = async () => {
      try {
        await authAPI.signin(token);
        setStatus('success');
        setMessage('Successfully signed in! Redirecting...');
        toast.success('Welcome to the trading platform!');

        // Redirect to main page after a short delay
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } catch (error: any) {
        setStatus('error');
        setMessage(error?.response?.data?.message || 'Signin failed');
        toast.error('Signin failed');
      }
    };

    completeSignin();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Exchange</h1>
          <p className="text-gray-400">Completing your sign in...</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-300">Verifying your email...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-green-400 font-semibold">{message}</p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-400 font-semibold">{message}</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SigninPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <SigninContent />
    </Suspense>
  );
}
