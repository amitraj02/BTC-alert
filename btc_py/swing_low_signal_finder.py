#!/usr/bin/env python3
"""
swing_low_signal_finder.py — Detects 5-candle Swing Lows and Swing Highs (60m, 30m, 15m, 1m)
with macOS sound alerts and custom wick length thresholds (> 250 points).
"""

import sys
import os
import time
import json
import threading
import subprocess
import requests
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

# ==============================================================================
#  USER CONFIGURATION & ENVIRONMENT VARIABLES
# ==============================================================================
# Supported intervals: "1m", "15m", "30m", "60m" (or "1h")
TIME_INTERVAL = os.environ.get("TIME_INTERVAL", "60m")
WICK_THRESHOLD = float(os.environ.get("WICK_THRESHOLD", 500.0))
PORT = int(os.environ.get("PORT", 10000))

# Alert Recipient Email
ALERT_EMAIL_RECIPIENT = os.environ.get("ALERT_EMAIL_RECIPIENT", "dugu19raj@gmail.com")

# Telegram Bot Alert Credentials
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "766459648")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8760488329:AAHwrEKD8Wn5o5v21jrxvkleOHxectNnId0")

# Global State for Health Check & Status Dashboard
_BOT_STATE = {
    "status": "Active & Monitoring 🟢",
    "start_time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    "last_check_time": None,
    "last_ltp": None,
    "interval": TIME_INTERVAL,
    "total_scans": 0,
    "total_alerts_sent": 0,
    "recent_alerts": []
}
_STATE_LOCK = threading.Lock()



# ==============================================================================
#  STYLES AND ANSI COLOR CODES (matching fetch_bitcoin_ltp.py)
# ==============================================================================
G = "\033[92m"  # Green (Success / Swing Low)
Y = "\033[93m"  # Yellow (Warning / Large Wick)
C = "\033[96m"  # Cyan (Headers / Info)
R = "\033[91m"  # Red (Alert / Swing High)
M = "\033[95m"  # Magenta (Live Status Alerts)
B = "\033[1m"   # Bold text
D = "\033[2m"   # Dim/muted text
X = "\033[0m"   # Reset color codes
BG_R = "\033[41m\033[97m"  # White text on red background for critical labels

# ==============================================================================
#  API CONFIGURATION
# ==============================================================================
CANDLES_API = "https://public.coindcx.com/market_data/candles"
TICKER_API = "https://api.coindcx.com/exchange/ticker"

# Supported intervals mapped to CoinDCX API values.
# Note: Since the CoinDCX API only natively supports ["1m", "15m", "1h", "1d"],
# we fetch 15m candles and aggregate them manually to construct 30m candles.
INTERVAL_MAPPING = {
    "1m": "1m",
    "15m": "15m",
    "30m": "15m",  # Mapped to 15m for manual aggregation
    "60m": "1h",
    "1h": "1h",
}

# ==============================================================================
#  HELPER FUNCTIONS
# ==============================================================================

def aggregate_30m(candles_15m):
    """
    Aggregates native 15m candles into 30m candles.
    CoinDCX returns candles in reverse chronological order (newest first).
    We combine pairs of 15m candles chronologically to create each 30m candle.
    """
    aggregated = []
    # Loop through the list of 15m candles two at a time
    for i in range(0, len(candles_15m), 2):
        group = candles_15m[i:i+2]
        if len(group) < 2:
            # We need both halves of a 30m candle to form a valid aggregate
            break
        
        # In reverse chronological list, group[0] is newer, group[1] is older
        newest = group[0]
        oldest = group[1]
        
        # High is the maximum high of the two halves
        high = max(float(c["high"]) for c in group)
        # Low is the minimum low of the two halves
        low = min(float(c["low"]) for c in group)
        # Volume is the sum volume of the two halves
        volume = sum(float(c.get("volume", 0)) for c in group)
        
        aggregated.append({
            "time": newest["time"],      # Timetag corresponds to the newer window
            "open": oldest["open"],      # Open is the opening price of the older window
            "high": high,
            "low": low,
            "close": newest["close"],    # Close is the closing price of the newer window
            "volume": volume
        })
    return aggregated


