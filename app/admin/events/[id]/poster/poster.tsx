'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

function formatDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(value);
}

export default function Poster({ id, name, date }: { id: string; name: string; date: string }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [checkInUrl, setCheckInUrl] = useState('');
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}/attend/${encodeURIComponent(id)}`;

    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(url, {
        width: 1200,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: { dark: '#060606', light: '#ffffff' },
      }))
      .then((dataUrl) => {
        if (cancelled) return;
        setQrDataUrl(dataUrl);
        setCheckInUrl(url);
      })
      .catch(() => { if (!cancelled) setQrError(true); });

    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="poster-app">
      <nav className="poster-controls" aria-label="Poster controls">
        <Link href={`/admin/events/${id}`} className="poster-back">← Back to event</Link>
        <div className="poster-actions">
          <span>Poster preview · A4 portrait</span>
          <button type="button" onClick={() => window.print()} disabled={!qrDataUrl}>
            Print / Save PDF
          </button>
        </div>
      </nav>

      <main className="poster-sheet" aria-label="Event check-in poster">
        <header className="poster-header">
          <Image src="/epam-logo.svg" alt="EPAM" width={126} height={45} className="poster-logo" priority />
          <span className="poster-brand">EPAM EVENTS</span>
        </header>

        <div className="poster-content">
          <p className="poster-kicker">EVENT CHECK-IN</p>
          <div className="poster-rule" aria-hidden="true" />
          <h1 className="poster-event-title">{name}</h1>
          <p className="poster-date">{formatDate(date)}</p>

          <div className="poster-qr" aria-live="polite">
            {qrDataUrl ? (
              <Image src={qrDataUrl} alt={`QR code to check in to ${name}`} width={1200} height={1200} unoptimized className="poster-qr-image" />
            ) : (
              <p className="poster-qr-loading">
                {qrError ? 'Unable to generate QR code. Please reload the page.' : 'Generating QR code…'}
              </p>
            )}
          </div>

          <h2 className="poster-instruction">Scan to check in</h2>
          <p className="poster-subline">Enter your first and last name to register your attendance.</p>
        </div>

        <footer className="poster-footer">
          <span>{checkInUrl || 'EPAM Events · Attendance'}</span>
          <span className="poster-footer-mark" aria-hidden="true" />
        </footer>
      </main>
    </div>
  );
}
