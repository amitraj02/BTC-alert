#!/usr/bin/env python3
"""
BTC_papaertrading.py — Simulated BTC/USDT paper trading bot using 3-candle Swing Low/High.
"""

import sys
import os
import json
import time
from datetime import datetime

# ==============================================================================
#  USER CONFIGURATION
# ==============================================================================
# You can hardcode your preferred time interval here.
# Supported intervals: "1m", "5m", "15m", "30m", "60m" (or "1h")
TIME_INTERVAL = "30m"


# ==============================================================================
#  IMPORT SHARED FUNCTIONS & COLOR CODES
# ==============================================================================
try:
    from swing_low_signal_finder import (
        fetch_candles,
        analyze_swings,
        get_current_ltp,
        INTERVAL_MAPPING,
        play_alert_sound,
        G, Y, C, R, M, B, D, X, BG_R,
        WICK_THRESHOLD
    )
except ImportError:
    print("\033[91m⚠️ Error: Could not import swing_low_signal_finder.py.\033[0m")
    print("Ensure both scripts are in the same folder (/Users/amitraj/git_repo_project/bitcoin_trading_bot).")
    sys.exit(1)

# Persistent storage file path
PORTFOLIO_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "paper_portfolio.json")
FEE_RATE = 0.002  # 0.2% standard exchange trading fee

# In-memory activity log limit
MAX_LOG_ENTRIES = 6
activity_logs = []

