import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import Image from 'next/image';

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

const NAV = [
  { href: '/superadmin',          label: 'Overview'  },
  { href: '/superadmin/users',    label: 'Users'     },
  { href: '/superadmin/events',   label: 'Events'    },
  { href: '/superadmin/logs',     label: 'Audit Log' },
  { href: '/superadmin/settings', label: 'Settings'  },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'super_admin') {
    redirect('/admin');
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: S.bg }}>
      {/* Top nav */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 h-14 flex-shrink-0"
        style={{ background: S.surface, borderBottom: `1px solid ${S.border}` }}
      >
        <div className="flex items-center gap-4">
          <Image src="/epam-logo.svg" alt="EPAM" width={75} height={26} priority />
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
            style={{ background: S.lilac, color: S.bg }}
          >
            Super Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs" style={{ color: S.muted }}>
            {session.username}
          </span>
          <Link
            href="/admin"
            className="text-xs px-3 py-1.5 rounded-sm transition-opacity hover:opacity-80"
            style={{ border: `1px solid ${S.border}`, color: S.muted }}
          >
            ← My Events
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav
          className="hidden md:flex flex-col w-44 flex-shrink-0 pt-6 pb-4 px-3"
          style={{ borderRight: `1px solid ${S.border}` }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm px-3 py-2 rounded-sm mb-0.5 transition-colors hover:opacity-80"
              style={{ color: S.muted }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden w-full" style={{ borderBottom: `1px solid ${S.border}` }} />

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile nav tabs */}
          <div
            className="md:hidden flex overflow-x-auto gap-1 px-4 py-2"
            style={{ borderBottom: `1px solid ${S.border}` }}
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-sm whitespace-nowrap"
                style={{ color: S.muted, border: `1px solid ${S.border}` }}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="px-6 py-8 max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export { S };
