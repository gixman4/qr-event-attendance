'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const S = {
  bg:      '#060606',
  surface: '#111111',
  surface2:'#1a1a1a',
  border:  'rgba(255,255,255,0.08)',
  sea:     '#00F6FF',
  cobalt:  '#0047FF',
  lilac:   '#B896FF',
  snow:    '#FBFAFA',
  muted:   'rgba(251,250,250,0.50)',
  muted2:  'rgba(251,250,250,0.30)',
  red:     '#FF6B6B',
};

interface SuperEvent {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  check_in_open: number;
  owner_id: string | null;
  owner_username: string | null;
  created_at: string;
  attendee_count: number;
}

interface UserOption { id: string; username: string; }

export default function SuperAdminEvents() {
  const [events, setEvents]         = useState<SuperEvent[]>([]);
  const [users, setUsers]           = useState<UserOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState<SuperEvent | null>(null);
  const [transferEvent, setTransferEvent] = useState<SuperEvent | null>(null);
  const [transferTo, setTransferTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [evRes, usRes] = await Promise.all([
      fetch('/api/super/events'),
      fetch('/api/super/users'),
    ]);
    if (evRes.ok)  setEvents(await evRes.json());
    if (usRes.ok) setUsers(await usRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = events.filter((e) => {
    const q = search.toLowerCase();
    return !q
      || e.name.toLowerCase().includes(q)
      || (e.owner_username ?? '').toLowerCase().includes(q)
      || e.date.includes(q)
      || (e.location ?? '').toLowerCase().includes(q);
  });

  const toggleCheckIn = async (event: SuperEvent) => {
    const next = event.check_in_open !== 1;
    setActionLoading(event.id + ':checkin');
    setError('');
    const res = await fetch(`/api/super/events/${event.id}/check-in`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_in_open: next }),
    });
    if (res.ok) {
      setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, check_in_open: next ? 1 : 0 } : e));
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to update check-in.');
    }
    setActionLoading(null);
  };

  const deleteEvent = async (event: SuperEvent) => {
    setConfirmDelete(null);
    setActionLoading(event.id + ':delete');
    setError('');
    const res = await fetch(`/api/super/events/${event.id}`, { method: 'DELETE' });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to delete event.');
    }
    setActionLoading(null);
  };

  const transferOwner = async () => {
    if (!transferEvent || !transferTo) return;
    setActionLoading(transferEvent.id + ':transfer');
    setError('');
    const res = await fetch(`/api/super/events/${transferEvent.id}/owner`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_owner_id: transferTo }),
    });
    if (res.ok) {
      const newOwner = users.find((u) => u.id === transferTo);
      setEvents((prev) => prev.map((e) =>
        e.id === transferEvent.id ? { ...e, owner_id: transferTo, owner_username: newOwner?.username ?? transferTo } : e,
      ));
      setTransferEvent(null);
      setTransferTo('');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to transfer ownership.');
    }
    setActionLoading(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>All Events</h1>
        <p className="text-sm mt-1" style={{ color: S.muted }}>{events.length} total across all users</p>
      </div>

      {error && <p className="mb-4 text-sm" style={{ color: S.red }}>{error}</p>}

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, owner, date, or location"
          className="w-full rounded-sm px-4 py-2.5 text-sm outline-none"
          style={{ background: S.surface, border: `1px solid ${S.border}`, color: S.snow }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
        </div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.surface2 }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: S.muted }}>Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: S.muted }}>Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Attendees</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event, i) => (
                <tr key={event.id} style={{ background: i % 2 === 0 ? S.surface : S.surface2, borderBottom: `1px solid ${S.border}` }}>
                  <td className="px-4 py-3 font-medium max-w-[180px] truncate" style={{ color: S.snow }}>{event.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: S.muted }}>{event.owner_username ?? '—'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: S.muted }}>{event.date}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: S.sea }}>{event.attendee_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs" style={{ color: event.check_in_open ? S.sea : S.red }}>
                      {event.check_in_open ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleCheckIn(event)}
                        disabled={!!actionLoading}
                        className="text-xs px-2 py-1 rounded-sm disabled:opacity-40 hover:opacity-80"
                        style={{ border: `1px solid ${S.border}`, color: S.muted }}
                      >
                        {event.check_in_open ? 'Close' : 'Open'}
                      </button>
                      <button
                        onClick={() => { setTransferEvent(event); setTransferTo(''); }}
                        disabled={!!actionLoading}
                        className="text-xs px-2 py-1 rounded-sm disabled:opacity-40 hover:opacity-80"
                        style={{ border: `1px solid ${S.border}`, color: S.lilac }}
                      >
                        Transfer
                      </button>
                      <button
                        onClick={() => setConfirmDelete(event)}
                        disabled={!!actionLoading}
                        className="text-xs px-2 py-1 rounded-sm disabled:opacity-40 hover:opacity-80"
                        style={{ border: `1px solid ${S.red}33`, color: S.red }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: S.muted }}>
                    {search ? 'No events match your search.' : 'No events yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-sm p-6" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <h2 className="font-bold mb-2" style={{ color: S.snow }}>Delete event?</h2>
            <p className="text-sm mb-5" style={{ color: S.muted }}>
              Permanently delete <strong style={{ color: S.snow }}>{confirmDelete.name}</strong> and all its attendees?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 text-sm py-2 rounded-sm" style={{ border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
              <button onClick={() => deleteEvent(confirmDelete)} className="flex-1 text-sm py-2 rounded-sm font-bold" style={{ background: S.red, color: S.snow }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer ownership */}
      {transferEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-sm p-6" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <h2 className="font-bold mb-2" style={{ color: S.snow }}>Transfer ownership</h2>
            <p className="text-sm mb-4" style={{ color: S.muted }}>
              Transfer <strong style={{ color: S.snow }}>{transferEvent.name}</strong> to:
            </p>
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="w-full rounded-sm px-3 py-2 text-sm outline-none mb-4"
              style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.snow }}
            >
              <option value="">Select a user...</option>
              {users.filter((u) => u.id !== transferEvent.owner_id).map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setTransferEvent(null)} className="flex-1 text-sm py-2 rounded-sm" style={{ border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
              <button onClick={transferOwner} disabled={!transferTo || !!actionLoading} className="flex-1 text-sm py-2 rounded-sm font-bold disabled:opacity-50" style={{ background: S.cobalt, color: S.snow }}>Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
