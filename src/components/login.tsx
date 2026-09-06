'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui';
import { MonzaLogo } from './logo';
export function Login({ demo, configured }: { demo: boolean; configured: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <Link href="/login" className="brand">
          <MonzaLogo />
        </Link>
        <div className="login-editorial">
          <span className="eyebrow">THE DETAILS MAKE THE DIFFERENCE.</span>
          <h1>
            Exceptional wheels.
            <br />
            Extraordinary
            <br />
            <em>connections.</em>
          </h1>
          <p>
            Your customers. Your craft. Your workspace.
            <br />
            Built for the way Monza moves.
          </p>
          <div className="login-rings">
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>MZ</span>
          </div>
        </div>
        <footer>
          PRECISION FORGED. PERSONALLY MANAGED.<span>AUSTRALIA / EST. MONZA</span>
        </footer>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <div className="login-lock">
            <LockKeyhole size={22} />
          </div>
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>
            Back in the driver’s seat<span className="red-dot">.</span>
          </h2>
          <p>Sign in to your private Monza CRM.</p>
          {!configured && (
            <div className="setup-notice">
              <strong>Your workspace is ready for connection.</strong>
              <p>
                Add your Supabase credentials and apply the included migration to activate secure
                sign-in.
              </p>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const r = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password }),
                });
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                router.push('/');
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to sign in.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                placeholder="you@monzawheels.com.au"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!configured}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <div className="password-input">
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!configured}
                />
                <button
                  type="button"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <Button disabled={!configured || busy}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
          <div className="login-security">
            <ShieldCheck size={14} /> Invite-only access. Your customer data stays private.
          </div>
          {demo && (
            <div className="demo-entry">
              <span>Take a look around first.</span>
              <Link href="/demo">
                Explore the demo <ArrowUpRightIcon />
              </Link>
              <small>Fictional customers. No account required.</small>
            </div>
          )}
        </div>
        <footer>
          MONZA WHEELS <span>PRIVATE WORKSPACE</span>
        </footer>
      </section>
    </main>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
