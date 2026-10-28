'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { startVisiblePolling } from '@/lib/visible-polling.mts';

const S = {
  bg: '#060606', surface: '#111111', surface2: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)', borderHov: 'rgba(255,255,255,0.16)',
  sea: '#00F6FF', cobalt: '#0047FF', lilac: '#B896FF', sky: '#7BA8FF',
  snow: '#FBFAFA', muted: 'rgba(251,250,250,0.50)', muted2: 'rgba(251,250,250,0.25)',
};

interface Event { id: string; name: string; date: string; creator_name: string | null; created_at: string; }
interface Attendee { id: string; first_name: string; last_name: string; registered_at: string; }

function getInitials(f: string, l: string) { return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase(); }
const AVATAR_COLORS = [
  { bg: 'rgba(0,246,255,0.15)', color: '#00F6FF' },
  { bg: 'rgba(0,71,255,0.2)',   color: '#7BA8FF' },
  { bg: 'rgba(184,150,255,0.15)', color: '#B896FF' },
  { bg: 'rgba(0,255,240,0.12)', color: '#00FFF0' },
  { bg: 'rgba(123,168,255,0.15)', color: '#7BA8FF' },
];
function avatarStyle(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }

function Modal({ title, accent, onClose, children }: { title: string; accent: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, ${S.cobalt})` }} />
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold" style={{ color: S.snow }}>{title}</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-sm transition-colors" style={{ color: S.muted, border: `1px solid ${S.border}` }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addFirst, setAddFirst] = useState('');
  const [addLast, setAddLast] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const attendeeRevision = useRef(0);

  const attendUrl = typeof window !== 'undefined' ? `${window.location.origin}/attend/${id}` : `/attend/${id}`;

  const loadData = async () => {
    try {
      const res = await fetch(`/api/events/${id}`, { cache: 'no-store' });
      if (res.status === 401) { router.replace('/admin'); return; }
      if (!res.ok) return;
      const data = await res.json();
      attendeeRevision.current++;
      setEvent(data.event);
      setAttendees(data.attendees);
    } catch {
      // Leave the currently displayed attendees intact on network errors.
    }
  };

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then(async (res) => {
        if (res.status === 401) { router.replace('/admin'); return; }
        if (!res.ok) { setError('Event not found.'); return; }
        const data = await res.json();
        setEvent(data.event);
        setAttendees(data.attendees);
      })
      .catch(() => setError('Unable to load event.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const hasEvent = event !== null;
  useEffect(() => {
    if (loading || error || !hasEvent) return;
    return startVisiblePolling(async (signal) => {
      const revision = attendeeRevision.current;
      const res = await fetch(`/api/events/${id}`, { cache: 'no-store', signal });
      if (signal.aborted) return;
      if (res.status === 401) {
        router.replace('/admin');
      } else if (res.ok) {
        const data: { attendees: Attendee[] } = await res.json();
        if (!signal.aborted && revision === attendeeRevision.current) {
          setAttendees(data.attendees);
        }
      }
    });
  }, [id, loading, error, hasEvent, router]);

  useEffect(() => {
    if (!event) return;
    import('qrcode').then((QRCode) => {
      const url = typeof window !== 'undefined' ? `${window.location.origin}/attend/${id}` : `/attend/${id}`;
      QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#060606', light: '#FBFAFA' } }).then(setQrDataUrl);
    });
  }, [event, id]);

  const copyLink = async () => { await navigator.clipboard.writeText(attendUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setEditLoading(true); setEditError('');
    const res = await fetch(`/api/events/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName, date: editDate }) });
    if (res.ok) { setEvent(await res.json()); setShowEdit(false); }
    else { const d = await res.json(); setEditError(d.error ?? 'Failed to update.'); }
    setEditLoading(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin');
    else setDeleteLoading(false);
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault(); setAddLoading(true); setAddError('');
    const res = await fetch(`/api/events/${id}/attendees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: addFirst, last_name: addLast }) });
    if (res.ok) {
      const attendee: Attendee = await res.json();
      attendeeRevision.current++;
      setAttendees((p) => [...p, attendee]);
      setAddFirst(''); setAddLast(''); setShowAddPerson(false);
    }
    else { const d = await res.json(); setAddError(d.error ?? 'Failed to add.'); }
    setAddLoading(false);
  };

  const handleRemoveAttendee = async (aid: string) => {
    const res = await fetch(`/api/events/${id}/attendees/${aid}`, { method: 'DELETE' });
    if (res.ok) {
      attendeeRevision.current++;
      setAttendees((p) => p.filter((a) => a.id !== aid));
    }
  };

  const inputStyle = { background: S.surface2, border: `1px solid ${S.border}`, color: S.snow };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = S.sea;
  const inputBlur  = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = S.border;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
    </div>
  );

  if (error || !event) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <div className="text-center">
        <p className="mb-4" style={{ color: S.muted }}>{error || 'Event not found.'}</p>
        <Link href="/admin" className="text-sm underline" style={{ color: S.sea }}>Back to events</Link>
      </div>
    </div>
  );

  return (
    <>
      <main className="min-h-screen flex flex-col" style={{ background: S.bg }}>
        {/* Nav */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 h-14" style={{ background: S.surface, borderBottom: `1px solid ${S.border}` }}>
          <div className="flex items-center gap-4">
            <Image src="/epam-logo.svg" alt="EPAM" width={80} height={28} priority />
            <div className="w-px h-5" style={{ background: S.border }} />
            <Link href="/admin" className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: S.muted }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              All events
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/events/${id}/export`}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-sm transition-opacity hover:opacity-80"
              style={{ background: S.cobalt, color: S.snow }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
              Export
            </a>
            <button onClick={() => { setEditName(event.name); setEditDate(event.date); setEditError(''); setShowEdit(true); }}
              aria-label="Edit event"
              className="w-8 h-8 flex items-center justify-center rounded-sm transition-colors" style={{ border: `1px solid ${S.border}`, color: S.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = S.sea; e.currentTarget.style.color = S.sea; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted; }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
            </button>
            <button onClick={() => setShowDelete(true)}
              aria-label="Delete event"
              className="w-8 h-8 flex items-center justify-center rounded-sm transition-colors" style={{ border: `1px solid ${S.border}`, color: S.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF6B6B'; e.currentTarget.style.color = '#FF6B6B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted; }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" /></svg>
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>{event.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: S.muted }}>{event.date}</p>
            {event.creator_name && (
              <p className="text-sm mt-1" style={{ color: S.muted }}>Created by {event.creator_name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* QR Card */}
            <div className="rounded-sm overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
              <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />
              <div className="p-6 flex flex-col items-center text-center gap-5">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Scan to Check In</p>

                {/* QR frame */}
                <div className="p-3 rounded-sm" style={{ background: S.snow }}>
                  {qrDataUrl ? (
                    <Image src={qrDataUrl} alt="QR Code" width={220} height={220} className="rounded-sm block" />
                  ) : (
                    <div className="w-[220px] h-[220px] flex items-center justify-center" style={{ background: '#f0f0f0' }}>
                      <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid #ddd', borderTopColor: '#060606' }} />
                    </div>
                  )}
                </div>

                <div className="w-full space-y-2">
                  <div className="rounded-sm px-3 py-2 text-xs font-mono break-all" style={{ background: S.surface2, color: S.muted }}>
                    {attendUrl}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={copyLink}
                      className="flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 rounded-sm transition-colors"
                      style={{ border: `1px solid ${S.border}`, color: copied ? S.sea : S.muted }}>
                      {copied ? (
                        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy Link</>
                      )}
                    </button>
                    {qrDataUrl && (
                      <a href={qrDataUrl} download={`${event.name.replace(/[^a-z0-9]/gi, '_')}_qr.png`}
                        className="flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 rounded-sm transition-colors"
                        style={{ border: `1px solid rgba(0,246,255,0.3)`, color: S.sea, background: 'rgba(0,246,255,0.05)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                        Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attendees Card */}
            <div className="rounded-sm overflow-hidden flex flex-col" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
              <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.lilac}, ${S.cobalt})` }} />
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Attendees</p>
                    <p className="text-3xl font-black mt-0.5" aria-live="polite" style={{ color: S.sea }}>{attendees.length}</p>
                    <p className="text-xs mt-1" style={{ color: S.sea }}>● Live · updates every 5 seconds</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setAddFirst(''); setAddLast(''); setAddError(''); setShowAddPerson(true); }}
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm"
                      style={{ background: S.cobalt, color: S.snow }}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      Add
                    </button>
                    <button onClick={loadData}
                      aria-label="Refresh attendees"
                      className="w-8 h-8 flex items-center justify-center rounded-sm transition-colors"
                      style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
                </div>

                {attendees.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
                    <p className="text-sm text-center" style={{ color: S.muted }}>No check-ins yet.<br />Share the QR code!</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-72 space-y-0.5">
                    {attendees.map((a, i) => {
                      const av = avatarStyle(i);
                      return (
                        <div key={a.id} className="group flex items-center gap-3 px-2 py-2 rounded-sm transition-colors"
                          style={{ background: 'transparent' }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = S.surface2}
                          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                          <div className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: av.bg, color: av.color }}>
                            {getInitials(a.first_name, a.last_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block" style={{ color: S.snow }}>
                              {a.first_name} {a.last_name}
                            </span>
                          </div>
                          <span className="text-xs flex-shrink-0" style={{ color: S.muted2 }}>
                            {new Date(a.registered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button onClick={() => handleRemoveAttendee(a.id)}
                            aria-label={`Remove ${a.first_name} ${a.last_name}`}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-sm flex-shrink-0 transition-all"
                            style={{ color: '#FF6B6B' }}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showEdit && (
        <Modal title="Edit Event" accent={S.sea} onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {[
              { label: 'Event Name', type: 'text', val: editName, set: setEditName, ph: 'Event name' },
              { label: 'Date', type: 'date', val: editDate, set: setEditDate, ph: '' },
            ].map(({ label, type, val, set, ph }) => (
              <div key={label} className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>{label}</label>
                <input type={type} value={val} onChange={(e) => set(e.target.value)} required placeholder={ph} autoFocus={label === 'Event Name'}
                  className="w-full rounded-sm px-4 py-3 text-sm outline-none"
                  style={{ ...inputStyle, colorScheme: type === 'date' ? 'dark' : undefined }}
                  onFocus={inputFocus} onBlur={inputBlur} />
              </div>
            ))}
            {editError && <p className="text-sm" style={{ color: '#FF6B6B' }}>{editError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2.5 rounded-sm text-sm font-medium" style={{ border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
              <button type="submit" disabled={editLoading} className="flex-1 py-2.5 rounded-sm text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: S.cobalt, color: S.snow }}>
                {editLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <Modal title="Delete Event" accent="#FF6B6B" onClose={() => setShowDelete(false)}>
          <div className="space-y-4">
            <div className="rounded-sm p-4" style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
              <p className="text-sm font-semibold" style={{ color: '#FF6B6B' }}>This action cannot be undone.</p>
              <p className="text-sm mt-1" style={{ color: S.muted }}>
                <span className="font-medium" style={{ color: S.snow }}>{event.name}</span> and all {attendees.length} attendee{attendees.length !== 1 ? 's' : ''} will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(false)} className="flex-1 py-2.5 rounded-sm text-sm font-medium" style={{ border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 py-2.5 rounded-sm text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: '#CC0000', color: S.snow }}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Person Modal */}
      {showAddPerson && (
        <Modal title="Add Person Manually" accent={S.lilac} onClose={() => setShowAddPerson(false)}>
          <form onSubmit={handleAddPerson} className="space-y-4">
            {[
              { label: 'First Name', val: addFirst, set: setAddFirst, ph: 'e.g. John', auto: 'given-name' },
              { label: 'Last Name', val: addLast, set: setAddLast, ph: 'e.g. Smith', auto: 'family-name' },
            ].map(({ label, val, set, ph, auto }, idx) => (
              <div key={label} className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>{label}</label>
                <input type="text" value={val} onChange={(e) => set(e.target.value)} required placeholder={ph} autoFocus={idx === 0} autoComplete={auto}
                  className="w-full rounded-sm px-4 py-3 text-sm outline-none" style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
              </div>
            ))}
            {addError && <p className="text-sm" style={{ color: '#FF6B6B' }}>{addError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowAddPerson(false)} className="flex-1 py-2.5 rounded-sm text-sm font-medium" style={{ border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
              <button type="submit" disabled={addLoading} className="flex-1 py-2.5 rounded-sm text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: S.cobalt, color: S.snow }}>
                {addLoading ? 'Adding...' : 'Add Person'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
