'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [target, setTarget] = useState(100);
  const [minutes, setMinutes] = useState(45);
  const [nativeLang, setNativeLang] = useState('');
  const [testDate, setTestDate] = useState('');
  const [weekly, setWeekly] = useState(300);
  const [monthly, setMonthly] = useState(1200);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setTarget(user.profile?.targetTotalScore ?? 100);
      setMinutes(user.profile?.preferredStudyMinutesPerDay ?? 45);
      setNativeLang(user.profile?.nativeLanguage ?? '');
      setTestDate(user.profile?.testDate?.slice(0, 10) ?? '');
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    await api.patch('/users/me/profile', {
      name,
      targetTotalScore: target,
      preferredStudyMinutesPerDay: minutes,
      nativeLanguage: nativeLang || undefined,
      testDate: testDate ? new Date(testDate).toISOString() : undefined,
    });
    await refreshUser();
    setMsg('Profile saved.');
  };

  const saveGoals = async () => {
    await api.post('/users/me/goals', { period: 'WEEKLY', targetMinutes: weekly });
    await api.post('/users/me/goals', { period: 'MONTHLY', targetMinutes: monthly });
    setMsg('Goals saved.');
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="muted">Manage your profile, goals and study preferences.</p>

      {msg && <p className="mt-3 text-sm text-green-500">{msg}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Profile & goal score</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">
                Target total score (0–120)
              </label>
              <input
                className="input mt-1"
                type="number"
                min={0}
                max={120}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Study minutes / day</label>
              <input
                className="input mt-1"
                type="number"
                min={5}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Native language</label>
              <input
                className="input mt-1"
                value={nativeLang}
                onChange={(e) => setNativeLang(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Planned test date</label>
              <input
                className="input mt-1"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
            <button className="btn-primary">Save profile</button>
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold">Study goals</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Weekly target (minutes)</label>
              <input
                className="input mt-1"
                type="number"
                min={0}
                value={weekly}
                onChange={(e) => setWeekly(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Monthly target (minutes)</label>
              <input
                className="input mt-1"
                type="number"
                min={0}
                value={monthly}
                onChange={(e) => setMonthly(Number(e.target.value))}
              />
            </div>
            <button className="btn-primary" onClick={saveGoals}>
              Save goals
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
