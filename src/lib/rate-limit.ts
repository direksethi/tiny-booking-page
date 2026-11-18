/**
 * A sliding-window counter held in memory. It resets when the process
 * restarts and is not shared between processes, which matches the rest of
 * this app: one instance.
 */

export interface RateLimiter {
  /** Records an attempt and reports whether it is within the limit. */
  allow(key: string, now?: number): boolean;
}

const MAX_KEYS = 10_000;

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const attempts = new Map<string, number[]>();

  return {
    allow(key, now = Date.now()) {
      const recent = (attempts.get(key) ?? []).filter((at) => at > now - windowMs);

      if (recent.length >= max) {
        attempts.set(key, recent);
        return false;
      }

      recent.push(now);
      // Re-insert so the map stays ordered by last use.
      attempts.delete(key);
      attempts.set(key, recent);

      // Bound memory: drop the keys that have gone longest without a request.
      while (attempts.size > MAX_KEYS) {
        const oldest = attempts.keys().next().value;
        if (oldest === undefined) break;
        attempts.delete(oldest);
      }

      return true;
    },
  };
}

/**
 * The visitor's IP address, read from the header named by TRUSTED_IP_HEADER.
 * Returns null when the variable is unset: without a proxy that sets the
 * header, any value a client sends could be forged.
 */
export function clientAddress(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const name = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (!name) return null;

  const value = headers.get(name);
  if (!value) return null;

  // In a forwarded list, the last entry is the one the nearest proxy added.
  const address = value.split(",").pop()?.trim() ?? "";
  return address && address.length <= 64 ? address : null;
}
