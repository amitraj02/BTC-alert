import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Raj-BTC Alert Terminal',
  description: 'Real-time Bitcoin OHLC candlestick pattern recognition engine, indicator analysis, and multi-channel Telegram & Email alerts.',
  keywords: ['Bitcoin', 'Trading', 'OHLC', 'Vercel', 'Next.js', 'Telegram Alert', 'Wick Rejection', 'Horizontal Channel'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0e14] text-slate-100 antialiased selection:bg-amber-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
