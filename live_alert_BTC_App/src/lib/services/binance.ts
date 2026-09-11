import { Candle, TickerData, Timeframe } from '../types/crypto';

// Map App Timeframe to Binance interval parameter
const intervalMap: Record<Timeframe, string> = {
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
};

export async function fetchKlines(timeframe: Timeframe = '30m', limit: number = 200): Promise<Candle[]> {
  const interval = intervalMap[timeframe] || '30m';
  
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      throw new Error(`Binance API error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.map((k: any) => ({
      time: Math.floor(k[0] / 1000), // convert ms to Unix timestamp (seconds)
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (err) {
    console.warn('Failed to fetch from Binance, attempting CoinGecko fallback...', err);
    return fetchCoinGeckoFallback();
  }
}

export async function fetch24hTicker(): Promise<TickerData> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch 24h ticker');
    const data = await res.json();
    return {
      symbol: 'BTC/USDT',
      price: parseFloat(data.lastPrice),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      change24h: parseFloat(data.priceChangePercent),
      volume24h: parseFloat(data.volume),
    };
  } catch (error) {
    return {
      symbol: 'BTC/USDT',
      price: 65000,
      high24h: 66500,
      low24h: 64200,
      change24h: 1.25,
      volume24h: 34500,
    };
  }
}

async function fetchCoinGeckoFallback(): Promise<Candle[]> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=1');
    const data = await res.json();
    return data.map((item: [number, number, number, number, number]) => ({
      time: Math.floor(item[0] / 1000),
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: 100, // Default fallback volume
    }));
  } catch (err) {
    console.error('CoinGecko fallback failed:', err);
    return [];
  }
}

export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private onCandleUpdate: (candle: Candle) => void;
  private onTickerUpdate?: (price: number) => void;
  private timeframe: Timeframe;

  constructor(timeframe: Timeframe, onCandleUpdate: (candle: Candle) => void, onTickerUpdate?: (price: number) => void) {
    this.timeframe = timeframe;
    this.onCandleUpdate = onCandleUpdate;
    this.onTickerUpdate = onTickerUpdate;
  }

  connect() {
    const interval = intervalMap[this.timeframe];
    const streamUrl = `wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`;

    try {
      this.ws = new WebSocket(streamUrl);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.e === 'kline') {
            const k = data.k;
            const candle: Candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            };

            this.onCandleUpdate(candle);
            if (this.onTickerUpdate) {
              this.onTickerUpdate(candle.close);
            }
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Binance WS Error:', err);
      };

      this.ws.onclose = () => {
        // Reconnect after 3s delay
        setTimeout(() => {
          if (this.ws) this.connect();
        }, 3000);
      };
    } catch (e) {
      console.error('Failed to create WebSocket', e);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
