/**
 * What a live channel accepts, kept away from the socket so it can be read and
 * tested on its own. A socket is not protected by the same-origin policy the
 * way a fetch is, so the origin is checked here rather than assumed.
 */

const canonical = (origin: string) => origin.trim().replace(/\/+$/, "");

export function isAllowedOrigin(
  origin: string | undefined,
  allowed: string[],
): boolean {
  if (allowed.length === 0) return true;
  if (!origin) return false;
  return allowed.map(canonical).includes(canonical(origin));
}

export type AskAllowanceOptions = {
  limit: number;
  windowMs: number;
  disabled?: boolean;
};

/**
 * A fixed window of questions per connection. One socket that asks in a loop
 * spends its own allowance and no one else's, and a suite that deliberately
 * hammers the stack can switch it off the way the HTTP limiter can.
 */
export function createAskAllowance(options: AskAllowanceOptions) {
  let count = 0;
  let resetAt = 0;
  return {
    take(now: number): boolean {
      if (options.disabled) return true;
      if (now >= resetAt) {
        count = 0;
        resetAt = now + options.windowMs;
      }
      if (count >= options.limit) return false;
      count += 1;
      return true;
    },
  };
}
