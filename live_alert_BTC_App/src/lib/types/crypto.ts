export type Timeframe = '5m' | '15m' | '30m' | '1h';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  high24h: number;
  low24h: number;
  change24h: number;
  volume24h: number;
}

export type PatternType = 
  | 'WICK_REJECTION_BULLISH'
  | 'WICK_REJECTION_BEARISH'
  | 'HORIZONTAL_CHANNEL_BREAKOUT_HIGH'
  | 'HORIZONTAL_CHANNEL_BREAKOUT_LOW'
  | 'SWING_LOW'
  | 'SWING_HIGH'
  | 'BREAKOUT_VOLUME';

export interface PatternSignal {
  id: string;
  type: PatternType;
  name: string;
  timeframe: Timeframe;
  timestamp: number;
  price: number;
  description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  metadata?: {
    channelHigh?: number;
    channelLow?: number;
    wickSize?: number;
    bodySize?: number;
    volumeMultiplier?: number;
  };
}

export interface IndicatorSettings {
  showEma9: boolean;
  showEma20: boolean;
  showEma50: boolean;
  showEma200: boolean;
  showVwap: boolean;
  showSupertrend: boolean;
  showChannel: boolean;
}

export interface AlertConfig {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  emailEnabled: boolean;
  emailRecipient: string;
  soundEnabled: boolean;
  triggers: {
    wickRejection: boolean;
    horizontalChannel: boolean;
    swingPoints: boolean;
    volumeBreakout: boolean;
  };
}

export interface IndicatorValues {
  ema9?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  vwap?: number;
  supertrend?: {
    value: number;
    direction: 'UP' | 'DOWN';
  };
}
