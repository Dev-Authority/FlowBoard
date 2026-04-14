'use client';
import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get('from') || '/';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push(from);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width:      '100%',
    background: 'var(--color-raised)',
    color:      'var(--color-ink)',
    border:     '1px solid var(--color-line)',
    borderRadius: '0.625rem',
    padding:    '0.625rem 0.875rem',
    fontSize:   '0.875rem',
    outline:    'none',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-canvas)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background:  'var(--color-surface)',
          border:      '1px solid var(--color-line)',
          boxShadow:   '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header stripe */}
        <div className="px-6 pt-6 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
             style={{ color: 'var(--color-accent)' }}>
            FlowBoard
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>
            Sign in
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Enter your credentials to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
               style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-xs" style={{ color: 'var(--color-muted)' }}>
            No account?{' '}
            <Link href="/signup" className="font-medium" style={{ color: 'var(--color-accent)' }}>
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
