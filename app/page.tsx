import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#060606' }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-6">
        <Image src="/epam-logo.svg" alt="EPAM" width={100} height={35} priority />
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
        {/* Cyan glow blob behind headline */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,246,255,0.08) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-lg space-y-8">
          {/* Label */}
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: '#00F6FF' }}
          >
            EPAM Internal Tool
          </p>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tight" style={{ color: '#FBFAFA' }}>
              EPAM Events
            </h1>
            <p className="text-lg font-light" style={{ color: 'rgba(251,250,250,0.55)' }}>
              Create events, generate QR codes,<br />track attendance instantly.
            </p>
          </div>

          {/* Feature row */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {[
              { icon: '◈', label: 'QR Check-in' },
              { icon: '◎', label: 'Live Attendance' },
              { icon: '⬡', label: 'Excel Export' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span style={{ color: '#00F6FF', fontSize: '0.9rem' }}>{icon}</span>
                <span className="text-sm font-medium" style={{ color: 'rgba(251,250,250,0.6)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link
              href="/admin"
              className="inline-block w-full max-w-xs font-bold text-sm py-3.5 px-8 rounded-sm transition-all"
              style={{
                background: '#0047FF',
                color: '#FBFAFA',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Open Admin Dashboard
            </Link>
            <p className="text-xs" style={{ color: 'rgba(251,250,250,0.35)' }}>
              Password protected — EPAM team only
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-5 flex items-center justify-between border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-xs" style={{ color: 'rgba(251,250,250,0.25)' }}>
          © {new Date().getFullYear()} EPAM Systems
        </span>
        <span className="text-xs" style={{ color: 'rgba(251,250,250,0.25)' }}>
          Internal use only
        </span>
      </footer>
    </main>
  );
}
