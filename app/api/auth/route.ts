import { verifyPassword, setAuthCookie, clearAuthCookie, isAuthenticated } from '@/lib/auth';

// GET /api/auth — check if current session is valid
export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true });
}

// POST /api/auth — login
export async function POST(request: Request) {
  const { password } = await request.json();

  if (!password) {
    return Response.json({ error: 'Password is required.' }, { status: 400 });
  }

  const valid = await verifyPassword(password);
  if (!valid) {
    return Response.json({ error: 'Invalid password.' }, { status: 401 });
  }

  try {
    await setAuthCookie();
  } catch {
    return Response.json({ error: 'Session authentication is not configured.' }, { status: 503 });
  }
  return Response.json({ success: true });
}

// DELETE /api/auth — logout
export async function DELETE() {
  await clearAuthCookie();
  return Response.json({ success: true });
}
