import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botToken, chatId, message, isTest } = body;

    const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chat = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chat) {
      return NextResponse.json(
        { success: false, error: 'Telegram Bot Token or Chat ID missing' },
        { status: 400 }
      );
    }

    const textPayload = isTest
      ? `🤖 <b>[BTC ALERT TEST]</b>\n\nYour Telegram Alert Bot is successfully connected!\n\n<i>Time:</i> ${new Date().toISOString()}`
      : message;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: textPayload,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      return NextResponse.json(
        { success: false, error: data.description || 'Telegram API request failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, result: data.result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
