'use client';

import { useState, useEffect, use } from 'react';

interface Event {
  id: string;
  name: string;
  date: string;
}

type PageState = 'loading' | 'form' | 'success' | 'error';

export default function AttendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [event, setEvent] = useState<Event | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then(async (res) => {
        if (!res.ok) { setPageState('error'); return; }
        const data = await res.json();
        setEvent(data.event);
        setPageState('form');
      })
      .catch(() => setPageState('error'));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setFieldError('Please fill in both fields.');
      return;
    }
    setFieldError('');
    setSubmitting(true);
    const res = await fetch(`/api/events/${id}/attend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
    });
    if (res.ok) {
      setPageState('success');
    } else {
      const data = await res.json();
      setFieldError(data.error ?? 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  /* ── LOADING ── */
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  /* ── ERROR ── */
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Event Not Found</h1>
          <p className="text-blue-300 text-sm">This QR code may be invalid or the event no longer exists.</p>
        </div>
      </div>
    );
  }

  /* ── SUCCESS ── */
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="w-full max-w-sm text-center">
          {/* Animated checkmark */}
          <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re checked in!</h1>
          <p className="text-blue-300 mb-1">
            Welcome, <span className="font-semibold text-white">{firstName} {lastName}</span>
          </p>
          <p className="text-blue-400 text-sm">
            Registered for <span className="text-blue-200 font-medium">{event?.name}</span>
          </p>
          <div className="mt-8 inline-block bg-white/10 border border-white/10 rounded-xl px-5 py-3 text-blue-200 text-sm">
            See you at the event!
          </div>
        </div>
      </div>
    );
  }

  /* ── FORM ── */
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-sm space-y-4">

        {/* Event banner */}
        <div className="text-center mb-2">
          <p className="text-blue-400 text-xs uppercase tracking-widest font-semibold mb-2">Checking in to</p>
          <h1 className="text-2xl font-bold text-white leading-tight">{event?.name}</h1>
          <div className="inline-flex items-center gap-1.5 mt-2 bg-white/10 border border-white/10 rounded-full px-3 py-1">
            <svg className="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
            </svg>
            <span className="text-blue-200 text-xs">{event?.date}</span>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="p-6 space-y-4">
            <p className="text-slate-500 text-sm text-center">Enter your name to register attendance</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoFocus
                  autoComplete="given-name"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                  placeholder="e.g. John"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                  placeholder="e.g. Smith"
                />
              </div>

              {fieldError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-red-600 text-sm">{fieldError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-2 mt-1"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Checking in...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Check In
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </main>
  );
}
