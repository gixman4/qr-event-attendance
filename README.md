# EPAM Events

QR-based event check-in built with Next.js and Turso. Team admins can create events, share a QR code, manage attendees, and download an Excel attendance list.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the private values. Generate `SESSION_SECRET` with `openssl rand -base64 48` (use at least 32 random characters). Never commit `.env.local`.
3. Run `npm run dev` and open `http://localhost:3000`.

After `npm run build`, run `npm run test:integration` to exercise the API using a temporary local database (not the production Turso database).
Run `npm run test:browser` for an optional headless Chrome check of the real check-in and admin forms. It also uses a temporary local database, and skips when Chrome is unavailable; set `CHROME_BIN` to the Chrome executable on non-macOS systems.

## Vercel setup

Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in **Project → Settings → Environment Variables** for Production. Redeploy after changing environment variables. Rotating `SESSION_SECRET` signs out existing admin sessions.

**Security:** If any database token or admin password was shared outside a secure channel, revoke/rotate the token in Turso and change the password in Vercel and `.env.local`. After rotation, redeploy. Do not include credentials in a Git repository or a public chat.

Public QR links expose only event details (name, date, optional time/location, and check-in status); the attendee list and Excel download require an authenticated admin session. Team members should use the password-protected `/admin` page.

## Managing check-in

Admins can search the event dashboard by name, creator, date, or location, and search attendees within an event by first or last name. Search only filters the on-screen list: the displayed total and Excel export always include every attendee.

Time and location are optional on event creation and can be edited later. Existing events retain their data and default to open check-in. An admin can close or reopen public check-in from the event page; the QR code stays the same. Closing prevents public submissions, including confirmations of duplicate names, but admins may still add attendees manually. A duplicate-name warning lets an attendee explicitly continue if they are a different person with the same name.

## Printing a check-in poster

From an event's admin page, click **Print poster / Save PDF** below its QR code. The A4 portrait preview opens in a new tab. Once the QR code appears, click **Print / Save PDF** and choose a printer or **Save as PDF** in the browser dialog. The printed version uses a light, ink-friendly layout with a large high-contrast QR code; no attendee or organizer names appear on the poster.
