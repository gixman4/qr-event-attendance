# EPAM Events

QR-based event check-in built with Next.js and Turso. Team admins can create events, share a QR code, manage attendees, and download an Excel attendance list.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the private values. Generate `SESSION_SECRET` with `openssl rand -base64 48` (use at least 32 random characters). Never commit `.env.local`.
3. Run `npm run dev` and open `http://localhost:3000`.

After `npm run build`, run `npm run test:integration` to exercise the API using a temporary local database (not the production Turso database).

## Vercel setup

Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in **Project → Settings → Environment Variables** for Production. Redeploy after changing environment variables. Rotating `SESSION_SECRET` signs out existing admin sessions.

**Security:** If any database token or admin password was shared outside a secure channel, revoke/rotate the token in Turso and change the password in Vercel and `.env.local`. After rotation, redeploy. Do not include credentials in a Git repository or a public chat.

Public QR links expose only the event name and date; the attendee list and Excel download require an authenticated admin session. Team members should use the password-protected `/admin` page.

## Printing a check-in poster

From an event's admin page, click **Print poster / Save PDF** below its QR code. The A4 portrait preview opens in a new tab. Once the QR code appears, click **Print / Save PDF** and choose a printer or **Save as PDF** in the browser dialog. The printed version uses a light, ink-friendly layout with a large high-contrast QR code; no attendee or organizer names appear on the poster.
