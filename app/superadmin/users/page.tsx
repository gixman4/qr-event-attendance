'use client';

import { useEffect, useState, useCallback } from 'react';

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

interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
  event_count: number;
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/super/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleRole = async (user: User) => {
    const newRole = user.role === 'super_admin' ? 'user' : 'super_admin';
    setActionLoading(user.id + ':role');
    setError('');
    const res = await fetch(`/api/super/users/${user.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to update role.');
    }
    setActionLoading(null);
  };

  const deleteUser = async (user: User) => {
    setConfirmDelete(null);
    setActionLoading(user.id + ':delete');
    setError('');
    const res = await fetch(`/api/super/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to delete user.');
    }
    setActionLoading(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>Users</h1>
        <p className="text-sm mt-1" style={{ color: S.muted }}>{users.length} registered accounts</p>
      </div>

      {error && <p className="mb-4 text-sm" style={{ color: S.red }}>{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
        </div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.surface2 }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Username</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Joined</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Events</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} style={{ background: i % 2 === 0 ? S.surface : S.surface2, borderBottom: `1px solid ${S.border}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: S.snow }}>{user.username}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider"
                      style={user.role === 'super_admin'
                        ? { background: S.lilac, color: S.bg }
                        : { background: S.surface2, color: S.muted, border: `1px solid ${S.border}` }}
                    >
                      {user.role === 'super_admin' ? 'Super Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: S.muted }}>
                    {new Date(user.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: S.sea }}>{user.event_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleRole(user)}
                        disabled={actionLoading === user.id + ':role'}
                        className="text-xs px-2.5 py-1 rounded-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ border: `1px solid ${S.border}`, color: user.role === 'super_admin' ? S.muted : S.lilac }}
                      >
                        {actionLoading === user.id + ':role' ? '...' : user.role === 'super_admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(user)}
                        disabled={actionLoading === user.id + ':delete'}
                        className="text-xs px-2.5 py-1 rounded-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ border: `1px solid ${S.red}33`, color: S.red }}
                      >
                        {actionLoading === user.id + ':delete' ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-sm p-6" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <h2 className="font-bold mb-2" style={{ color: S.snow }}>Delete user?</h2>
            <p className="text-sm mb-5" style={{ color: S.muted }}>
              This will permanently delete <strong style={{ color: S.snow }}>{confirmDelete.username}</strong> and all their events and attendees.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 text-sm py-2 rounded-sm"
                style={{ border: `1px solid ${S.border}`, color: S.muted }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                className="flex-1 text-sm py-2 rounded-sm font-bold"
                style={{ background: S.red, color: S.snow }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
