/**
 * Simple in-memory rate limiter.
 * Tracks requests per user per window.
 * For production, swap this with Redis-based rate limiting.
 */

type RateEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export type RateLimitConfig = {
  maxRequests: number;   // Max requests per window
  windowMs: number;      // Window size in milliseconds
};

// Default configs for different route types
export const RATE_LIMITS = {
  // AI endpoints: expensive, limit hard
  ai: { maxRequests: 10, windowMs: 60 * 1000 } as RateLimitConfig,        // 10/min
  // Chat messages: moderate
  chat: { maxRequests: 30, windowMs: 60 * 1000 } as RateLimitConfig,      // 30/min
  // Search/browse: lenient
  search: { maxRequests: 60, windowMs: 60 * 1000 } as RateLimitConfig,    // 60/min
  // Auth actions: tight
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 } as RateLimitConfig,  // 5/15min
  // Admin actions
  admin: { maxRequests: 30, windowMs: 60 * 1000 } as RateLimitConfig,     // 30/min
  // General API
  general: { maxRequests: 40, windowMs: 60 * 1000 } as RateLimitConfig,   // 40/min
};

/**
 * Check if a request is within rate limits.
 *
 * Usage:
 *   const limit = checkRateLimit(userId, "ai");
 *   if (!limit.allowed) return Response with 429
 */
export function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMITS[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetAt - now };
}

/**
 * Create a rate-limited response (429 Too Many Requests)
 */
export function rateLimitResponse(resetIn: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down.",
      retryAfterMs: resetIn,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetIn / 1000)),
      },
    }
  );
}
