'use client';
import { MonzaLogo } from '@/components/logo';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="error-page">
      <MonzaLogo />
      <h1>Let’s get you moving again.</h1>
      <p>The workspace could not load. Check your connection and Supabase setup, then try again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <Link href="/login">Return to sign in</Link>
    </main>
  );
}
