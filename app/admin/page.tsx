'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Event {
  id: string;
  name: string;
  date: string;
  created_at: string;
  attendee_count: number;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6fb]">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          loadEvents();
        }
      })
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvents = async () => {
    setEventsLoading(true);
    const res = await fetch('/api/events');
    if (res.ok) setEvents(await res.json());
    setEventsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      loadEvents();
    } else {
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
      <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="px-8 py-8">
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-slate-900">Admin Access</h1>
                <p className="text-slate-500 text-sm mt-1">Enter your team password</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-red-600 text-sm">{loginError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-sm"
                >
                  {loginLoading ? 'Verifying...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
          <p className="text-center text-xs text-blue-300 mt-5">
            <Link href="/" className="hover:text-white transition-colors">Back to home</Link>
          </p>
        </div>
      </main>
    );
  }

  /* ── DASHBOARD ── */
  return (
    <main className="min-h-screen bg-[#f4f6fb]">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm">QR Attendance</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Events</h1>
            <p className="text-slate-500 text-sm mt-0.5">{events.length} total</p>
          </div>
          <Link
            href="/admin/create"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Event
          </Link>
        </div>

        {/* Events */}
        {eventsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-20 px-6">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold mb-1">No events yet</p>
            <p className="text-slate-400 text-sm mb-6">Create your first event to get a QR code.</p>
            <Link
              href="/admin/create"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Event
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}`}
                className="group flex items-center justify-between bg-white hover:bg-blue-50/50 border border-slate-100 hover:border-blue-200 rounded-2xl px-5 py-4 transition-all shadow-sm hover:shadow"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Date block */}
                  <div className="w-11 h-11 bg-blue-600 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold leading-none">
                      {new Date(event.date + 'T00:00:00').toLocaleString('en', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-white text-lg font-bold leading-tight">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      {event.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{event.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-800">{event.attendee_count}</span>
                    <p className="text-xs text-slate-400 leading-none">{event.attendee_count === 1 ? 'attendee' : 'attendees'}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
