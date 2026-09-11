'use client';

import React from 'react';
import { PatternSignal } from '@/lib/types/crypto';
import { AlertCircle, TrendingUp, TrendingDown, Layers, Zap } from 'lucide-react';

interface PatternFeedProps {
  signals: PatternSignal[];
  onDispatchAlert: (signal: PatternSignal) => void;
}

export const PatternFeed: React.FC<PatternFeedProps> = ({ signals, onDispatchAlert }) => {
  return (
    <div className="bg-[#181a20] border border-[#2a2e3d] rounded-2xl p-5 shadow-2xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2e3d] pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-300" />
          <h2 className="text-lg font-bold text-slate-100 tracking-wide">Live Pattern Radar</h2>
        </div>
        <span className="bg-[#0f1117] text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-[#2a2e3d] font-mono">
          {signals.length} Signals
        </span>
      </div>

      {/* Signal Log Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[500px] custom-scrollbar">
        {signals.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-[#2a2e3d] rounded-xl bg-[#0f1117]/50">
            <Zap className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-slate-300 font-medium">Scanning live 30m candles for patterns...</p>
            <p className="text-xs text-slate-400 mt-1">
              Wick rejections & 12h Channel breakouts will auto-appear here.
            </p>
          </div>
        ) : (
          signals.map((signal) => {
            const isBullish =
              signal.type === 'WICK_REJECTION_BULLISH' ||
              signal.type === 'SWING_LOW' ||
              signal.type === 'HORIZONTAL_CHANNEL_BREAKOUT_LOW';

            return (
              <div
                key={signal.id}
                className="bg-[#0f1117] border border-[#2a2e3d] hover:border-slate-500 transition-all rounded-xl p-4 relative group shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl border ${
                        isBullish
                          ? 'bg-[#0ecb81]/10 text-[#0ecb81] border-[#0ecb81]/20'
                          : 'bg-[#f6465d]/10 text-[#f6465d] border-[#f6465d]/20'
                      }`}
                    >
                      {isBullish ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{signal.name}</span>
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                            signal.confidence === 'HIGH'
                              ? 'bg-slate-800 text-slate-200 border border-slate-700'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {signal.confidence} CONFIDENCE
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{signal.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onDispatchAlert(signal)}
                    title="Manually trigger alert to Telegram & Email"
                    className="opacity-80 group-hover:opacity-100 bg-[#181a20] hover:bg-slate-700 hover:text-white border border-[#2a2e3d] text-slate-300 p-2 rounded-lg transition-all"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-[#2a2e3d]/60 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Price: ${signal.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span>Timeframe: {signal.timeframe}</span>
                  <span>{new Date(signal.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
