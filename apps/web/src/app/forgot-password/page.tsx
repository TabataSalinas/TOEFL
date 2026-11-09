'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { api } from '@/lib/api';

/**
 * Password recovery for a personal deployment: there is no e-mail provider, so the API
 * returns the one-time reset token (valid 1 h) and it is used directly on this page.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ resetToken?: string }>('/auth/forgot-password', { email });
      if (res.resetToken) {
        setToken(res.resetToken);
        setMsg('Reset code generated (valid for 1 hour). Choose a new password.');
      } else {
        setMsg('If the account exists, a reset code was generated. Paste it below.');
      }
      setStep('reset');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token: token.trim(), password });
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-bold">Reset your password</h1>

          {step === 'request' && (
            <form onSubmit={request} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <input id="email" className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Requesting…' : 'Get reset code'}</button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={reset} className="mt-6 space-y-4">
              {msg && <p className="text-sm muted">{msg}</p>}
              <div>
                <label htmlFor="token" className="text-sm font-medium">Reset code</label>
                <input id="token" className="input mt-1 font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium">New password</label>
                <input id="password" className="input mt-1" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <p className="mt-1 text-xs muted">At least 8 characters. All active sessions will be signed out.</p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
            </form>
          )}

          {step === 'done' && (
            <p className="mt-6 text-sm">
              Password updated.{' '}
              <Link href="/login" className="text-brand-500 hover:underline">Sign in</Link>
            </p>
          )}

          <p className="mt-4 text-sm muted">
            <Link href="/login" className="text-brand-500 hover:underline">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
