#!/usr/bin/env python3
"""
fetch_HOLC_data_BTC.py — Fetch and display historical OHLC (Open, High, Low, Close)
data for BTC/USDT from CoinDCX.
"""

import sys
import os
import csv
import requests
from datetime import datetime

# ============================================================
#  USER CONFIGURATION
# ============================================================
# You can hardcode your preferred time interval here.
# Supported intervals: "1m", "3m", "5m", "15m", "30m", "60m"
TIME_INTERVAL = "60m"

# Number of candles to fetch/display
CANDLE_LIMIT = 10
# ============================================================

# ANSI colors
G = "\033[92m"; Y = "\033[93m"; C = "\033[96m"; R = "\033[91m"
B = "\033[1m";  D = "\033[2m";  X = "\033[0m"

CANDLES_API = "https://public.coindcx.com/market_data/candles"

def aggregate_3m(candles_1m):
    """Aggregate 1m candles into 3m candles."""
    aggregated = []
    # Reverse so we build chronological order or process correctly
    # CoinDCX returns candles in reverse chronological order (newest first)
    # Let's group them starting from the newest
    for i in range(0, len(candles_1m), 3):
        group = candles_1m[i:i+3]
        if not group:
            break
        # group[0] is newest in group, group[-1] is oldest in group
        newest = group[0]
        oldest = group[-1]
        
        high = max(float(c["high"]) for c in group)
        low = min(float(c["low"]) for c in group)
        volume = sum(float(c.get("volume", 0)) for c in group)
        
        aggregated.append({
            "time": newest["time"], # Use time of newest candle in group
            "open": oldest["open"], # Open price is the opening of the oldest candle
            "high": high,
            "low": low,
            "close": newest["close"], # Close price is the close of the newest candle
            "volume": volume
        })
    return aggregated

def fetch_ohlc():
    interval_api = TIME_INTERVAL
    
    # Internal mappings for CoinDCX API compatibilities
    if TIME_INTERVAL == "60m":
        interval_api = "1h"
    elif TIME_INTERVAL == "3m":
        interval_api = "1m" # Fetch 1m candles first to aggregate

    # Adjust limit if we need to aggregate 3m from 1m
    fetch_limit = CANDLE_LIMIT
    if TIME_INTERVAL == "3m":
        fetch_limit = CANDLE_LIMIT * 3

    params = {
        "pair": "B-BTC_USDT",
        "interval": interval_api,
        "limit": fetch_limit
    }

    try:
        res = requests.get(CANDLES_API, params=params, timeout=5)
        if res.status_code != 200:
            print(f"{R}Error: API returned status code {res.status_code}{X}")
            return
        
        candles = res.json()
        if not candles:
            print(f"{Y}No candle data returned from API.{X}")
            return

        # Perform 3m aggregation if requested
        if TIME_INTERVAL == "3m":
            candles = aggregate_3m(candles)

        # Slice to requested limit
        candles = candles[:CANDLE_LIMIT]

        # Header Print
        print(f"\n{C}{B}╔══════════════════════════════════════════════════════════╗{X}")
        print(f"{C}{B}║        📊 BTC/USDT HISTORICAL OHLCV CANDLES              ║{X}")
        print(f"{C}{B}╚══════════════════════════════════════════════════════════╝{X}")
        print(f"  {B}Selected Interval:{X} {Y}{TIME_INTERVAL}{X}  │  {B}Limit:{X} {C}{CANDLE_LIMIT}{X}\n")

        print(f"  {'Time':^17}  {'Open':^10}  {'High':^10}  {'Low':^10}  {'Close':^10}  {'Volume':^9}")
        print(f"  {'─'*17}  {'─'*10}  {'─'*10}  {'─'*10}  {'─'*10}  {'─'*9}")

        for c in candles:
            # Timestamp to human readable
            dt = datetime.fromtimestamp(c["time"] / 1000.0)
            t_str = dt.strftime("%Y-%m-%d %H:%M")
            
            o = float(c["open"])
            h = float(c["high"])
            l = float(c["low"])
            cl = float(c["close"])
            vol = float(c.get("volume", 0))

            # Color-code based on candle body direction
            col = G if cl >= o else R

            print(f"  {t_str:^17}  {o:>10.2f}  {h:>10.2f}  {l:>10.2f}  {col}{cl:>10.2f}{X}  {vol:>9.4f}")
            
        print()

        # Save to CSV
        CSV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "btc_ohlc_data.csv")
        try:
            with open(CSV_FILE, mode="w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["Timestamp", "Open", "High", "Low", "Close", "Volume"])
                for c in candles:
                    dt = datetime.fromtimestamp(c["time"] / 1000.0)
                    t_str_full = dt.strftime("%Y-%m-%d %H:%M:%S")
                    writer.writerow([
                        t_str_full,
                        round(float(c["open"]), 2),
                        round(float(c["high"]), 2),
                        round(float(c["low"]), 2),
                        round(float(c["close"]), 2),
                        round(float(c.get("volume", 0)), 6)
                    ])
            print(f"  {G}💾 Saved data to CSV: {CSV_FILE}{X}\n")
        except Exception as csv_err:
            print(f"  {R}⚠️ Failed to save CSV: {csv_err}{X}\n")

    except Exception as e:
        print(f"{R}Exception occurred: {e}{X}")

if __name__ == "__main__":
    fetch_ohlc()
