type VisibilityTarget = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

/** Poll one request at a time while the page is visible. Returns a cleanup function. */
export function startVisiblePolling(
  task: (signal: AbortSignal) => Promise<void>,
  intervalMs = 5000,
  page: VisibilityTarget = document,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | undefined;
  let stopped = false;
  let refreshOnVisible = false;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    if (stopped || page.hidden || inFlight || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      void poll();
    }, intervalMs);
  };

  const poll = async () => {
    if (stopped || page.hidden || inFlight) return;
    const controller = new AbortController();
    inFlight = controller;
    try {
      await task(controller.signal);
    } catch {
      // A failed refresh must not remove the data already on screen.
    } finally {
      inFlight = undefined;
      if (!stopped && !page.hidden) {
        if (refreshOnVisible) {
          refreshOnVisible = false;
          void poll();
        } else {
          schedule();
        }
      }
    }
  };

  const onVisibilityChange = () => {
    if (page.hidden) {
      refreshOnVisible = true;
      clearTimer();
      inFlight?.abort();
    } else if (!inFlight) {
      refreshOnVisible = false;
      clearTimer();
      void poll();
    }
  };

  page.addEventListener('visibilitychange', onVisibilityChange);
  schedule();

  return () => {
    stopped = true;
    clearTimer();
    inFlight?.abort();
    page.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
