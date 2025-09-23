'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authAPI } from './api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (email: string, password: string) => Promise<any>;
  signin: (email: string, password: string) => Promise<any>;
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
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('❌ No auth token in localStorage');
        setIsLoading(false);
        return;
      }

      // Check authentication with token in header
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
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

  const signup = async (email: string, password: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Signup failed');
    }

    // Store token and redirect
    if (data.token) {
      localStorage.setItem('authToken', data.token);
      setUser({ email });
    }

    return data;
  };

  const signin = async (email: string, password: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api/v1'}/user/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Signin failed');
    }

    // Store token and set user
    if (data.token) {
      localStorage.setItem('authToken', data.token);
      setUser({ email });
    }

    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
  };

  const deleteAccount = async () => {
    try {
      const response = await authAPI.deleteAccount();
      if (response.success) {
        toast.success('Account deleted successfully');
        setUser(null);
        localStorage.removeItem('authToken');
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
    signup,
    signin,
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
