'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@toefl.local');
  const [password, setPassword] = useState('DemoPass123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
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
          <h1 className="text-2xl font-bold">
            Welcome back to TOEFL<span className="text-brand-500"> AI</span>
          </h1>
          <p className="mt-1 text-sm muted">
            Sign in to continue your preparation.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                className="input mt-1"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                className="input mt-1"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-sm muted">
            No account?{' '}
            <Link href="/register" className="text-brand-500 hover:underline">
              Create one
            </Link>
            {' · '}
            <Link href="/forgot-password" className="text-brand-500 hover:underline">
              Forgot password?
            </Link>
          </p>
          <p className="mt-2 text-xs muted">
            Demo seed account: demo@toefl.local / DemoPass123!
          </p>
        </Card>
      </div>
    </div>
  );
}
