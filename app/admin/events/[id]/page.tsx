'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface Event {
  id: string;
  name: string;
  date: string;
  created_at: string;
}

interface Attendee {
  id: string;
  first_name: string;
  last_name: string;
  registered_at: string;
}

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];
function avatarColor(i: number) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

/* ─────────── Modal wrapper ─────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-900">{title}</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Main page ─────────── */
export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Modal states
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add person
  const [addFirst, setAddFirst] = useState('');
  const [addLast, setAddLast] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const attendUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/attend/${id}`
      : `/attend/${id}`;

  const loadData = async () => {
    const res = await fetch(`/api/events/${id}`);
    if (!res.ok) { setError('Event not found.'); setLoading(false); return; }
    const data = await res.json();
    setEvent(data.event);
    setAttendees(data.attendees);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!event) return;
    import('qrcode').then((QRCode) => {
      const url = typeof window !== 'undefined'
        ? `${window.location.origin}/attend/${id}`
        : `/attend/${id}`;
      QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1e3a5f', light: '#ffffff' } })
        .then(setQrDataUrl);
    });
  }, [event, id]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(attendUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Open edit modal ── */
  const openEdit = () => {
    if (!event) return;
    setEditName(event.name);
    setEditDate(event.date);
    setEditError('');
    setShowEdit(true);
  };

  /* ── Save edit ── */
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    const res = await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, date: editDate }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEvent(updated);
      setShowEdit(false);
    } else {
      const data = await res.json();
      setEditError(data.error ?? 'Failed to update.');
    }
    setEditLoading(false);
  };

  /* ── Delete event ── */
  const handleDelete = async () => {
    setDeleteLoading(true);
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin');
    } else {
      setDeleteLoading(false);
      setShowDelete(false);
    }
  };

  /* ── Add person ── */
  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    const res = await fetch(`/api/events/${id}/attendees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: addFirst, last_name: addLast }),
    });
    if (res.ok) {
      const newAttendee = await res.json();
      setAttendees((prev) => [...prev, newAttendee]);
      setAddFirst('');
      setAddLast('');
      setShowAddPerson(false);
    } else {
      const data = await res.json();
      setAddError(data.error ?? 'Failed to add person.');
    }
    setAddLoading(false);
  };

  /* ── Remove attendee ── */
  const handleRemoveAttendee = async (aid: string) => {
    const res = await fetch(`/api/events/${id}/attendees/${aid}`, { method: 'DELETE' });
    if (res.ok) {
      setAttendees((prev) => prev.filter((a) => a.id !== aid));
    }
  };

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fb]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f4f6fb]">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{error || 'Event not found.'}</p>
          <Link href="/admin" className="text-blue-600 underline text-sm">Back to events</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#f4f6fb]">
        {/* Nav */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All events
            </Link>
            <div className="flex items-center gap-2">
              <a
                href={`/api/events/${id}/export`}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                </svg>
                Export Excel
              </a>
              {/* Settings dropdown trigger — just two icon buttons */}
              <button
                onClick={openEdit}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors"
                title="Edit event"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-red-50 text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors"
                title="Delete event"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Event title */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{event.name}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{event.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* ── QR Code card ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-6 flex flex-col items-center text-center gap-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scan to Register</p>
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-inner">
                  {qrDataUrl ? (
                    <Image src={qrDataUrl} alt="QR Code" width={220} height={220} className="rounded-lg" />
                  ) : (
                    <div className="w-[220px] h-[220px] bg-slate-50 rounded-lg flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="w-full space-y-2">
                  <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-400 break-all font-mono">{attendUrl}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={copyLink}
                      className="flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium py-2.5 rounded-lg transition-colors"
                    >
                      {copied ? (
                        <><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy Link</>
                      )}
                    </button>
                    {qrDataUrl && (
                      <a
                        href={qrDataUrl}
                        download={`${event.name.replace(/[^a-z0-9]/gi, '_')}_qr.png`}
                        className="flex items-center justify-center gap-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium py-2.5 rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                        Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Attendees card ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendees</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{attendees.length}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setAddFirst(''); setAddLast(''); setAddError(''); setShowAddPerson(true); }}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      title="Add person manually"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add
                    </button>
                    <button
                      onClick={loadData}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Refresh"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {attendees.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm text-center">No one has checked in yet.<br />Share the QR code or add manually!</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-72 -mx-1 px-1 space-y-0.5">
                    {attendees.map((a, i) => (
                      <div key={a.id} className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(i)}`}>
                          {getInitials(a.first_name, a.last_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-800 truncate block">
                            {a.first_name} {a.last_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(a.registered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveAttendee(a.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0"
                          title="Remove"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── Edit Event Modal ── */}
      {showEdit && (
        <Modal title="Edit Event" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            {editError && <p className="text-red-600 text-sm">{editError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={editLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDelete && (
        <Modal title="Delete Event" onClose={() => setShowDelete(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-700">This action cannot be undone.</p>
                <p className="text-sm text-red-600 mt-0.5">
                  <span className="font-medium">{event.name}</span> and all {attendees.length} attendee{attendees.length !== 1 ? 's' : ''} will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(false)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {deleteLoading ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Person Modal ── */}
      {showAddPerson && (
        <Modal title="Add Person Manually" onClose={() => setShowAddPerson(false)}>
          <form onSubmit={handleAddPerson} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">First Name</label>
              <input
                type="text"
                value={addFirst}
                onChange={(e) => setAddFirst(e.target.value)}
                required
                autoFocus
                autoComplete="given-name"
                placeholder="e.g. John"
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Name</label>
              <input
                type="text"
                value={addLast}
                onChange={(e) => setAddLast(e.target.value)}
                required
                autoComplete="family-name"
                placeholder="e.g. Smith"
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            {addError && <p className="text-red-600 text-sm">{addError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowAddPerson(false)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={addLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {addLoading ? 'Adding...' : 'Add Person'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
