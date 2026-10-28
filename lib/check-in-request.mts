type CheckInPayload = { first_name: string; last_name: string; confirm_duplicate: boolean };

type RetryOptions = {
  signal: AbortSignal;
  onPreparing: () => void;
  maxAttempts?: number;
  delayMs?: number;
  request?: typeof fetch;
};

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer);
      reject(new DOMException('Check-in cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', aborted);
      resolve();
    }, ms);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

export async function sendCheckInWithRetry(url: string, payload: CheckInPayload, options: RetryOptions): Promise<Response> {
  const { signal, onPreparing, maxAttempts = 100, delayMs = 500, request = fetch } = options;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal.aborted) throw new DOMException('Check-in cancelled.', 'AbortError');
    const response = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (response.status !== 503) return response;

    let data: unknown;
    try { data = await response.clone().json(); } catch { return response; }
    if (!data || typeof data !== 'object' || !('code' in data) || data.code !== 'CHECK_IN_PREPARING') {
      return response;
    }

    if (signal.aborted) throw new DOMException('Check-in cancelled.', 'AbortError');
    onPreparing();
    if (attempt < maxAttempts - 1) await pause(delayMs, signal);
  }

  return Response.json({
    code: 'CHECK_IN_PREPARING',
    error: 'Check-in is still being prepared. Please try again shortly.',
  }, { status: 503 });
}