def get_current_ltp():
    """
    Fetches the live Last Traded Price (LTP) for BTC/USDT.
    Uses CoinDCX's public ticker API endpoint.
    """
    try:
        res = requests.get(TICKER_API, timeout=5)
        if res.status_code == 200:
            data = res.json()
            # Find the market entry matching 'BTCUSDT'
            btc_tick = next((item for item in data if item.get("market") == "BTCUSDT"), None)
            if btc_tick:
                return float(btc_tick["last_price"])
    except Exception:
        pass
    return None


def fetch_candles(limit=100, interval_name="60m"):
    """
    Fetches BTC/USDT candle data from CoinDCX.
    Automatically handles double fetching and aggregation for the 30m interval.
    """
    api_interval = INTERVAL_MAPPING.get(interval_name, "1h")
    
    # If using 30m, fetch double the limit of 15m candles to yield the requested 30m count
    fetch_limit = limit
    if interval_name == "30m":
        fetch_limit = limit * 2

    params = {
        "pair": "B-BTC_USDT",
        "interval": api_interval,
        "limit": fetch_limit
    }
    
    try:
        res = requests.get(CANDLES_API, params=params, timeout=5)
        if res.status_code == 200:
            candles = res.json()
            # Apply manual aggregation logic if the user requested a 30m interval
            if interval_name == "30m":
                candles = aggregate_30m(candles)
            return candles
    except Exception as e:
        print(f"\n{R}⚠️ Error fetching candles: {e}{X}")
    return []


def play_alert_sound():
    """
    Triggers a sound alert using macOS native 'afplay' utility.
    Falls back to a standard terminal bell character '\a' if not on macOS or sound fails.
    """
    sound_path = "/System/Library/Sounds/Glass.aiff"
    if os.path.exists(sound_path):
        try:
            # Popen spawns the audio process in the background to avoid blocking calculations
            subprocess.Popen(["afplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except Exception:
            pass
    # Fallback beep
    sys.stdout.write("\a")
    sys.stdout.flush()


def send_email_alert(s):
    """
    Sends an email alert for a live swing signal to ALERT_EMAIL_RECIPIENT via local API route.
    """
    try:
        payload = {
            "recipient": ALERT_EMAIL_RECIPIENT,
            "subject": f"[BTC Alert] 5-Candle Swing {s['type']} detected at ${s['close']:.2f}",
            "message": f"Swing {s['type']} detected at {s['time']}\nPrice: ${s['close']:.2f}\nWick: {s['wick']:.2f} points"
        }
        requests.post("http://localhost:3000/api/alerts/email", json=payload, timeout=2)
    except Exception:
        pass


def send_telegram_alert(s):
    """
    Dispatches live signal notification to Telegram Chat ID via Bot API or local API proxy.
    """
    try:
        msg = f"🚨 <b>BTC SIGNAL ALERT: 5-Candle Swing {s['type']}</b> 🚨\n\n" \
              f"• <b>Price:</b> ${s['close']:,.2f}\n" \
              f"• <b>Time:</b> {s['time']}\n" \
              f"• <b>Wick Length:</b> {s['wick']:.2f} points\n\n" \
              f"<i>BTC Signal Scanner</i>"

        if TELEGRAM_BOT_TOKEN:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "HTML"}, timeout=3)
        else:
            # Proxy via local API route
            requests.post("http://localhost:3000/api/alerts/telegram", json={"chatId": TELEGRAM_CHAT_ID, "message": msg}, timeout=2)

        with _STATE_LOCK:
            _BOT_STATE["total_alerts_sent"] += 1
            _BOT_STATE["recent_alerts"].insert(0, {
                "type": s["type"],
                "time": s["time"],
                "price": s["close"],
                "wick": s["wick"],
            })
            _BOT_STATE["recent_alerts"] = _BOT_STATE["recent_alerts"][:15]
    except Exception:
        pass


# ==============================================================================
#  HTTP HEALTH CHECK & STATUS WEB SERVER (For Render & Uptime Pingers)
# ==============================================================================

class BotStatusHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/health", "/healthz"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            with _STATE_LOCK:
                self.wfile.write(json.dumps({"status": "ok", "state": _BOT_STATE}).encode("utf-8"))
            return

        with _STATE_LOCK:
            ltp_disp = f"${_BOT_STATE['last_ltp']:,.2f}" if _BOT_STATE["last_ltp"] else "Fetching..."
            scans_disp = _BOT_STATE["total_scans"]
            alerts_disp = _BOT_STATE["total_alerts_sent"]
            last_chk = _BOT_STATE["last_check_time"] or "Initializing..."
            alerts_html = ""
            for a in _BOT_STATE["recent_alerts"]:
                badge_color = "#10b981" if "Low" in a["type"] or "Bullish" in a["type"] else "#ef4444"
                alerts_html += f"""
                <tr style="border-bottom: 1px solid #334155;">
                    <td style="padding: 10px; color: {badge_color}; font-weight: bold;">{a['type']}</td>
                    <td style="padding: 10px;">${a['price']:,.2f}</td>
                    <td style="padding: 10px;">{a['wick']:.2f} pts</td>
                    <td style="padding: 10px; color: #94a3b8;">{a['time']}</td>
                    <td style="padding: 10px;">✅ Sent</td>
                </tr>
                """
            if not alerts_html:
                alerts_html = "<tr><td colspan='5' style='padding: 20px; text-align: center; color: #64748b;'>No live alerts triggered yet. Monitoring in progress...</td></tr>"

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>BTC Swing Alert Bot - Live Status</title>
    <meta http-equiv="refresh" content="30">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }}
        .container {{ max-width: 850px; margin: 0 auto; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }}
        .badge {{ background: #064e3b; color: #34d399; padding: 6px 14px; border-radius: 9999px; font-weight: bold; font-size: 14px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }}
        .card {{ background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; }}
        .card-label {{ font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }}
        .card-val {{ font-size: 22px; font-weight: bold; margin-top: 6px; color: #38bdf8; }}
        table {{ width: 100%; border-collapse: collapse; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }}
        th {{ background: #1e293b; padding: 12px 10px; text-align: left; font-size: 13px; color: #94a3b8; }}
        .footer {{ margin-top: 24px; text-align: center; font-size: 13px; color: #64748b; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 style="margin: 0; font-size: 24px;">🚀 BTC Swing Alert Bot</h1>
                <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 14px;">CoinDCX 24/7 Scanner & Telegram Dispatcher</p>
            </div>
            <div class="badge">● ACTIVE 24/7</div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-label">BTC/USDT Live LTP</div>
                <div class="card-val" style="color: #f59e0b;">{ltp_disp}</div>
            </div>
            <div class="card">
                <div class="card-label">Timeframe</div>
                <div class="card-val">{TIME_INTERVAL}</div>
            </div>
            <div class="card">
                <div class="card-label">Total Scans</div>
                <div class="card-val">{scans_disp}</div>
            </div>
            <div class="card">
                <div class="card-label">Alerts Sent</div>
                <div class="card-val" style="color: #10b981;">{alerts_disp}</div>
            </div>
        </div>

        <h3 style="margin-bottom: 12px; font-size: 16px;">📋 Recent Live Alerts</h3>
        <table>
            <thead>
                <tr>
                    <th>Signal Type</th>
                    <th>Price</th>
                    <th>Wick</th>
                    <th>Candle Time</th>
                    <th>Telegram</th>
                </tr>
            </thead>
            <tbody>
                {alerts_html}
            </tbody>
        </table>

        <div class="footer">
            Last checked: {last_chk} | Telegram Chat ID: <b>{TELEGRAM_CHAT_ID}</b>
        </div>
    </div>
</body>
</html>
"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def log_message(self, format, *args):
        return

def start_health_server():
    """Starts the HTTP server in a background daemon thread."""
    try:
        server = HTTPServer(("0.0.0.0", PORT), BotStatusHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        print(f"{G}🌐 Web Health Check & Status Server running on port {PORT}{X}")
    except Exception as e:
        print(f"{Y}⚠️ Could not bind web server to port {PORT}: {e}{X}")




# ==============================================================================
#  PATTERN MATCHING LOGIC
# ==============================================================================

def analyze_swings(candles):
    """
    Analyzes candle data (sorted newest-first, candles[0] being the current forming candle)
    to find 5-candle Swing Highs and Swing Lows.
    
    A 5-candle pattern consists of c1, c2 (left/older), c3 (middle/pivot candidate), c4, c5 (right/newer).
    In the newest-first array format:
      - c1 (left 2 / oldest) = candles[i + 2]
      - c2 (left 1 / older)  = candles[i + 1]
      - c3 (middle / candidate) = candles[i]
      - c4 (right 1 / newer) = candles[i - 1]
      - c5 (right 2 / newest)= candles[i - 2]
      
    Wick calculation rules:
      - Swing Low: bottom wick length = min(open, close) - low
      - Swing High: top wick length = high - max(open, close)
    """
    swings = []
    
    # We skip candles[0], candles[1] on the right and candles[-1], candles[-2] on the left
    for i in range(2, len(candles) - 2):
        c3 = candles[i]       # The candidate pivot candle being tested
        c2 = candles[i + 1]   # Left 1 (older)
        c1 = candles[i + 2]   # Left 2 (oldest)
        c4 = candles[i - 1]   # Right 1 (newer)
        c5 = candles[i - 2]   # Right 2 (newest)

        # Parse c3 prices
        o3, h3, l3, cl3 = float(c3["open"]), float(c3["high"]), float(c3["low"]), float(c3["close"])
        v3 = float(c3.get("volume", 0))

        # Parse surrounding lows/highs
        l1, h1 = float(c1["low"]), float(c1["high"])
        l2, h2 = float(c2["low"]), float(c2["high"])
        l4, h4 = float(c4["low"]), float(c4["high"])
        l5, h5 = float(c5["low"]), float(c5["high"])

        # 5-Candle Swing Low Condition: middle candle low is strictly lower than 2 left and 2 right neighbors
        is_swing_low = l3 < l1 and l3 < l2 and l3 < l4 and l3 < l5
        
        # 5-Candle Swing High Condition: middle candle high is strictly higher than 2 left and 2 right neighbors
        is_swing_high = h3 > h1 and h3 > h2 and h3 > h4 and h3 > h5

        dt = datetime.fromtimestamp(c3["time"] / 1000.0)
        time_str = dt.strftime("%Y-%m-%d %H:%M")

        if is_swing_low:
            # Bottom wick represents buying pressure rejecting lower prices
            wick_len = min(o3, cl3) - l3
            swings.append({
                "type": "Low",
                "time": time_str,
                "timestamp_ms": c3["time"],
                "ltp_at_c2": cl3,
                "volume": v3,
                "wick": wick_len,
                "high": h3,
                "low": l3,
                "open": o3,
                "close": cl3,
                "is_large_wick": wick_len > WICK_THRESHOLD,
                "index": i  # Retain index relative to array to determine confirmation status
            })
            
        elif is_swing_high:
            # Top wick represents selling pressure rejecting higher prices
            wick_len = h3 - max(o3, cl3)
            swings.append({
                "type": "High",
                "time": time_str,
                "timestamp_ms": c3["time"],
                "ltp_at_c2": cl3,
                "volume": v3,
                "wick": wick_len,
                "high": h3,
                "low": l3,
                "open": o3,
                "close": cl3,
                "is_large_wick": wick_len > WICK_THRESHOLD,
                "index": i  # Retain index relative to array to determine confirmation status
            })

    # Check 2x Wick Rejection on the latest COMPLETED candle (candles[1])
    if len(candles) >= 2:
        last_closed = candles[1]
        lc_o, lc_h, lc_l, lc_cl = float(last_closed["open"]), float(last_closed["high"]), float(last_closed["low"]), float(last_closed["close"])
        body = abs(lc_cl - lc_o)
        effective_body = max(body, lc_cl * 0.0001)
        upper_wick = lc_h - max(lc_o, lc_cl)
        lower_wick = min(lc_o, lc_cl) - lc_l

        dt_lc = datetime.fromtimestamp(last_closed["time"] / 1000.0)
        time_lc = dt_lc.strftime("%Y-%m-%d %H:%M")

        if lower_wick >= 2 * effective_body and lower_wick > 0:
            swings.append({
                "type": "Bullish Wick Rejection",
                "time": time_lc,
                "timestamp_ms": last_closed["time"],
                "ltp_at_c2": lc_cl,
                "volume": float(last_closed.get("volume", 0)),
                "wick": lower_wick,
                "high": lc_h,
                "low": lc_l,
                "open": lc_o,
                "close": lc_cl,
                "is_large_wick": lower_wick > WICK_THRESHOLD,
                "index": 3
            })
        elif upper_wick >= 2 * effective_body and upper_wick > 0:
            swings.append({
                "type": "Bearish Wick Rejection",
                "time": time_lc,
                "timestamp_ms": last_closed["time"],
                "ltp_at_c2": lc_cl,
                "volume": float(last_closed.get("volume", 0)),
                "wick": upper_wick,
                "high": lc_h,
                "low": lc_l,
                "open": lc_o,
                "close": lc_cl,
                "is_large_wick": upper_wick > WICK_THRESHOLD,
                "index": 3
            })

    return swings


def print_swing_table_header():
    """Prints the header for the historical swings table."""
    print(f"  {'Type':^6}  {'Time':^16}  {'Open':^10}  {'High':^10}  {'Low':^10}  {'Close':^10}  {'Volume':^9}  {'Wick':^9}  {'Alert':^9}")
    print(f"  {'─'*6}  {'─'*16}  {'─'*10}  {'─'*10}  {'─'*10}  {'─'*10}  {'─'*9}  {'─'*9}  {'─'*9}")

def print_swing_row(s):
    """Prints a single swing event as a row in the table."""
    type_color = G if s["type"] == "Low" else R
    wick_color = Y if s["is_large_wick"] else D
    alert_text = f"{BG_R}{B} 💥 LARGE {X}" if s["is_large_wick"] else ""
    
    print(f"  {type_color}{B}{s['type']:^6}{X}  "
          f"{s['time']:^16}  "
          f"{s['open']:>10.2f}  "
          f"{s['high']:>10.2f}  "
          f"{s['low']:>10.2f}  "
          f"{type_color}{s['close']:>10.2f}{X}  "
          f"{s['volume']:>9.4f}  "
          f"{wick_color}{s['wick']:>9.2f}{X}  "
          f"{alert_text}")

def print_swing_event(s, is_live=False, ltp_current=None):
    """
    Formats and prints a detailed summary of the swing event to the console.
    Highlights events where the wick length exceeds the user-configured threshold.
    Note: Used specifically for live alerts to stand out prominently.
    """
    type_color = G if s["type"] == "Low" else R
    wick_color = Y if s["is_large_wick"] else D
    highlight_tag = f" {BG_R} 💥 LARGE WICK (>{int(WICK_THRESHOLD)}) {X}" if s["is_large_wick"] else ""
    
    # Overwrite the carriage-returned status line if outputting a live event
    if is_live:
        sys.stdout.write("\r" + " " * 80 + "\r")
        sys.stdout.flush()
        live_tag = f"{M}{B}[LIVE ALERT]{X} "
        price_display = f"Current LTP: ${ltp_current:,.2f} | Candle Close LTP: ${s['ltp_at_c2']:,.2f}"
    else:
        live_tag = ""
        price_display = f"LTP at Close: ${s['ltp_at_c2']:,.2f}"
    
    print(f"{live_tag}{type_color}{B}Swing {s['type']}{X} detected:")
    print(f"  {B}Candle Time:{X} {s['time']}")
    print(f"  {B}Price:{X} {price_display}")
    print(f"  {B}Volume:{X} {s['volume']:.4f}")
    print(f"  {B}Candle OHLC:{X} O:{s['open']:.2f} | H:{s['high']:.2f} | L:{s['low']:.2f} | C:{s['close']:.2f}")
    print(f"  {B}Wick Length:{X} {wick_color}{s['wick']:.2f} points{X}{highlight_tag}")
    print(f"{D}─────────────────────────────────────────────────────────────────{X}")


# ==============================================================================
#  MAIN EXECUTION BLOCK
# ==============================================================================

def main():
    # Start web health-check & status server in daemon thread
    start_health_server()

    # Use hardcoded TIME_INTERVAL or env as default
    interval_name = TIME_INTERVAL
    
    # Override with command-line argument if provided
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower().strip()
        if arg in INTERVAL_MAPPING:
            interval_name = arg
        else:
            print(f"{R}⚠️ Warning: Unsupported interval '{arg}'. Defaulting to '{TIME_INTERVAL}'.{X}")
            print(f"Supported intervals: {', '.join(sorted(INTERVAL_MAPPING.keys()))}\n")
            
    # Fallback to "60m" if the hardcoded TIME_INTERVAL itself is invalid
    if interval_name not in INTERVAL_MAPPING:
        interval_name = "60m"
    
    with _STATE_LOCK:
        _BOT_STATE["interval"] = interval_name
    
    api_interval = INTERVAL_MAPPING[interval_name]

    # Print program header
    print(f"{C}{B}╔══════════════════════════════════════════════════════════╗{X}")
    print(f"{C}{B}║        🚀 BTC/USDT SWING LOW & HIGH SIGNAL FINDER        ║{X}")
    print(f"{C}{B}╚══════════════════════════════════════════════════════════╝{X}")
    print(f"  {B}Interval:{X} {Y}{interval_name}{X}  │  {B}Alerting Threshold:{X} {Y}Wick > {int(WICK_THRESHOLD)} points{X}\n")

    # --------------------------------------------------------------------------
    #  STEP 1: HISTORICAL ANALYSIS
    # --------------------------------------------------------------------------
    print(f"{C}{B}Analyzing last 100 historical candles...{X}")
    candles = fetch_candles(100, interval_name=interval_name)
    if not candles:
        print(f"{R}Could not retrieve historical data. Exiting.{X}")
        return

    # Process all historical candles
    historical_swings = analyze_swings(candles)
    
    # Reverse so events print chronologically (oldest first)
    historical_swings.reverse()
    
    large_wick_count = 0
    if historical_swings:
        print_swing_table_header()
        for s in historical_swings:
            print_swing_row(s)
            if s["is_large_wick"]:
                large_wick_count += 1
    else:
        print(f"  {Y}No historical swings found.{X}")
            
    print(f"\n{G}Historical Analysis Completed.{X}")
    print(f"Total Swings Found: {B}{len(historical_swings)}{X} (Large Wick >{int(WICK_THRESHOLD)}: {Y}{large_wick_count}{X})")
    
    # --------------------------------------------------------------------------
    #  STEP 2: LIVE MONITORING LOOP
    # --------------------------------------------------------------------------
    print(f"\n{C}{B}Starting Live Monitoring (polling every 30 seconds)...{X}")
    print(f"{D}Press Ctrl+C to exit.{X}\n")
    
    # Initialize our set of alerted candles with historical timestamps to prevent spamming duplicate alerts
    alerted_timestamps = {s["timestamp_ms"] for s in historical_swings}
    
    try:
        while True:
            # Fetch a small set of recent candles to inspect for the latest swings
            candles = fetch_candles(10, interval_name=interval_name)
            ltp_current = get_current_ltp()
            if ltp_current is None and candles:
                ltp_current = float(candles[0]["close"])

            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            with _STATE_LOCK:
                _BOT_STATE["last_check_time"] = now_str
                _BOT_STATE["total_scans"] += 1
                if ltp_current:
                    _BOT_STATE["last_ltp"] = ltp_current

            if candles:
                swings = analyze_swings(candles)
                
                # Check for confirmed swing signals on fully closed candles (index >= 3 for 5-candle patterns)
                for s in swings:
                    if s["index"] >= 3:
                        ts = s["timestamp_ms"]
                        if ts not in alerted_timestamps:
                            # Play macOS alert sound
                            play_alert_sound()
                            # Send email alert to recipient
                            send_email_alert(s)
                            # Send Telegram alert to Chat ID
                            send_telegram_alert(s)
                            # Print the live alert details
                            print_swing_event(s, is_live=True, ltp_current=ltp_current)
                            # Record the timestamp to prevent double triggers
                            alerted_timestamps.add(ts)
                
                # Render/Update the CLI liveness status indicator
                sys.stdout.write(f"\r🔍 Monitoring... Last checked: {time.strftime('%H:%M:%S')} | BTC LTP: ${ltp_current:,.2f}")
                sys.stdout.flush()
            
            # Poll every 30 seconds
            time.sleep(30)
            
    except KeyboardInterrupt:
        print(f"\n\n{Y}Live monitoring stopped.{X}\n")

if __name__ == "__main__":
    main()
