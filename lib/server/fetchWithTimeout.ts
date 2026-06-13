import "server-only";

const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number;
};

/**
 * Server-side fetch with abort timeout. Does not retry — callers decide idempotency.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { timeoutMs: _timeoutMs, ...rest } = init;
    void _timeoutMs;

    return await fetch(input, {
      ...rest,
      signal: controller.signal,
      cache: rest.cache ?? "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}
