'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { startVisiblePolling } from '@/lib/visible-polling.mts';

interface Event {
  id: string;
  name: string;
  date: string;
  creator_name: string | null;
  created_at: string;
  attendee_count: number;
}

const S = {
  bg:         '#060606',
  surface:    '#111111',
  surface2:   '#1a1a1a',
  border:     'rgba(255,255,255,0.08)',
  borderHov:  'rgba(255,255,255,0.16)',
  sea:        '#00F6FF',
  cobalt:     '#0047FF',
  lilac:      '#B896FF',
  snow:       '#FBFAFA',
  muted:      'rgba(251,250,250,0.50)',
  muted2:     'rgba(251,250,250,0.30)',
};

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then(async (res) => {
        if (res.ok) {
          setAuthenticated(true);
          const eventsResponse = await fetch('/api/events', { cache: 'no-store' });
          if (eventsResponse.ok) setEvents(await eventsResponse.json());
        }
      })
      .catch(() => { /* Retry the event list when polling starts. */ })
      .finally(() => setChecking(false));
  }, []);

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/events', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthenticated(false);
        setEvents([]);
      } else if (res.ok) {
        setEvents(await res.json());
      }
    } catch {
      // Keep the existing events; polling will retry while the tab is visible.
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated || checking || eventsLoading) return;
    return startVisiblePolling(async (signal) => {
      const res = await fetch('/api/events', { cache: 'no-store', signal });
      if (signal.aborted) return;
      if (res.status === 401) {
        setAuthenticated(false);
        setEvents([]);
      } else if (res.ok) {
        const data: Event[] = await res.json();
        if (!signal.aborted) setEvents(data);
      }
    });
  }, [authenticated, checking, eventsLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) { setAuthenticated(true); loadEvents(); }
    else {
      const data = await res.json();
      setLoginError(data.error ?? 'Invalid password.');
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setEvents([]);
    setPassword('');
  };

  if (checking) return <Spinner />;

  /* ── LOGIN ── */
  if (!authenticated) {
    return (
      <main className="min-h-screen flex flex-col" style={{ background: S.bg }}>
        <header className="flex items-center px-8 py-6">
          <Image src="/epam-logo.svg" alt="EPAM" width={90} height={32} priority />
        </header>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            {/* Card */}
            <div className="rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
              {/* Sea top bar */}
              <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />
              <div className="p-8">
                <h1 className="text-xl font-bold mb-1" style={{ color: S.snow }}>Admin Access</h1>
                <p className="text-sm mb-7" style={{ color: S.muted }}>Enter your team password to continue</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      placeholder="••••••••"
                      className="w-full rounded-sm px-4 py-3 text-sm transition-all outline-none"
                      style={{
                        background: S.surface2,
                        border: `1px solid ${S.border}`,
                        color: S.snow,
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                      onBlur={(e) => e.currentTarget.style.borderColor = S.border}
                    />
                  </div>

                  {loginError && (
                    <p className="text-sm" style={{ color: '#FF6B6B' }}>{loginError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full font-bold text-sm py-3 rounded-sm uppercase tracking-widest transition-opacity disabled:opacity-50"
                    style={{ background: S.cobalt, color: S.snow }}
                  >
                    {loginLoading ? 'Verifying...' : 'Sign In'}
                  </button>
                </form>
              </div>
            </div>
            <p className="text-center mt-5 text-xs" style={{ color: S.muted2 }}>
              <Link href="/" className="hover:underline" style={{ color: S.muted }}>← Back to home</Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ── DASHBOARD ── */
  return (
    <main className="min-h-screen flex flex-col" style={{ background: S.bg }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 h-14"
        style={{ background: S.surface, borderBottom: `1px solid ${S.border}` }}
      >
        <Image src="/epam-logo.svg" alt="EPAM" width={80} height={28} priority />
        <div className="flex items-center gap-3">
          <Link
            href="/admin/create"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm transition-opacity hover:opacity-80"
            style={{ background: S.cobalt, color: S.snow }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Event
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-2 rounded-sm transition-colors"
            style={{ color: S.muted, border: `1px solid ${S.border}` }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 py-8">
        {/* Page title */}
        <div className="mb-7">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>Events</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>{events.length} total</p>
          <p className="text-xs mt-1" style={{ color: S.sea }}>● Live · updates every 5 seconds</p>
        </div>

        {eventsLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
          </div>
        ) : events.length === 0 ? (
          <div
            className="rounded-sm text-center py-20 px-6"
            style={{ background: S.surface, border: `1px solid ${S.border}` }}
          >
            <p className="font-semibold mb-1" style={{ color: S.snow }}>No events yet</p>
            <p className="text-sm mb-6" style={{ color: S.muted }}>Create your first event to get a QR code.</p>
            <Link
              href="/admin/create"
              className="inline-block text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-sm"
              style={{ background: S.cobalt, color: S.snow }}
            >
              Create Event
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}`}
                className="group flex items-center justify-between px-5 py-4 rounded-sm transition-all"
                style={{ background: S.surface, border: `1px solid ${S.border}` }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = S.borderHov;
                  (e.currentTarget as HTMLElement).style.background = S.surface2;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = S.border;
                  (e.currentTarget as HTMLElement).style.background = S.surface;
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Date block */}
                  <div
                    className="w-11 h-11 rounded-sm flex flex-col items-center justify-center flex-shrink-0"
                    style={{ background: S.cobalt }}
                  >
                    <span className="text-[9px] font-black uppercase tracking-wider leading-none" style={{ color: 'rgba(251,250,250,0.7)' }}>
                      {new Date(event.date + 'T00:00:00').toLocaleString('en', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-lg font-black leading-tight" style={{ color: S.snow }}>
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: S.snow }}>{event.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: S.muted }}>{event.date}</p>
                    {event.creator_name && (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>Created by {event.creator_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xl font-black" aria-live="polite" style={{ color: S.sea }}>{event.attendee_count}</span>
                    <p className="text-xs leading-none mt-0.5" style={{ color: S.muted }}>
                      {event.attendee_count === 1 ? 'attendee' : 'attendees'}
                    </p>
                  </div>
                  <svg className="w-4 h-4" style={{ color: S.muted2 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
