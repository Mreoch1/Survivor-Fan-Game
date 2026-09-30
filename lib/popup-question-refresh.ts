const MAX_TIMEOUT_MS = 2_147_483_647;
const RETRY_MS = 30_000;

// The timestamp is safe to expose before the question; its wording remains private.
// Use the caller's server-adjusted clock so a slow/fast device clock cannot open it early.
export function schedulePopupQuestionRefresh(
  opensAt: string | null,
  now: () => number,
  refresh: () => Promise<boolean>,
) {
  const opens = Date.parse(opensAt || "");
  if (!Number.isFinite(opens)) return () => {};
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;

  async function check() {
    if (cancelled) return;
    if (now() < opens) { schedule(); return; }
    try {
      if (await refresh()) return;
    } catch { /* A temporary failure must not lose the scheduled question. */ }
    if (!cancelled) timer = setTimeout(check, RETRY_MS);
  }

  function schedule() {
    // Longer waits must be split because browsers clamp overflowing timeouts to 1 ms.
    timer = setTimeout(check, Math.min(MAX_TIMEOUT_MS, Math.max(0, opens - now())));
  }
  schedule();
  return () => { cancelled = true; clearTimeout(timer); };
}
