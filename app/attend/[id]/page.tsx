'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';

const S = {
  bg: '#060606', surface: '#111111', surface2: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)',
  sea: '#00F6FF', cobalt: '#0047FF',
  snow: '#FBFAFA', muted: 'rgba(251,250,250,0.50)', muted2: 'rgba(251,250,250,0.30)',
};

interface Event { id: string; name: string; date: string; }
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
    fetch(`/api/events/${id}/public`)
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
    if (!firstName.trim() || !lastName.trim()) { setFieldError('Please fill in both fields.'); return; }
    setFieldError('');
    setSubmitting(true);
    const res = await fetch(`/api/events/${id}/attend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
    });
    if (res.ok) setPageState('success');
    else {
      const data = await res.json();
      setFieldError(data.error ?? 'Something went wrong.');
    }
    setSubmitting(false);
  };

  const inputStyle = { background: S.surface2, border: `1px solid ${S.border}`, color: S.snow };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = S.sea;
  const inputBlur  = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = S.border;

  /* ── LOADING ── */
  if (pageState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <div className="w-8 h-8 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
    </div>
  );

  /* ── ERROR ── */
  if (pageState === 'error') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: S.bg }}>
      <Image src="/epam-logo.svg" alt="EPAM" width={90} height={32} className="mb-10 opacity-60" />
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-sm flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)' }}>
          <svg className="w-7 h-7" style={{ color: '#FF6B6B' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-black mb-2" style={{ color: S.snow }}>Event Not Found</h1>
        <p className="text-sm" style={{ color: S.muted }}>This QR code may be invalid or the event no longer exists.</p>
      </div>
    </div>
  );

  /* ── SUCCESS ── */
  if (pageState === 'success') return (
    <div className="min-h-screen flex flex-col" style={{ background: S.bg }}>
      {/* Top bar */}
      <header className="flex items-center justify-center px-6 py-5">
        <Image src="/epam-logo.svg" alt="EPAM" width={90} height={32} />
      </header>

      {/* Divider */}
      <div className="h-px mx-6" style={{ background: `linear-gradient(90deg, transparent, ${S.sea}, transparent)` }} />

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        {/* Glow ring */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(0,246,255,0.1)', filter: 'blur(20px)' }} />
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,246,255,0.1)', border: `1px solid rgba(0,246,255,0.3)` }}>
            <svg className="w-8 h-8" style={{ color: S.sea }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.sea }}>Check-in Successful</p>
        <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color: S.snow }}>
          {firstName} {lastName}
        </h1>
        <p className="text-sm" style={{ color: S.muted }}>
          You&apos;re registered for <span className="font-semibold" style={{ color: S.snow }}>{event?.name}</span>
        </p>

        <div className="mt-8 px-5 py-3 rounded-sm text-sm" style={{ background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>
          {event?.date}
        </div>
      </div>

      <footer className="px-6 py-4 text-center">
        <p className="text-xs" style={{ color: S.muted2 }}>© {new Date().getFullYear()} EPAM Systems</p>
      </footer>
    </div>
  );

  /* ── FORM ── */
  return (
    <main className="min-h-screen flex flex-col" style={{ background: S.bg }}>
      {/* Header */}
      <header className="flex items-center justify-center px-6 py-5">
        <Image src="/epam-logo.svg" alt="EPAM" width={90} height={32} />
      </header>

      {/* Sea divider */}
      <div className="h-px mx-6" style={{ background: `linear-gradient(90deg, transparent, ${S.sea}, transparent)` }} />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-5">
          {/* Event info */}
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.sea }}>Checking in to</p>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>{event?.name}</h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs"
              style={{ background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
              </svg>
              {event?.date}
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />
            <div className="p-6 space-y-4">
              <p className="text-sm text-center" style={{ color: S.muted }}>Enter your name to register attendance</p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    required autoFocus autoComplete="given-name" placeholder="e.g. John"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all" style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    required autoComplete="family-name" placeholder="e.g. Smith"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all" style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>

                {fieldError && <p className="text-sm" style={{ color: '#FF6B6B' }}>{fieldError}</p>}

                <button type="submit" disabled={submitting}
                  className="w-full font-bold text-sm py-3.5 rounded-sm uppercase tracking-widest transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                  style={{ background: S.cobalt, color: S.snow }}>
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: S.snow }} />
                      Checking in...
                    </>
                  ) : 'Check In'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <footer className="px-6 py-4 text-center">
        <p className="text-xs" style={{ color: S.muted2 }}>© {new Date().getFullYear()} EPAM Systems</p>
      </footer>
    </main>
  );
}
