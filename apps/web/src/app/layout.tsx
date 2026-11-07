import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'TOEFL AI Prep',
  description: 'AI-powered TOEFL iBT preparation platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
