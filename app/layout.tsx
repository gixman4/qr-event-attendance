import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import './globals.css';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  weight: ['300', '400', '600', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EPAM Events',
  description: 'Event attendance tracking by EPAM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <body className="min-h-screen antialiased" style={{ background: '#060606', color: '#FBFAFA' }}>
        {children}
      </body>
    </html>
  );
}
