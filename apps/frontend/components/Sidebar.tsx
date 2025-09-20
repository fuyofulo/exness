'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { LogOut, LayoutDashboard, BarChart3, TrendingUp, Trash2 } from 'lucide-react';

export type Page = 'dashboard' | 'btc' | 'eth' | 'sol';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { logout, deleteAccount } = useAuth();

  const menuItems = [
    {
      id: 'dashboard' as Page,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'btc' as Page,
      label: 'BTC Market',
      icon: BarChart3,
    },
    {
      id: 'eth' as Page,
      label: 'ETH Market',
      icon: BarChart3,
    },
    {
      id: 'sol' as Page,
      label: 'SOL Market',
      icon: BarChart3,
    },
  ];

  return (
    <div className="w-64 bg-black border-r border-gray-800 flex flex-col h-full">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <TrendingUp className="h-8 w-8 text-white" />
          <h1 className="text-xl font-bold text-white font-mono">TRADING EXCHANGE</h1>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors font-mono ${
                    isActive
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Action Buttons - Fixed at bottom */}
      <div className="mt-auto p-4 border-t border-gray-800 space-y-2">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-gray-900 hover:text-white rounded-lg transition-colors font-mono"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">LOGOUT</span>
        </button>
        
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone and will close all your open trades.')) {
              deleteAccount();
            }
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors font-mono"
        >
          <Trash2 className="h-5 w-5" />
          <span className="font-medium">DELETE ACCOUNT</span>
        </button>
      </div>
    </div>
  );
}