def add_log(msg):
    """Add a timestamped entry to the in-memory activity logs."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    activity_logs.append(f"{D}{timestamp} | {msg}{X}")
    if len(activity_logs) > MAX_LOG_ENTRIES:
        activity_logs.pop(0)

# ==============================================================================
#  PORTFOLIO STORAGE STATE MANAGEMENT
# ==============================================================================

def load_portfolio():
    """Load virtual balance state and transaction history from JSON file."""
    default_state = {
        "usd_balance": 10000.0,
        "btc_balance": 0.0,
        "initial_usd_balance": 10000.0,
        "entry_price": 0.0,
        "stop_loss": 0.0,
        "target_price": 0.0,
        "transactions": []
    }
    if os.path.exists(PORTFOLIO_FILE):
        try:
            with open(PORTFOLIO_FILE, "r") as f:
                data = json.load(f)
                # Fill missing keys dynamically (e.g. for existing files)
                needs_save = False
                for k, v in default_state.items():
                    if k not in data:
                        data[k] = v
                        needs_save = True
                if needs_save:
                    save_portfolio(data)
                return data
        except Exception as e:
            add_log(f"Failed to read portfolio file: {e}. Reinitializing defaults.")
    
    save_portfolio(default_state)
    return default_state

def save_portfolio(portfolio):
    """Write virtual balance state and transaction history to JSON file."""
    try:
        with open(PORTFOLIO_FILE, "w") as f:
            json.dump(portfolio, f, indent=4)
    except Exception as e:
        add_log(f"Failed to save portfolio state: {e}")

# ==============================================================================
#  ORDER EXECUTION SYSTEM
# ==============================================================================

def execute_buy(portfolio, price, sl_price, target_price):
    """Simulates buying BTC with all available USD balance and setting SL/Target."""
    usd = portfolio["usd_balance"]
    if usd <= 1.0: # Ignore tiny dust balances
        return False, "Insufficient cash balance to buy."
        
    fee = usd * FEE_RATE
    net_usd = usd - fee
    btc_bought = net_usd / price
    
    # Update balances and trade target boundaries
    portfolio["usd_balance"] = 0.0
    portfolio["btc_balance"] += btc_bought
    portfolio["entry_price"] = price
    portfolio["stop_loss"] = sl_price
    portfolio["target_price"] = target_price
    
    tx = {
        "type": "BUY",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "price": price,
        "amount_btc": btc_bought,
        "total_usd": usd,
        "fee_usd": fee,
        "stop_loss": sl_price,
        "target": target_price
    }
    portfolio["transactions"].append(tx)
    save_portfolio(portfolio)
    return True, f"Bought {G}{btc_bought:.6f} BTC{X} at ${price:,.2f} (SL: ${sl_price:,.2f}, Target: ${target_price:,.2f})"

def execute_sell(portfolio, price, reason="Swing High"):
    """Simulates selling all accumulated BTC holdings for USD."""
    btc = portfolio["btc_balance"]
    if btc <= 0.000001: # Ignore tiny dust BTC balances
        return False, "Insufficient BTC holdings to sell."
        
    proceeds = btc * price
    fee = proceeds * FEE_RATE
    net_usd = proceeds - fee
    
    # Update balances and reset active trade targets
    portfolio["btc_balance"] = 0.0
    portfolio["usd_balance"] += net_usd
    portfolio["entry_price"] = 0.0
    portfolio["stop_loss"] = 0.0
    portfolio["target_price"] = 0.0
    
    tx = {
        "type": f"SELL ({reason})",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "price": price,
        "amount_btc": btc,
        "total_usd": net_usd,
        "fee_usd": fee
    }
    portfolio["transactions"].append(tx)
    save_portfolio(portfolio)
    return True, f"Sold {R}{btc:.6f} BTC{X} at ${price:,.2f} for ${net_usd:,.2f} (Reason: {reason})"

# ==============================================================================
#  REAL-TIME DASHBOARD RENDERER
# ==============================================================================

def draw_dashboard(portfolio, ltp, interval_name):
    """Clears the console and draws a styled real-time statement of account."""
    os.system("clear")
    
    # Compute active portfolio metrics
    initial_usd = portfolio["initial_usd_balance"]
    cash_usd = portfolio["usd_balance"]
    btc_held = portfolio["btc_balance"]
    btc_val = btc_held * ltp
    total_val = cash_usd + btc_val
    
    pnl_usd = total_val - initial_usd
    pnl_pct = (pnl_usd / initial_usd) * 100.0
    
    pnl_color = G if pnl_usd >= 0 else R
    pnl_sign = "+" if pnl_usd >= 0 else ""
    
    print(f"{C}{B}╔══════════════════════════════════════════════════════════════════════╗{X}")
    print(f"{C}{B}║             🪙 BTC/USDT LIVE PAPER TRADING PORTFOLIO                 ║{X}")
    print(f"{C}{B}╚══════════════════════════════════════════════════════════════════════╝{X}")
    print(f"  {B}Status:{X} {G}Monitoring Strategy (3-Candle Swing + SL/Target){X}")
    print(f"  {B}Interval:{X} {Y}{interval_name}{X}  │  {B}Polling:{X} {Y}30s{X}  │  {B}Wick Threshold:{X} {Y}>{int(WICK_THRESHOLD)} pts{X}")
    print(f"  {B}Last Checked Time:{X} {datetime.now().strftime('%H:%M:%S')}  │  {B}BTC Price (LTP):{X} {G}${ltp:,.2f}{X}")
    print(f"{D}────────────────────────────────────────────────────────────────────────{X}")
    
    # Account holdings values
    print(f"  {B}PORTFOLIO STATEMENT:{X}")
    print(f"    • Initial Capital Allocation : {D}${initial_usd:,.2f} USD{X}")
    print(f"    • Virtual Cash Balance (USD) : {B}${cash_usd:,.2f} USD{X}")
    print(f"    • Bitcoin Holdings (BTC)     : {B}{btc_held:.8f} BTC{X} {D}(Value: ${btc_val:,.2f} USD){X}")
    
    # Render active SL and Target price points if holding BTC
    if btc_held > 0.000001:
        entry_p = portfolio.get("entry_price", 0.0)
        sl_p = portfolio.get("stop_loss", 0.0)
        tgt_p = portfolio.get("target_price", 0.0)
        print(f"    • Active Position Entry Price: {D}${entry_p:,.2f} USD{X}")
        print(f"    • Active Position Stop Loss  : {R}${sl_p:,.2f} USD{X}")
        print(f"    • Active Position Target     : {G}${tgt_p:,.2f} USD{X}")
        
    print(f"    • Combined Net Worth (Total) : {C}{B}${total_val:,.2f} USD{X}")
    print(f"    • Return on Investment (P&L) : {pnl_color}{B}{pnl_sign}${pnl_usd:,.2f} ({pnl_sign}{pnl_pct:.2f}%){X}")
    print(f"{D}────────────────────────────────────────────────────────────────────────{X}")
    
    # Transactions table
    print(f"  {B}RECENT SIMULATED TRANSACTIONS (Last 5):{X}")
    txs = portfolio["transactions"][-5:]
    if not txs:
        print(f"    {D}[No transactions recorded yet. Waiting for swing low/high signals...]{X}")
    else:
        print(f"    {'Time':^19}  {'Type':^12}  {'BTC Amount':^12}  {'LTP Price':^12}  {'Total USD':^12}  {'Fee Paid':^8}")
        print(f"    {'─'*19}  {'─'*12}  {'─'*12}  {'─'*12}  {'─'*12}  {'─'*8}")
        for t in reversed(txs):
            tx_type = t["type"]
            tx_color = G if "BUY" in tx_type else R
            print(f"    {t['timestamp']:^19}  {tx_color}{B}{tx_type:^12}{X}  {t['amount_btc']:>12.6f}  ${t['price']:>11.2f}  ${t['total_usd']:>11.2f}  ${t['fee_usd']:>7.2f}")
    print(f"{D}────────────────────────────────────────────────────────────────────────{X}")
    
    # Console logs
    print(f"  {B}ACTIVITY LOGS (Last {len(activity_logs)}):{X}")
    for log in activity_logs:
        print(f"    {log}")
    print(f"\n  {D}Press Ctrl+C to stop simulation.{X}")

# ==============================================================================
#  MAIN LOOP
# ==============================================================================

def main():
    # Parse command line argument for interval setting
    interval_name = TIME_INTERVAL
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower().strip()
        if arg in INTERVAL_MAPPING:
            interval_name = arg
            
    # Fallback to "60m" if invalid
    if interval_name not in INTERVAL_MAPPING:
        interval_name = "60m"
        
    api_interval = INTERVAL_MAPPING[interval_name]
    
    # Load virtual portfolio
    portfolio = load_portfolio()
    
    add_log(f"Bot started. Virtual balance: ${portfolio['usd_balance']:,.2f} USD | {portfolio['btc_balance']:.6f} BTC")
    
    # Initialize the alerted swings set with historical candles
    # This prevents the bot from executing orders on old historical signals on start
    add_log(f"Fetching historical candles to calibrate swing state...")
    candles = fetch_candles(100, interval_name=interval_name)
    if not candles:
        print(f"{R}Could not retrieve baseline candle data. Exiting.{X}")
        return

    # Extract all past swing timestamps
    historical_swings = analyze_swings(candles)
    alerted_timestamps = {s["timestamp_ms"] for s in historical_swings}
    add_log(f"State loaded: Ignoring {len(historical_swings)} historical swing timestamps.")
    
    try:
        while True:
            # 1. Fetch live candle values
            candles = fetch_candles(10, interval_name=interval_name)
            if candles:
                # Get current LTP
                ltp = get_current_ltp()
                if ltp is None:
                    ltp = float(candles[0]["close"])
                
                # Check active Stop Loss or Target price breaches
                if portfolio["btc_balance"] > 0.000001:
                    sl_p = portfolio.get("stop_loss", 0.0)
                    tgt_p = portfolio.get("target_price", 0.0)
                    
                    if sl_p > 0 and ltp <= sl_p:
                        add_log(f"🚨 Stop Loss breached at ${ltp:,.2f}! (SL level: ${sl_p:,.2f})")
                        play_alert_sound()
                        success, msg = execute_sell(portfolio, ltp, reason="STOP LOSS")
                        add_log(msg)
                    elif tgt_p > 0 and ltp >= tgt_p:
                        add_log(f"🎯 Profit Target achieved at ${ltp:,.2f}! (Target: ${tgt_p:,.2f})")
                        play_alert_sound()
                        success, msg = execute_sell(portfolio, ltp, reason="TARGET")
                        add_log(msg)
                
                # Check for new swing alerts
                swings = analyze_swings(candles)
                
                # Verified swings must be at index >= 2 (fully closed candle)
                for s in swings:
                    if s["index"] >= 2:
                        ts = s["timestamp_ms"]
                        if ts not in alerted_timestamps:
                            alerted_timestamps.add(ts)
                            
                            # Execute simulated trade based on swing signal
                            if s["type"] == "Low":
                                # Swing Low detected: Buy Signal - only buy if not holding BTC
                                if portfolio["btc_balance"] <= 0.000001:
                                    play_alert_sound()
                                    add_log(f"🔥 Swing LOW detected! Attempting BUY.")
                                    # SL is the low of the swing candle, Profit Target is entry + 300
                                    sl_val = s["low"]
                                    tgt_val = ltp + 300.0
                                    success, msg = execute_buy(portfolio, ltp, sl_price=sl_val, target_price=tgt_val)
                                    add_log(msg)
                            elif s["type"] == "High":
                                # Swing High detected: Sell Signal - only sell if holding BTC
                                if portfolio["btc_balance"] > 0.000001:
                                    play_alert_sound()
                                    add_log(f"🔥 Swing HIGH detected! Attempting SELL.")
                                    success, msg = execute_sell(portfolio, ltp, reason="Swing High")
                                    add_log(msg)
                
                # Draw live dashboard
                draw_dashboard(portfolio, ltp, interval_name)
                
            time.sleep(30)
            
    except KeyboardInterrupt:
        print(f"\n\n{Y}Paper trading simulation stopped.{X}\n")

if __name__ == "__main__":
    main()
