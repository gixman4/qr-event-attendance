'use client';

import { useState, useEffect, use, useRef } from 'react';
import Image from 'next/image';
import { startVisiblePolling } from '@/lib/visible-polling.mts';
import { sendCheckInWithRetry } from '@/lib/check-in-request.mts';

const S = {
  bg: '#060606', surface: '#111111', surface2: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)',
  sea: '#00F6FF', cobalt: '#0047FF',
  snow: '#FBFAFA', muted: 'rgba(251,250,250,0.50)', muted2: 'rgba(251,250,250,0.30)',
};

interface Event { name: string; date: string; start_time: string | null; location: string | null; check_in_open: number; }
type PageState = 'loading' | 'form' | 'success' | 'error';

export default function AttendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [event, setEvent] = useState<Event | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  useEffect(() => {
    fetch(`/api/events/${id}/public`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) { setPageState('error'); return; }
        const data = await res.json();
        setEvent(data.event);
        setPageState('form');
      })
      .catch(() => setPageState('error'));
  }, [id]);

  const hasEvent = event !== null;
  useEffect(() => {
    if (pageState !== 'form' || !hasEvent) return;
    return startVisiblePolling(async (signal) => {
      const res = await fetch(`/api/events/${id}/public`, { cache: 'no-store', signal });
      if (signal.aborted) return;
      if (res.status === 404) { setPageState('error'); return; }
      if (res.ok) {
        const data: { event: Event } = await res.json();
        if (!signal.aborted) {
          setEvent(data.event);
          if (data.event.check_in_open === 0) setDuplicateWarning(false);
        }
      }
    });
  }, [id, pageState, hasEvent]);

  const submit = async (confirmDuplicate = false) => {
    if (requestRef.current) return;
    if (!firstName.trim() || !lastName.trim()) { setFieldError('Please fill in both fields.'); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setFieldError('');
    setSubmitting(true);
    try {
      const res = await sendCheckInWithRetry(
        `/api/events/${id}/attend`,
        { first_name: firstName, last_name: lastName, confirm_duplicate: confirmDuplicate },
        { signal: controller.signal, onPreparing: () => setPreparing(true) },
      );
      if (controller.signal.aborted) return;
      if (res.ok) {
        setDuplicateWarning(false);
        setPageState('success');
      } else {
        const data = await res.json();
        if (res.status === 409 && data.code === 'DUPLICATE_NAME') {
          setDuplicateWarning(true);
        } else if (res.status === 403 && data.code === 'CHECK_IN_CLOSED') {
          setDuplicateWarning(false);
          setEvent((current) => current && { ...current, check_in_open: 0 });
        } else {
          setFieldError(data.error ?? 'Something went wrong. Please try again.');
        }
      }
    } catch {
      if (!controller.signal.aborted) setFieldError('Unable to connect. Please try again.');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (!controller.signal.aborted) {
          setSubmitting(false);
          setPreparing(false);
        }
      }
    }
  };

  const cancelPreparation = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setSubmitting(false);
    setPreparing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit();
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

  // Let a request already in flight decide whether it succeeded or was closed.
  if (pageState === 'form' && event?.check_in_open === 0 && !submitting) return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: S.bg }}>
      <Image src="/epam-logo.svg" alt="EPAM" width={90} height={32} className="mb-8" />
      <div className="w-full max-w-sm rounded-sm p-7" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.sea }}>EPAM Event</p>
        <h1 className="text-2xl font-black" style={{ color: S.snow }}>{event.name}</h1>
        <p className="text-sm mt-2" style={{ color: S.muted }}>{event.date}{event.start_time ? ` · ${event.start_time}` : ''}</p>
        {event.location && <p className="text-sm mt-1" style={{ color: S.muted }}>{event.location}</p>}
        <div className="h-px my-6" style={{ background: S.border }} />
        <h2 className="text-lg font-bold" style={{ color: S.snow }}>Check-in is closed</h2>
        <p className="text-sm mt-2" style={{ color: S.muted }}>This event is not accepting new check-ins right now.</p>
      </div>
    </main>
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
          {event?.date}{event?.start_time ? ` · ${event.start_time}` : ''}
          {event?.location && <span className="block mt-1">{event.location}</span>}
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
              {event?.date}{event?.start_time ? ` · ${event.start_time}` : ''}
            </div>
            {event?.location && <p className="text-sm" style={{ color: S.muted }}>{event.location}</p>}
          </div>

          {/* Form card */}
          <div className="rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />
            <div className="p-6 space-y-4">
              <p className="text-sm text-center" style={{ color: S.muted }}>Enter your name to register attendance</p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>First Name</label>
                  <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); setDuplicateWarning(false); setFieldError(''); }}
                    required maxLength={100} disabled={submitting} autoFocus autoComplete="given-name" placeholder="e.g. John"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all" style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); setDuplicateWarning(false); setFieldError(''); }}
                    required maxLength={100} disabled={submitting} autoComplete="family-name" placeholder="e.g. Smith"
                    className="w-full rounded-sm px-4 py-3 text-sm outline-none transition-all" style={inputStyle}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>

                {fieldError && <p className="text-sm" style={{ color: '#FF6B6B' }}>{fieldError}</p>}
                {preparing && <p role="status" className="text-sm" style={{ color: S.sea }}>Preparing check-in for this event. Please wait a moment…</p>}

                {duplicateWarning ? (
                  <div role="alert" className="space-y-3 rounded-sm p-4" style={{ background: 'rgba(184,150,255,0.10)', border: '1px solid rgba(184,150,255,0.35)' }}>
                    <p className="text-sm" style={{ color: S.snow }}>
                      Someone with this name has already checked in. If this is you, you are all set. If you are a different person with the same name, confirm below.
                    </p>
                    <button type="button" disabled={submitting} onClick={() => void submit(true)}
                      className="w-full py-2.5 text-sm font-bold rounded-sm disabled:opacity-50" style={{ background: S.cobalt, color: S.snow }}>
                      {submitting ? 'Checking in...' : 'Check in anyway'}
                    </button>
                    <button type="button" disabled={submitting} onClick={() => setDuplicateWarning(false)} className="w-full py-2 text-sm underline disabled:opacity-50" style={{ color: S.muted }}>
                      Edit name
                    </button>
                  </div>
                ) : (
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
                )}
                {preparing && (
                  <div className="text-center">
                    <button type="button" onClick={cancelPreparation} className="py-2 text-sm underline" style={{ color: S.muted }}>Stop waiting</button>
                    <p className="text-xs" style={{ color: S.muted2 }}>A request may still finish on the server. Please check with the organizer before submitting again.</p>
                  </div>
                )}
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
