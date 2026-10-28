'use client';

import { useEffect, useState } from 'react';

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
  green:   '#6EE7B7',
  yellow:  '#FCD34D',
  red:     '#FF6B6B',
};

const MODES = [
  {
    value: 'open',
    label: 'Open',
    description: 'Anyone can register a new account.',
    color: S.green,
  },
  {
    value: 'invite_only',
    label: 'Invite Only',
    description: 'Registration is restricted. (Coming soon: invite tokens)',
    color: S.yellow,
  },
  {
    value: 'closed',
    label: 'Closed',
    description: 'Registration is disabled. Existing users can still log in.',
    color: S.red,
  },
];

export default function SuperAdminSettings() {
  const [mode, setMode]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch('/api/super/settings')
      .then((r) => r.json())
      .then((data) => {
        setMode(data.registration_mode ?? 'open');
        setLoading(false);
      });
  }, []);

  const save = async (newMode: string) => {
    setSaving(true);
    setSaved(false);
    setError('');
    const res = await fetch('/api/super/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_mode: newMode }),
    });
    if (res.ok) {
      setMode(newMode);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to save.');
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: S.snow }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: S.muted }}>Platform configuration</p>
      </div>

      <div className="max-w-lg">
        <div className="rounded-sm overflow-hidden mb-6" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${S.sea}, ${S.cobalt})` }} />
          <div className="p-6">
            <h2 className="font-bold mb-1" style={{ color: S.snow }}>Registration Mode</h2>
            <p className="text-sm mb-5" style={{ color: S.muted }}>Control who can create new accounts.</p>

            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid ${S.border}`, borderTopColor: S.sea }} />
              </div>
            ) : (
              <div className="space-y-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => save(m.value)}
                    disabled={saving || mode === m.value}
                    className="w-full text-left px-4 py-3 rounded-sm transition-all disabled:cursor-default"
                    style={{
                      background: mode === m.value ? S.surface2 : 'transparent',
                      border: `1px solid ${mode === m.value ? m.color + '66' : S.border}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: mode === m.value ? m.color : S.border }}
                      />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: mode === m.value ? m.color : S.snow }}>
                          {m.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: S.muted }}>{m.description}</p>
                      </div>
                      {mode === m.value && (
                        <span className="ml-auto text-xs font-bold uppercase tracking-wider" style={{ color: m.color }}>
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {saved && (
              <p className="mt-4 text-sm" style={{ color: S.green }}>Settings saved.</p>
            )}
            {error && (
              <p className="mt-4 text-sm" style={{ color: S.red }}>{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
