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
};

const ACTION_LABELS: Record<string, string> = {
  'user.register':       'Registered',
  'user.delete':         'User deleted',
  'role.promote':        'Promoted to Super Admin',
  'role.demote':         'Demoted to User',
  'event.force_delete':  'Force-deleted event',
  'event.force_close':   'Force-closed check-in',
  'event.force_open':    'Force-opened check-in',
  'event.transfer':      'Transferred event',
  'settings.registration_mode': 'Changed registration mode',
};

const ACTION_COLORS: Record<string, string> = {
  'user.register':       '#6EE7B7',
  'user.delete':         '#FF6B6B',
  'role.promote':        '#B896FF',
  'role.demote':         '#FDA4AF',
  'event.force_delete':  '#FF6B6B',
  'event.force_close':   '#FFAAAA',
  'event.force_open':    '#00F6FF',
  'event.transfer':      '#B896FF',
  'settings.registration_mode': '#FCD34D',
};

interface LogEntry {
  id: string;
  actor_name: string | null;
  action: string;
  target: string | null;
  created_at: string;
}

export default function SuperAdminLogs() {
  const [logs, setLogs]   = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]   = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const res = await fetch(`/api/super/logs?page=${p}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setPages(data.pages);
      setTotal(data.total);
      setPage(p);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(1); }, [load]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>Audit Log</h1>
        <p className="text-sm mt-1" style={{ color: S.muted }}>{total} total entries</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
        </div>
      ) : (
        <>
          <div className="space-y-1.5 mb-6">
            {logs.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: S.muted }}>No log entries yet.</p>
            ) : logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 px-4 py-3 rounded-sm"
                style={{ background: S.surface, border: `1px solid ${S.border}` }}
              >
                {/* Color dot */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: ACTION_COLORS[log.action] ?? S.muted }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-sm" style={{ color: S.snow }}>
                      {log.actor_name ?? 'System'}
                    </span>
                    <span className="text-sm" style={{ color: ACTION_COLORS[log.action] ?? S.muted }}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    {log.target && (
                      <span className="text-xs truncate" style={{ color: S.muted }}>{log.target}</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: S.muted2 }}>
                    {new Date(log.created_at).toLocaleString('en', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                className="text-xs px-3 py-1.5 rounded-sm disabled:opacity-30"
                style={{ border: `1px solid ${S.border}`, color: S.muted }}
              >
                ← Prev
              </button>
              <span className="text-xs" style={{ color: S.muted }}>
                Page {page} of {pages}
              </span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= pages}
                className="text-xs px-3 py-1.5 rounded-sm disabled:opacity-30"
                style={{ border: `1px solid ${S.border}`, color: S.muted }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
