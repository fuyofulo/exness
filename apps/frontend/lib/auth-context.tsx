'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authAPI } from './api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  signup: (email: string) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      // Check if we have an auth cookie by making a request to /me endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/me`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('🔍 Auth check response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Auth check response data:', data);
        if (data.user && data.user.email) {
          console.log('✅ User authenticated:', data.user.email);
          setUser({ email: data.user.email });
        }
      } else {
        console.log('❌ Authentication failed, status:', response.status);
      }
    } catch (error) {
      console.log('❌ Authentication check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      throw new Error('Signup failed');
    }
  };

  const login = async (email: string) => {
    // For this platform, login and signup are the same - user clicks email link
    await signup(email);
    // The backend will send an email with a link to /signin?token=...
  };

  const logout = () => {
    setUser(null);
    // Clear cookies by making a request to logout endpoint (if exists)
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  };

  const deleteAccount = async () => {
    try {
      const response = await authAPI.deleteAccount();
      if (response.success) {
        toast.success('Account deleted successfully');
        setUser(null);
        // Clear cookies
        document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        // Redirect to home page
        window.location.href = '/';
      } else {
        toast.error('Failed to delete account');
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error?.response?.data?.error || 'Failed to delete account');
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    deleteAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
