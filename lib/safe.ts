// Wraps a data-fetch so a temporarily-unreachable database can never hard-fail
// a build. Pages using ISR (revalidate) still get prerendered once at build
// time even though they're meant to refresh periodically — if the DB happens
// to be down (rate-limited, over quota, a brief outage) at that exact moment,
// the whole build used to fail outright. Falling back to a safe default
// instead lets the build succeed with placeholder data; the next successful
// ISR revalidation replaces it with the real thing once the DB is reachable
// again — same self-healing behavior ISR already has for stale content.
export async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`safeQuery(${context}) failed, using fallback:`, (err as Error).message);
    return fallback;
  }
}
