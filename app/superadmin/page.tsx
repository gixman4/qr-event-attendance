'use client';

import { useEffect, useState } from 'react';
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
};

interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalAttendees: number;
  eventsToday: number;
  topUsers: { id: string; username: string; role: string; event_count: number }[];
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-sm p-5" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: S.muted }}>{label}</p>
      <p className="text-3xl font-black" style={{ color: accent ?? S.snow }}>{value.toLocaleString()}</p>
    </div>
  );
}

export default function SuperAdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/super/stats')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
      </div>
    );
  }

  if (!stats) {
    return <p style={{ color: S.muted }}>Failed to load statistics.</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>Overview</h1>
        <p className="text-sm mt-1" style={{ color: S.muted }}>Platform-wide statistics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard label="Total Users"     value={stats.totalUsers}     accent={S.lilac} />
        <StatCard label="Total Events"    value={stats.totalEvents}    accent={S.sea}   />
        <StatCard label="Total Attendees" value={stats.totalAttendees} />
        <StatCard label="Events Today"    value={stats.eventsToday}    accent={S.cobalt === '#0047FF' ? '#6699FF' : S.cobalt} />
      </div>

      {/* Top users */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: S.muted }}>Most Active Users</h2>
        <div className="rounded-sm overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {stats.topUsers.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: S.muted }}>No users yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.surface2 }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Username</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Role</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Events</th>
                </tr>
              </thead>
              <tbody>
                {stats.topUsers.map((u, i) => (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? S.surface : S.surface2, borderBottom: `1px solid ${S.border}` }}>
                    <td className="px-4 py-3 font-medium" style={{ color: S.snow }}>
                      <Link href="/superadmin/users" className="hover:underline">{u.username}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider"
                        style={u.role === 'super_admin'
                          ? { background: S.lilac, color: S.bg }
                          : { background: S.surface2, color: S.muted, border: `1px solid ${S.border}` }}
                      >
                        {u.role === 'super_admin' ? 'Super Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black" style={{ color: S.sea }}>{u.event_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
