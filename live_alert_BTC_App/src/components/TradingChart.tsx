'use client';

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  ColorType,
  Time,
  SeriesMarker,
} from 'lightweight-charts';
import { Candle, IndicatorSettings, PatternSignal } from '@/lib/types/crypto';
import { calculateEMA, calculateVWAP, calculateHorizontalChannel } from '@/lib/engine/indicators';

interface TradingChartProps {
  candles: Candle[];
  indicators: IndicatorSettings;
  signals: PatternSignal[];
}

export const TradingChart: React.FC<TradingChartProps> = ({ candles, indicators, signals }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const channelHighLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const channelLowLineRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create TradingView Lightweight Chart in Grey Theme
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#475569', style: 2 },
        horzLine: { color: '#475569', style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2a2e3d',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#2a2e3d',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick Series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Volume Histogram
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: '#475569',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Indicator Lines
    ema9SeriesRef.current = chart.addLineSeries({ color: '#38bdf8', lineWidth: 1, title: 'EMA 9' });
    ema20SeriesRef.current = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'EMA 20' });
    ema50SeriesRef.current = chart.addLineSeries({ color: '#a855f7', lineWidth: 1, title: 'EMA 50' });
    ema200SeriesRef.current = chart.addLineSeries({ color: '#cbd5e1', lineWidth: 2, title: 'EMA 200' });
    vwapSeriesRef.current = chart.addLineSeries({ color: '#94a3b8', lineWidth: 2, title: 'VWAP' });

    // 12h Channel High/Low Lines
    channelHighLineRef.current = chart.addLineSeries({ color: '#22c55e', lineWidth: 1, lineStyle: 2, title: '12h High' });
    channelLowLineRef.current = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, lineStyle: 2, title: '12h Low' });

    // Handle Window Resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update Data & Indicators
  useEffect(() => {
    if (!candles.length || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    // 1. Format Candles Data
    const formattedCandles: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candlestickSeriesRef.current.setData(formattedCandles);

    // 2. Format Volume Data
    const formattedVolume: HistogramData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)',
    }));
    volumeSeriesRef.current.setData(formattedVolume);

    // 3. Calculate & Render EMAs
    if (indicators.showEma9 && ema9SeriesRef.current) {
      const ema9 = calculateEMA(candles, 9);
      ema9SeriesRef.current.setData(
        candles.map((c, i) => ({ time: c.time as Time, value: ema9[i] ?? NaN })).filter((d) => !isNaN(d.value))
      );
    } else {
      ema9SeriesRef.current?.setData([]);
    }

    if (indicators.showEma20 && ema20SeriesRef.current) {
      const ema20 = calculateEMA(candles, 20);
      ema20SeriesRef.current.setData(
        candles.map((c, i) => ({ time: c.time as Time, value: ema20[i] ?? NaN })).filter((d) => !isNaN(d.value))
      );
    } else {
      ema20SeriesRef.current?.setData([]);
    }

    if (indicators.showEma50 && ema50SeriesRef.current) {
      const ema50 = calculateEMA(candles, 50);
      ema50SeriesRef.current.setData(
        candles.map((c, i) => ({ time: c.time as Time, value: ema50[i] ?? NaN })).filter((d) => !isNaN(d.value))
      );
    } else {
      ema50SeriesRef.current?.setData([]);
    }

    if (indicators.showEma200 && ema200SeriesRef.current) {
      const ema200 = calculateEMA(candles, 200);
      ema200SeriesRef.current.setData(
        candles.map((c, i) => ({ time: c.time as Time, value: ema200[i] ?? NaN })).filter((d) => !isNaN(d.value))
      );
    } else {
      ema200SeriesRef.current?.setData([]);
    }

    // 4. Calculate & Render VWAP
    if (indicators.showVwap && vwapSeriesRef.current) {
      const vwap = calculateVWAP(candles);
      vwapSeriesRef.current.setData(
        candles.map((c, i) => ({ time: c.time as Time, value: vwap[i] ?? NaN })).filter((d) => !isNaN(d.value))
      );
    } else {
      vwapSeriesRef.current?.setData([]);
    }

    // 5. Calculate & Render 12h Horizontal Channel Lines
    if (indicators.showChannel && channelHighLineRef.current && channelLowLineRef.current) {
      const channel12h = calculateHorizontalChannel(candles, 12);
      if (channel12h) {
        channelHighLineRef.current.setData(
          candles.map((c) => ({ time: c.time as Time, value: channel12h.high }))
        );
        channelLowLineRef.current.setData(
          candles.map((c) => ({ time: c.time as Time, value: channel12h.low }))
        );
      }
    } else {
      channelHighLineRef.current?.setData([]);
      channelLowLineRef.current?.setData([]);
    }

    // 6. Signal Overlay Markers on Candlestick Chart
    const markers: SeriesMarker<Time>[] = signals.map((sig) => {
      let position: 'aboveBar' | 'belowBar' = 'aboveBar';
      let shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square' = 'circle';
      let color = '#94a3b8';

      if (sig.type === 'WICK_REJECTION_BULLISH' || sig.type === 'SWING_LOW' || sig.type === 'HORIZONTAL_CHANNEL_BREAKOUT_LOW') {
        position = 'belowBar';
        shape = 'arrowUp';
        color = '#0ecb81';
      } else if (sig.type === 'WICK_REJECTION_BEARISH' || sig.type === 'SWING_HIGH' || sig.type === 'HORIZONTAL_CHANNEL_BREAKOUT_HIGH') {
        position = 'aboveBar';
        shape = 'arrowDown';
        color = '#f6465d';
      }

      return {
        time: sig.timestamp as Time,
        position,
        color,
        shape,
        text: sig.name,
      };
    });

    candlestickSeriesRef.current.setMarkers(markers);
  }, [candles, indicators, signals]);

  return (
    <div className="bg-[#181a20] border border-[#2a2e3d] rounded-2xl p-4 shadow-2xl relative overflow-hidden">
      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden" />
    </div>
  );
};
