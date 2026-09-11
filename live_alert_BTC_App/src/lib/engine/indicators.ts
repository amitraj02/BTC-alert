import { Candle } from '../types/crypto';

// EMA calculation
export function calculateEMA(candles: Candle[], period: number): (number | null)[] {
  if (candles.length < period) return new Array(candles.length).fill(null);

  const result: (number | null)[] = new Array(candles.length).fill(null);
  const k = 2 / (period + 1);

  // Initial SMA for period
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  result[period - 1] = prevEma;

  for (let i = period; i < candles.length; i++) {
    const currentEma = candles[i].close * k + prevEma * (1 - k);
    result[i] = currentEma;
    prevEma = currentEma;
  }

  return result;
}

// Session/Day VWAP calculation
export function calculateVWAP(candles: Candle[]): (number | null)[] {
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;
  let currentDay = -1;

  return candles.map((candle) => {
    const date = new Date(candle.time * 1000);
    const day = date.getUTCDate();

    // Reset VWAP calculation at the start of a new UTC day
    if (day !== currentDay) {
      cumulativeTypicalPriceVolume = 0;
      cumulativeVolume = 0;
      currentDay = day;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTypicalPriceVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    return cumulativeVolume > 0 ? cumulativeTypicalPriceVolume / cumulativeVolume : null;
  });
}

// ATR (Average True Range)
export function calculateATR(candles: Candle[], period: number = 14): (number | null)[] {
  if (candles.length < period) return new Array(candles.length).fill(null);

  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }

  const result: (number | null)[] = new Array(candles.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trs[i];
  }
  let prevAtr = sum / period;
  result[period - 1] = prevAtr;

  for (let i = period; i < candles.length; i++) {
    const currentAtr = (prevAtr * (period - 1) + trs[i]) / period;
    result[i] = currentAtr;
    prevAtr = currentAtr;
  }

  return result;
}

// Supertrend Indicator (ATR = 10, Multiplier = 3)
export interface SupertrendPoint {
  value: number;
  direction: 'UP' | 'DOWN';
}

export function calculateSupertrend(
  candles: Candle[],
  period: number = 10,
  multiplier: number = 3
): (SupertrendPoint | null)[] {
  const atr = calculateATR(candles, period);
  const result: (SupertrendPoint | null)[] = new Array(candles.length).fill(null);

  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let prevSupertrend = 0;
  let prevDirection: 'UP' | 'DOWN' = 'UP';

  for (let i = 0; i < candles.length; i++) {
    const currentAtr = atr[i];
    if (currentAtr === null) continue;

    const hl2 = (candles[i].high + candles[i].low) / 2;
    let basicUpperBand = hl2 + multiplier * currentAtr;
    let basicLowerBand = hl2 - multiplier * currentAtr;

    let finalUpperBand =
      i > 0 && basicUpperBand < prevUpperBand || (candles[i - 1]?.close ?? 0) > prevUpperBand
        ? basicUpperBand
        : prevUpperBand;
    let finalLowerBand =
      i > 0 && basicLowerBand > prevLowerBand || (candles[i - 1]?.close ?? 0) < prevLowerBand
        ? basicLowerBand
        : prevLowerBand;

    let direction: 'UP' | 'DOWN' = prevDirection;
    let supertrend = 0;

    if (prevDirection === 'UP') {
      if (candles[i].close < finalLowerBand) {
        direction = 'DOWN';
        supertrend = finalUpperBand;
      } else {
        supertrend = finalLowerBand;
      }
    } else {
      if (candles[i].close > finalUpperBand) {
        direction = 'UP';
        supertrend = finalLowerBand;
      } else {
        supertrend = finalUpperBand;
      }
    }

    result[i] = { value: supertrend, direction };

    prevUpperBand = finalUpperBand;
    prevLowerBand = finalLowerBand;
    prevSupertrend = supertrend;
    prevDirection = direction;
  }

  return result;
}

// Horizontal Channel (High & Low of last N hours)
export function calculateHorizontalChannel(candles: Candle[], hours: number = 12): { high: number; low: number } | null {
  if (candles.length === 0) return null;

  const latestTime = candles[candles.length - 1].time;
  const cutoffTime = latestTime - hours * 3600;

  const targetCandles = candles.filter((c) => c.time >= cutoffTime);
  if (targetCandles.length === 0) return null;

  let highest = -Infinity;
  let lowest = Infinity;

  for (const c of targetCandles) {
    if (c.high > highest) highest = c.high;
    if (c.low < lowest) lowest = c.low;
  }

  return { high: highest, low: lowest };
}
