'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { TradingChart } from '@/components/TradingChart';
import { PatternFeed } from '@/components/PatternFeed';
import { AlertSettingsModal } from '@/components/AlertSettingsModal';
import {
  Candle,
  TickerData,
  Timeframe,
  IndicatorSettings,
  PatternSignal,
  AlertConfig,
} from '@/lib/types/crypto';
import { fetchKlines, fetch24hTicker, BinanceWebSocket } from '@/lib/services/binance';
import { analyzeCandlePatterns } from '@/lib/engine/patternEngine';
import { Sliders, RefreshCw, Eye, Zap, Volume2, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('30m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [signals, setSignals] = useState<PatternSignal[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Indicators toggle state
  const [indicators, setIndicators] = useState<IndicatorSettings>({
    showEma9: true,
    showEma20: true,
    showEma50: false,
    showEma200: true,
    showVwap: true,
    showSupertrend: false,
    showChannel: true,
  });

  // Alert Settings state
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    telegramEnabled: true,
    telegramBotToken: '8760488329:AAHwrEKD8Wn5o5v21jrxvkleOHxectNnId0',
    telegramChatId: '766459648',
    emailEnabled: true,
    emailRecipient: 'dugu19raj@gmail.com',
    soundEnabled: true,
    triggers: {
      wickRejection: true,
      horizontalChannel: true,
      swingPoints: true,
      volumeBreakout: true,
    },
  });

  // Track dispatched signals to prevent duplicate automated alerts
  const dispatchedSignalsRef = useRef<Set<string>>(new Set());

  // Function to dispatch alerts via API routes
  const dispatchAlert = useCallback(
    async (signal: PatternSignal) => {
      // 1. Audio Notification
      if (alertConfig.soundEnabled && typeof window !== 'undefined') {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
          // Audio context suppressed by browser policy
        }
      }

      // 2. Telegram Alert Dispatch
      if (alertConfig.telegramEnabled && alertConfig.telegramChatId) {
        try {
          const msg = `🚨 <b>BTC SIGNAL ALERT: ${signal.name}</b> 🚨\n\n` +
            `• <b>Timeframe:</b> ${signal.timeframe}\n` +
            `• <b>Price:</b> $${signal.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
            `• <b>Confidence:</b> ${signal.confidence}\n` +
            `• <b>Details:</b> ${signal.description}\n\n` +
            `<i>Scanned via Raj-BTC Alert Terminal</i>`;

          await fetch('/api/alerts/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botToken: alertConfig.telegramBotToken,
              chatId: alertConfig.telegramChatId,
              message: msg,
            }),
          });
        } catch (err) {
          console.error('Failed to dispatch Telegram alert:', err);
        }
      }

      // 3. Email Alert Dispatch
      if (alertConfig.emailEnabled && alertConfig.emailRecipient) {
        try {
          await fetch('/api/alerts/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: alertConfig.emailRecipient,
              subject: `[BTC Alert] ${signal.name} on ${signal.timeframe}`,
              message: `${signal.description} (Price: $${signal.price})`,
            }),
          });
        } catch (err) {
          console.error('Failed to dispatch Email alert:', err);
        }
      }
    },
    [alertConfig]
  );

  // Initial historical data fetch & 24h ticker load
  const loadMarketData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedCandles, tickerData] = await Promise.all([
        fetchKlines(timeframe, 300),
        fetch24hTicker(),
      ]);

      setCandles(fetchedCandles);
      setTicker(tickerData);

      // Run pattern analysis on initial dataset
      const detected = analyzeCandlePatterns(fetchedCandles, timeframe);
      setSignals(detected);
    } catch (err) {
      console.error('Failed to load BTC market data:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Live WebSocket Connection Management
  useEffect(() => {
    let ws: BinanceWebSocket | null = null;

    ws = new BinanceWebSocket(
      timeframe,
      (updatedCandle: Candle) => {
        setWsConnected(true);
        setCandles((prevCandles) => {
          if (!prevCandles.length) return [updatedCandle];

          const lastCandle = prevCandles[prevCandles.length - 1];
          let updatedList: Candle[];

          if (lastCandle.time === updatedCandle.time) {
            // Update existing current candle
            updatedList = [...prevCandles.slice(0, -1), updatedCandle];
          } else {
            // New candle closed, append
            updatedList = [...prevCandles, updatedCandle];
          }

          // Run pattern analysis on updated candles
          const detected = analyzeCandlePatterns(updatedList, timeframe);
          setSignals(detected);

          // Check for newly triggered pattern signals
          detected.forEach((sig) => {
            if (!dispatchedSignalsRef.current.has(sig.id)) {
              dispatchedSignalsRef.current.add(sig.id);
              dispatchAlert(sig);
            }
          });

          return updatedList;
        });
      },
      (price: number) => {
        setTicker((prev) => (prev ? { ...prev, price } : null));
      }
    );

    ws.connect();

    return () => {
      if (ws) ws.disconnect();
      setWsConnected(false);
    };
  }, [timeframe, dispatchAlert]);

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <Header
        ticker={ticker}
        wsConnected={wsConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
        signalCount={signals.length}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 space-y-4">
        {/* Controls Toolbar */}
        <div className="bg-[#181a20] border border-[#2a2e3d] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          {/* Timeframe Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold mr-1">Timeframe:</span>
            {(['5m', '15m', '30m', '1h'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-slate-200 text-slate-950 shadow-md'
                    : 'bg-[#0f1117] text-slate-300 hover:bg-[#202430] border border-[#2a2e3d]'
                }`}
              >
                {tf} {tf === '30m' && <span className="text-[10px] opacity-80">(Recommended)</span>}
              </button>
            ))}
          </div>

          {/* Indicators Toggle Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold mr-1 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Indicators:
            </span>
            <button
              onClick={() => setIndicators({ ...indicators, showEma9: !indicators.showEma9 })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                indicators.showEma9
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : 'bg-[#0f1117] text-slate-500 border-[#2a2e3d]'
              }`}
            >
              EMA 9
            </button>
            <button
              onClick={() => setIndicators({ ...indicators, showEma20: !indicators.showEma20 })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                indicators.showEma20
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-[#0f1117] text-slate-500 border-[#2a2e3d]'
              }`}
            >
              EMA 20
            </button>
            <button
              onClick={() => setIndicators({ ...indicators, showEma200: !indicators.showEma200 })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                indicators.showEma200
                  ? 'bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-[#0f1117] text-slate-500 border-[#2a2e3d]'
              }`}
            >
              EMA 200
            </button>
            <button
              onClick={() => setIndicators({ ...indicators, showVwap: !indicators.showVwap })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                indicators.showVwap
                  ? 'bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-[#0f1117] text-slate-500 border-[#2a2e3d]'
              }`}
            >
              VWAP
            </button>
            <button
              onClick={() => setIndicators({ ...indicators, showChannel: !indicators.showChannel })}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                indicators.showChannel
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-[#0f1117] text-slate-500 border-[#2a2e3d]'
              }`}
            >
              12h Channel
            </button>
            <button
              onClick={loadMarketData}
              title="Refresh Market Data"
              className="p-1.5 bg-[#0f1117] hover:bg-[#202430] border border-[#2a2e3d] text-slate-300 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dashboard Grid Layout (Chart + Live Signals Feed) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-4">
            <TradingChart candles={candles} indicators={indicators} signals={signals} />

            {/* Pattern Rules Quick Reference */}
            <div className="bg-[#181a20] border border-[#2a2e3d] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#0f1117] p-3 rounded-xl border border-[#2a2e3d]">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-slate-300" />
                  <span className="font-bold text-slate-100">Rule 1: 12h Horizontal Channel</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Computes 12-hour High/Low range. Triggers high-priority alert when BTC crosses +10% above 12h low or breaks out of resistance.
                </p>
              </div>

              <div className="bg-[#0f1117] p-3 rounded-xl border border-[#2a2e3d]">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-slate-300" />
                  <span className="font-bold text-slate-100">Rule 2: 30m Wick Rejection (&gt;= 2x Body)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Identifies 30m candles where upper/lower wick is at least 2x larger than the candle body (Pinbar support/resistance rejection).
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Pattern Radar Signal Log */}
          <div className="lg:col-span-1">
            <PatternFeed signals={signals} onDispatchAlert={dispatchAlert} />
          </div>
        </div>
      </main>

      {/* Alert Configuration Modal */}
      <AlertSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={alertConfig}
        onSave={(newConfig) => setAlertConfig(newConfig)}
      />
    </div>
  );
}
