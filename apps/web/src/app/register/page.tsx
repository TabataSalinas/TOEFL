'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(email, password, name || undefined);
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm muted">Start preparing for the TOEFL iBT.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="mt-1 text-xs muted">At least 8 characters.</p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <p className="mt-4 text-sm muted">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-500 hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
