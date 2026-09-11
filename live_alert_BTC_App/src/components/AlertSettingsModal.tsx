'use client';

import React, { useState } from 'react';
import { AlertConfig } from '@/lib/types/crypto';
import { X, Send, Mail, Volume2, ShieldCheck, Check, AlertTriangle } from 'lucide-react';

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AlertConfig;
  onSave: (newConfig: AlertConfig) => void;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [formData, setFormData] = useState<AlertConfig>(config);
  const [testStatus, setTestStatus] = useState<{ type: 'telegram' | 'email' | null; message: string; success?: boolean }>({
    type: null,
    message: '',
  });
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleTestTelegram = async () => {
    setTesting(true);
    setTestStatus({ type: 'telegram', message: 'Sending test message to Telegram...' });
    try {
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: formData.telegramBotToken,
          chatId: formData.telegramChatId,
          isTest: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus({ type: 'telegram', message: 'Telegram test alert sent successfully!', success: true });
      } else {
        setTestStatus({ type: 'telegram', message: `Telegram Error: ${data.error}`, success: false });
      }
    } catch (e: any) {
      setTestStatus({ type: 'telegram', message: `Failed: ${e.message}`, success: false });
    } finally {
      setTesting(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestStatus({ type: 'email', message: 'Sending test email...' });
    try {
      const res = await fetch('/api/alerts/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: formData.emailRecipient,
          subject: 'Raj-BTC Alert Terminal - Test Email',
          message: 'This is a test notification from your Raj-BTC Pattern App.',
          isTest: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus({ type: 'email', message: 'Email test alert dispatched successfully!', success: true });
      } else {
        setTestStatus({ type: 'email', message: `Email Error: ${data.error}`, success: false });
      }
    } catch (e: any) {
      setTestStatus({ type: 'email', message: `Failed: ${e.message}`, success: false });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181a20] border border-[#2a2e3d] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2e3d] bg-[#0f1117]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-100">Alert Dispatcher Setup</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Telegram Settings */}
          <div className="bg-[#0f1117] border border-[#2a2e3d] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-slate-100 text-sm">Telegram Bot Notifications</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.telegramEnabled}
                  onChange={(e) => setFormData({ ...formData, telegramEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2a2e3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-500"></div>
              </label>
            </div>

            {formData.telegramEnabled && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Telegram Bot Token</label>
                  <input
                    type="password"
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={formData.telegramBotToken}
                    onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                    className="w-full bg-[#181a20] border border-[#2a2e3d] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 8630465075"
                    value={formData.telegramChatId}
                    onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                    className="w-full bg-[#181a20] border border-[#2a2e3d] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testing}
                  className="text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-3 py-1.5 rounded-lg font-medium transition-all"
                >
                  Test Telegram Integration
                </button>
              </div>
            )}
          </div>

          {/* Email Settings */}
          <div className="bg-[#0f1117] border border-[#2a2e3d] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-300" />
                <h3 className="font-bold text-slate-100 text-sm">Email Alerts</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailEnabled}
                  onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2a2e3d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-500"></div>
              </label>
            </div>

            {formData.emailEnabled && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Recipient Email Address</label>
                  <input
                    type="email"
                    placeholder="dugu19raj@gmail.com"
                    value={formData.emailRecipient}
                    onChange={(e) => setFormData({ ...formData, emailRecipient: e.target.value })}
                    className="w-full bg-[#181a20] border border-[#2a2e3d] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testing}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-1.5 rounded-lg font-medium transition-all"
                >
                  Test Email Dispatch
                </button>
              </div>
            )}
          </div>

          {/* Trigger Rules */}
          <div className="bg-[#0f1117] border border-[#2a2e3d] rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-100 text-sm mb-2">Active Alert Rules</h3>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Wick Rejection (&gt;= 2x Candle Body on 30m)</span>
              <input
                type="checkbox"
                checked={formData.triggers.wickRejection}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    triggers: { ...formData.triggers, wickRejection: e.target.checked },
                  })
                }
                className="accent-slate-400"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Horizontal Channel Bounds & Breakouts (12 Hours)</span>
              <input
                type="checkbox"
                checked={formData.triggers.horizontalChannel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    triggers: { ...formData.triggers, horizontalChannel: e.target.checked },
                  })
                }
                className="accent-slate-400"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Swing Pivot High & Swing Low Detection</span>
              <input
                type="checkbox"
                checked={formData.triggers.swingPoints}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    triggers: { ...formData.triggers, swingPoints: e.target.checked },
                  })
                }
                className="accent-slate-400"
              />
            </label>
          </div>

          {/* Test Status Banner */}
          {testStatus.message && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {testStatus.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2a2e3d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-100 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-slate-200 hover:bg-white text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all shadow-md"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
