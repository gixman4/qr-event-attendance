import { verifyPassword, setAuthCookie, clearAuthCookie } from '@/lib/auth';

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

  await setAuthCookie();
  return Response.json({ success: true });
}

// DELETE /api/auth — logout
export async function DELETE() {
  await clearAuthCookie();
  return Response.json({ success: true });
}
