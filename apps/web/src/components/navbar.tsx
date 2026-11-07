'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from './theme-toggle';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/practice', label: 'Practice' },
  { href: '/history', label: 'History' },
  { href: '/recordings', label: 'Recordings' },
  { href: '/rubrics', label: 'Rubrics' },
  { href: '/tutor', label: 'AI Coach' },
  { href: '/settings', label: 'Settings' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--background) / 0.8)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold">
            TOEFL<span className="text-brand-500"> AI</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  pathname?.startsWith(l.href)
                    ? 'bg-brand-600 text-white'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <button className="btn-ghost" onClick={logout}>
              Log out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
