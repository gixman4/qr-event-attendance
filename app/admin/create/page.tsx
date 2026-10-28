'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const S = {
  bg: '#060606', surface: '#111111', surface2: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)', sea: '#00F6FF',
  cobalt: '#0047FF', snow: '#FBFAFA',
  muted: 'rgba(251,250,250,0.50)', muted2: 'rgba(251,250,250,0.30)',
};

export default function CreateEventPage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState('');
  const [name, setName] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_name: creatorName, name, date, start_time: startTime, location }),
    });
    if (res.ok) {
      const event = await res.json();
      router.push(`/admin/events/${event.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to create event.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: S.bg }}>
      {/* Nav */}
      <header
        className="flex items-center justify-between px-6 h-14"
        style={{ background: S.surface, borderBottom: `1px solid ${S.border}` }}
      >
        <Image src="/epam-logo.svg" alt="EPAM" width={80} height={28} priority />
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: S.muted }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to events
        </Link>
      </header>

      <div className="max-w-md mx-auto w-full px-4 py-10">
        <div className="mb-7">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>Create New Event</h1>
          <p className="text-sm mt-1" style={{ color: S.muted }}>A QR code will be generated instantly.</p>
        </div>

        <div className="rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Event creator */}
            <div className="space-y-1.5">
              <label htmlFor="creator-name" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                Created by
              </label>
              <input
                id="creator-name"
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                required
                maxLength={100}
                autoFocus
                autoComplete="name"
                placeholder="Your first and last name"
                className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.snow }}
                onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                onBlur={(e) => e.currentTarget.style.borderColor = S.border}
              />
            </div>

            {/* Event name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                Event Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Q3 All Hands"
                className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.snow }}
                onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                onBlur={(e) => e.currentTarget.style.borderColor = S.border}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: S.surface2,
                  border: `1px solid ${S.border}`,
                  color: S.snow,
                  colorScheme: 'dark',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                onBlur={(e) => e.currentTarget.style.borderColor = S.border}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-time" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                Time <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="event-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.snow, colorScheme: 'dark' }}
                onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                onBlur={(e) => e.currentTarget.style.borderColor = S.border}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-location" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                Location <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="event-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="e.g. Main conference room"
                className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all"
                style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.snow }}
                onFocus={(e) => e.currentTarget.style.borderColor = S.sea}
                onBlur={(e) => e.currentTarget.style.borderColor = S.border}
              />
            </div>

            {error && <p className="text-sm" style={{ color: '#FF6B6B' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold text-sm py-3 rounded-sm uppercase tracking-widest transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: S.cobalt, color: S.snow }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: S.snow }} />
                  Creating...
                </>
              ) : (
                'Create Event & Generate QR'
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
