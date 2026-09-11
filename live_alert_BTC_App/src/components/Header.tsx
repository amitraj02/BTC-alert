'use client';

import React from 'react';
import { TickerData } from '@/lib/types/crypto';
import { Bell, Activity, ShieldCheck, Zap } from 'lucide-react';

interface HeaderProps {
  ticker: TickerData | null;
  wsConnected: boolean;
  onOpenSettings: () => void;
  signalCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  ticker,
  wsConnected,
  onOpenSettings,
  signalCount,
}) => {
  const isPositive = (ticker?.change24h ?? 0) >= 0;

  return (
    <header className="bg-[#181a20] border-b border-[#2a2e3d] px-4 py-3 sticky top-0 z-40 shadow-xl">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Market Name */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-tr from-slate-100 via-slate-300 to-zinc-400 flex items-center justify-center shadow-md shadow-slate-400/20 border border-slate-200/50">
            <span className="font-extrabold font-mono text-slate-950 text-base tracking-tighter">R-Btc</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-wide">Raj-BTC Alert Terminal</h1>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2 py-0.5 rounded font-mono font-semibold">
                GREY EDITION
              </span>
            </div>
            <p className="text-xs text-slate-400">Live OHLC Pattern Scanner & Signal Alerts</p>
          </div>
        </div>

        {/* Live BTC Stats Ticker */}
        {ticker && (
          <div className="flex items-center gap-6 bg-[#0f1117] px-4 py-2 rounded-xl border border-[#2a2e3d]">
            <div>
              <span className="text-xs text-slate-400 block uppercase font-mono">BTC / USDT</span>
              <span className="text-lg font-mono font-bold text-slate-100">
                ${ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="border-l border-[#2a2e3d] pl-4">
              <span className="text-xs text-slate-400 block font-mono">24h Change</span>
              <span
                className={`text-sm font-mono font-semibold ${
                  isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                }`}
              >
                {isPositive ? '+' : ''}
                {ticker.change24h.toFixed(2)}%
              </span>
            </div>

            <div className="hidden md:block border-l border-[#2a2e3d] pl-4">
              <span className="text-xs text-slate-400 block font-mono">24h High</span>
              <span className="text-sm font-mono text-slate-300">
                ${ticker.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="hidden md:block border-l border-[#2a2e3d] pl-4">
              <span className="text-xs text-slate-400 block font-mono">24h Low</span>
              <span className="text-sm font-mono text-slate-300">
                ${ticker.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Action Controls & WS Status */}
        <div className="flex items-center gap-3">
          {/* WS Stream Indicator */}
          <div className="flex items-center gap-2 bg-[#0f1117] px-3 py-1.5 rounded-lg border border-[#2a2e3d] text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                wsConnected ? 'bg-[#0ecb81] animate-pulse shadow-sm shadow-[#0ecb81]' : 'bg-[#f6465d]'
              }`}
            />
            <span className="font-mono text-slate-300">
              {wsConnected ? 'LIVE STREAM' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Alert Config Button */}
          <button
            onClick={onOpenSettings}
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 font-semibold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 text-sm"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            <span>Alert Settings</span>
            {signalCount > 0 && (
              <span className="bg-slate-900 text-slate-200 text-xs px-1.5 py-0.5 rounded-full font-mono border border-slate-700">
                {signalCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
