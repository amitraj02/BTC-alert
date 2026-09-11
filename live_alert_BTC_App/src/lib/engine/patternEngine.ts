import { Candle, PatternSignal, Timeframe } from '../types/crypto';
import { calculateHorizontalChannel } from './indicators';

export function analyzeCandlePatterns(
  candles: Candle[],
  timeframe: Timeframe = '30m',
  onlyCompleted: boolean = true
): PatternSignal[] {
  // Exclude current unclosed active candle (candles[candles.length - 1]) to compute alerts ONLY after candle completion
  const targetCandles = onlyCompleted && candles.length > 5 ? candles.slice(0, -1) : candles;
  if (targetCandles.length < 5) return [];

  const signals: PatternSignal[] = [];
  const latestCandle = targetCandles[targetCandles.length - 1]; // Latest fully completed candle
  const prevCandle = targetCandles[targetCandles.length - 2];

  // 1. Script 2: Wick Detection on Completed Candle (30m or active timeframe)
  const bodySize = Math.abs(latestCandle.close - latestCandle.open);
  const upperWick = latestCandle.high - Math.max(latestCandle.open, latestCandle.close);
  const lowerWick = Math.min(latestCandle.open, latestCandle.close) - latestCandle.low;

  // Use a minimum threshold for zero-body (doji) candles to avoid division by zero
  const effectiveBody = Math.max(bodySize, latestCandle.close * 0.0001);

  if (upperWick >= 2 * effectiveBody && upperWick > 0) {
    const wickRatio = (upperWick / effectiveBody).toFixed(1);
    signals.push({
      id: `wick-bear-${latestCandle.time}`,
      type: 'WICK_REJECTION_BEARISH',
      name: 'Bearish Wick Rejection',
      timeframe,
      timestamp: latestCandle.time,
      price: latestCandle.close,
      description: `${timeframe} completed candle upper wick is ${wickRatio}x larger than candle body (Strong Bearish Rejection).`,
      confidence: parseFloat(wickRatio) > 3 ? 'HIGH' : 'MEDIUM',
      metadata: { wickSize: upperWick, bodySize: effectiveBody }
    });
  }

  if (lowerWick >= 2 * effectiveBody && lowerWick > 0) {
    const wickRatio = (lowerWick / effectiveBody).toFixed(1);
    signals.push({
      id: `wick-bull-${latestCandle.time}`,
      type: 'WICK_REJECTION_BULLISH',
      name: 'Bullish Wick Rejection',
      timeframe,
      timestamp: latestCandle.time,
      price: latestCandle.close,
      description: `${timeframe} completed candle lower wick is ${wickRatio}x larger than candle body (Strong Bullish Support Pinbar).`,
      confidence: parseFloat(wickRatio) > 3 ? 'HIGH' : 'MEDIUM',
      metadata: { wickSize: lowerWick, bodySize: effectiveBody }
    });
  }

  // 2. Script 1: Horizontal Channel (Last 12 Hours on Completed Candles)
  const channel12h = calculateHorizontalChannel(targetCandles, 12);
  if (channel12h) {
    const { high, low } = channel12h;
    const channelRange = high - low;
    const lowPlus10Pct = low + 0.10 * channelRange;

    // Check if completed candle crossed above +10% of low price or broke channel boundaries
    if (prevCandle.close <= lowPlus10Pct && latestCandle.close > lowPlus10Pct) {
      signals.push({
        id: `channel-low10-${latestCandle.time}`,
        type: 'HORIZONTAL_CHANNEL_BREAKOUT_LOW',
        name: 'Horizontal Channel Support Bounce (+10%)',
        timeframe,
        timestamp: latestCandle.time,
        price: latestCandle.close,
        description: `Completed candle crossed above +10% of 12h Low ($${low.toFixed(2)}). Close price: $${latestCandle.close.toFixed(2)}.`,
        confidence: 'HIGH',
        metadata: { channelHigh: high, channelLow: low }
      });
    }

    if (prevCandle.close < high && latestCandle.close >= high) {
      signals.push({
        id: `channel-break-high-${latestCandle.time}`,
        type: 'HORIZONTAL_CHANNEL_BREAKOUT_HIGH',
        name: '12-Hour Channel Resistance Breakout',
        timeframe,
        timestamp: latestCandle.time,
        price: latestCandle.close,
        description: `Completed candle closed above 12h Resistance High ($${high.toFixed(2)})!`,
        confidence: 'HIGH',
        metadata: { channelHigh: high, channelLow: low }
      });
    }
  }

  // 3. Swing High / Swing Low (5-candle Pivot on Completed Candles)
  if (targetCandles.length >= 5) {
    const p0 = targetCandles[targetCandles.length - 5];
    const p1 = targetCandles[targetCandles.length - 4];
    const p2 = targetCandles[targetCandles.length - 3]; // Pivot candidate
    const p3 = targetCandles[targetCandles.length - 2];
    const p4 = targetCandles[targetCandles.length - 1]; // Latest completed candle

    if (p2.low < p0.low && p2.low < p1.low && p2.low < p3.low && p2.low < p4.low) {
      signals.push({
        id: `swing-low-${p2.time}`,
        type: 'SWING_LOW',
        name: 'Swing Low Support Pivot',
        timeframe,
        timestamp: p2.time,
        price: p2.low,
        description: `Confirmed 5-candle Swing Low pivot detected at $${p2.low.toFixed(2)}.`,
        confidence: 'MEDIUM',
      });
    }

    if (p2.high > p0.high && p2.high > p1.high && p2.high > p3.high && p2.high > p4.high) {
      signals.push({
        id: `swing-high-${p2.time}`,
        type: 'SWING_HIGH',
        name: 'Swing High Resistance Pivot',
        timeframe,
        timestamp: p2.time,
        price: p2.high,
        description: `Confirmed 5-candle Swing High pivot detected at $${p2.high.toFixed(2)}.`,
        confidence: 'MEDIUM',
      });
    }
  }

  // 4. Volume Surge Breakout on Completed Candle
  const avgVolume = targetCandles.slice(-20).reduce((acc, c) => acc + c.volume, 0) / Math.min(20, targetCandles.length);
  if (latestCandle.volume >= 2.5 * avgVolume && avgVolume > 0) {
    signals.push({
      id: `vol-breakout-${latestCandle.time}`,
      type: 'BREAKOUT_VOLUME',
      name: 'High Volume Expansion',
      timeframe,
      timestamp: latestCandle.time,
      price: latestCandle.close,
      description: `Completed candle volume is ${(latestCandle.volume / avgVolume).toFixed(1)}x higher than 20-period average.`,
      confidence: 'HIGH',
      metadata: { volumeMultiplier: latestCandle.volume / avgVolume }
    });
  }

  return signals;
}
