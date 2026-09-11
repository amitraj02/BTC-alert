import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipient, subject, message, isTest } = body;

    const emailTo = recipient || process.env.ALERT_EMAIL_RECIPIENT || 'dugu19raj@gmail.com';

    const resendApiKey = process.env.RESEND_API_KEY;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const emailSubject = subject || (isTest ? '🚀 [BTC ALERT TEST] Pattern Engine Demo Email' : '🚨 [BTC SIGNAL ALERT] Market Pattern Detected');
    const emailBody = message || (isTest ? 'Hello! This is a test email confirmation from your Bitcoin Pattern Radar Trading Application.' : 'Market pattern detected.');

    // 1. Resend API Integration
    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'BTC Alert Radar <onboarding@resend.dev>',
          to: [emailTo],
          subject: emailSubject,
          text: emailBody,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(`Resend Error: ${resData.message || res.statusText}`);
      }

      return NextResponse.json({
        success: true,
        message: `Email alert sent to ${emailTo} via Resend API`,
        timestamp: new Date().toISOString(),
        deliveryMethod: 'Resend API',
      });
    }

    // 2. Nodemailer SMTP Integration
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"BTC Alert Radar" <${smtpUser}>`,
        to: emailTo,
        subject: emailSubject,
        text: emailBody,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0b0e14; color: #f8fafc; padding: 24px; border-radius: 12px;">
            <h2 style="color: #f7931a; margin-top: 0;">🚀 BTC Trading Bot Signal Alert</h2>
            <div style="background-color: #121722; border: 1px solid #1e2638; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="font-size: 16px; font-weight: bold; margin: 0 0 8px 0; color: #ffffff;">${emailSubject}</p>
              <p style="font-size: 14px; color: #cbd5e1; white-space: pre-wrap; margin: 0;">${emailBody}</p>
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 0;">Dispatched to ${emailTo} at ${new Date().toUTCString()}</p>
          </div>
        `,
      });

      return NextResponse.json({
        success: true,
        message: `Email alert successfully sent via SMTP to ${emailTo}`,
        timestamp: new Date().toISOString(),
        deliveryMethod: 'SMTP',
      });
    }

    // 3. Fallback Log
    console.log(`[ALERT EMAIL SIMULATED] To: ${emailTo} | Subject: ${emailSubject}`);
    return NextResponse.json({
      success: true,
      message: `Demo payload generated for ${emailTo}. Add SMTP_USER & SMTP_PASS or RESEND_API_KEY to .env.local to send live emails to your inbox.`,
      timestamp: new Date().toISOString(),
      deliveryMethod: 'Simulated',
    });
  } catch (err: any) {
    console.error('Email API Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Email dispatch failed' },
      { status: 500 }
    );
  }
}
