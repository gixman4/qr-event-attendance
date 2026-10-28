'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const S = {
  bg:      '#060606',
  surface: '#111111',
  surface2:'#1a1a1a',
  border:  'rgba(255,255,255,0.08)',
  sea:     '#00F6FF',
  cobalt:  '#0047FF',
  snow:    '#FBFAFA',
  muted:   'rgba(251,250,250,0.50)',
  muted2:  'rgba(251,250,250,0.30)',
};

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername]           = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      router.push('/admin');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Registration failed.');
      setLoading(false);
    }
  };

  const inputStyle = {
    background: S.surface2,
    border: `1px solid ${S.border}`,
    color: S.snow,
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: S.bg }}>
      <header className="flex items-center px-8 py-6">
        <Image src="/epam-logo.svg" alt="EPAM" width={90} height={32} priority />
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            {/* Accent bar */}
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />

            <div className="p-8">
              <h1 className="text-xl font-bold mb-1" style={{ color: S.snow }}>Create an account</h1>
              <p className="text-sm mb-7" style={{ color: S.muted }}>Register to manage your events.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="3–30 chars, letters/numbers/_"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                    onBlur={(e)  => e.currentTarget.style.borderColor = S.border}
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                    onBlur={(e)  => e.currentTarget.style.borderColor = S.border}
                  />
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                    onBlur={(e)  => e.currentTarget.style.borderColor = S.border}
                  />
                </div>

                {error && (
                  <p className="text-sm" style={{ color: '#FF6B6B' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-bold text-sm py-3 rounded-sm uppercase tracking-widest transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: S.cobalt, color: S.snow }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: S.snow }} />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center mt-5 text-xs" style={{ color: S.muted2 }}>
            Already have an account?{' '}
            <Link href="/admin" className="hover:underline" style={{ color: S.muted }}>
              Sign in
            </Link>
          </p>
          <p className="text-center mt-3 text-xs">
            <Link href="/" className="hover:underline" style={{ color: S.muted2 }}>← Back to home</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
