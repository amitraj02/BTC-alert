#!/usr/bin/env python3
"""
fetch_bitcoin_ltp.py — Live BTC/USDT Price & Order Book from CoinDCX
"""

import time
import sys
import os
import requests

# ANSI colors
G = "\033[92m"; Y = "\033[93m"; C = "\033[96m"; R = "\033[91m"
B = "\033[1m";  D = "\033[2m";  X = "\033[0m"

TICKER_API = "https://api.coindcx.com/exchange/ticker"
ORDERBOOK_API = "https://public.coindcx.com/market_data/orderbook?pair=B-BTC_USDT"

def get_live_data():
    try:
        # 1. Fetch LTP
        ticker_res = requests.get(TICKER_API, timeout=5)
        if ticker_res.status_code != 200:
            return None, f"Ticker API error: HTTP {ticker_res.status_code}"
        
        ticker_data = ticker_res.json()
        btc_tick = next((item for item in ticker_data if item.get("market") == "BTCUSDT"), None)
        if not btc_tick:
            return None, "BTCUSDT market not found in ticker data"
        
        ltp = float(btc_tick["last_price"])

        # 2. Fetch Order Book
        ob_res = requests.get(ORDERBOOK_API, timeout=5)
        bids, asks = [], []
        if ob_res.status_code == 200:
            ob_data = ob_res.json()
            raw_bids = ob_data.get("bids", {})
            raw_asks = ob_data.get("asks", {})
            
            sorted_bids = sorted([(float(p), float(q)) for p, q in raw_bids.items()], key=lambda x: x[0], reverse=True)
            sorted_asks = sorted([(float(p), float(q)) for p, q in raw_asks.items()], key=lambda x: x[0])
            
            bids = sorted_bids[:5]
            asks = sorted_asks[:5]

        return {
            "ltp": ltp,
            "bids": bids,
            "asks": asks,
            "timestamp": time.strftime("%H:%M:%S")
        }, None

    except Exception as e:
        return None, str(e)

def main():
    print(f"{C}{B}Starting CoinDCX Live BTC/USDT Fetcher...{X}")
    print(f"{D}Press Ctrl+C to exit.{X}\n")
    
    last_price = None
    try:
        while True:
            data, err = get_live_data()
            if err:
                sys.stdout.write(f"\r{R}⚠️ Error: {err}{X}                     ")
                sys.stdout.flush()
            else:
                ltp = data["ltp"]
                timestamp = data["timestamp"]
                
                color = Y
                trend = "→"
                if last_price is not None:
                    if ltp > last_price:
                        color = G
                        trend = "▲"
                    elif ltp < last_price:
                        color = R
                        trend = "▼"
                last_price = ltp

                os.system("clear")
                print(f"{C}{B}╔══════════════════════════════════════════════════════╗{X}")
                print(f"{C}{B}║            🪙 COINDCX BTC/USDT LIVE TICK             ║{X}")
                print(f"{C}{B}╚══════════════════════════════════════════════════════╝{X}")
                print(f"\n  {B}LTP Price :{X} {color}{B}${ltp:,.2f} {trend}{X}")
                print(f"  {B}Timestamp :{X} {timestamp}")
                
                if data["asks"] or data["bids"]:
                    print(f"\n  {B}─── ORDER BOOK (Top 5 asks/bids) ───────────────────{X}")
                    print(f"  {D}Asks (Sell Orders):{X}")
                    for p, q in reversed(data["asks"]):
                        print(f"    {R}${p:,.2f}{X}  │  Qty: {q:.6f}")
                        
                    print(f"  {B}  ⚡ Spread Mid-LTP: ${ltp:,.2f}{X}")
                    
                    print(f"  {D}Bids (Buy Orders):{X}")
                    for p, q in data["bids"]:
                        print(f"    {G}${p:,.2f}{X}  │  Qty: {q:.6f}")
                
                print(f"\n  {D}Updating every 2 seconds... [Ctrl+C to stop]{X}")

            time.sleep(2)
            
    except KeyboardInterrupt:
        print(f"\n{Y}Fetcher stopped.{X}\n")

if __name__ == "__main__":
    main()
