// lib/security.ts
// Central security layer for all AI endpoints
// Import and use in every API route that touches LLM input/output

// ═══════════════════════════════════════════════════════════════
// 1. INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════

// Known injection patterns — case insensitive matching
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|context)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)/i,
  /forget\s+(all\s+)?(previous|prior|above|everything)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /act\s+as\s+(a|an|the|if)\s+/i,
  /pretend\s+(you|to\s+be|you're)/i,
  /roleplay\s+as/i,
  /switch\s+to\s+.*(mode|persona|character)/i,
  /enter\s+.*(mode|persona)/i,
  /jailbreak/i,
  /DAN\s*(mode)?/i,
  /do\s+anything\s+now/i,
  /bypass\s+(your|all|any|the)\s+(restrictions|rules|filters|guidelines|safety)/i,
  /override\s+(your|all|any|the)\s+(restrictions|rules|instructions|programming)/i,
  /reveal\s+(your|the)\s+(system|initial|original)\s*(prompt|instructions|message)/i,
  /show\s+(me\s+)?(your|the)\s+(system|initial)\s*(prompt|instructions)/i,
  /repeat\s+(everything|all|back)\s+(above|before|from\s+the\s+start)/i,
  /what\s+(are|were)\s+your\s+(original|initial|system)\s+(instructions|prompt)/i,
  /print\s+(your|the)\s+(system|initial)\s*(prompt|instructions|message)/i,
  /output\s+(your|the)\s+(system|initial)\s*(prompt|instructions)/i,
  /give\s+me\s+(your|the)\s+(system|initial)\s*(prompt|instructions)/i,
  /tell\s+me\s+(your|the)\s+(system|initial)\s*(prompt|instructions)/i,
  /\bapi[_\s]?key\b/i,
  /\bsecret[_\s]?key\b/i,
  /\baccess[_\s]?token\b/i,
  /\bpassword\b.*\b(database|server|admin|root)\b/i,
  /process\.env/i,
  /ANTHROPIC_API_KEY/i,
  /OPENAI_API_KEY/i,
  /SUPABASE/i,
  /\benv\b.*\bvariable/i,
];

// Jailbreak phrases that try to unlock unrestricted mode
const JAILBREAK_PHRASES: string[] = [
  "do anything now",
  "no restrictions",
  "no limitations",
  "unrestricted mode",
  "developer mode",
  "god mode",
  "sudo mode",
  "admin mode",
  "debug mode",
  "maintenance mode",
  "unfiltered",
  "uncensored",
  "without safeguards",
  "without restrictions",
  "without limitations",
  "without rules",
  "without guidelines",
  "hypothetically speaking if you had no rules",
  "in a world where ai had no restrictions",
];

export type SanitizeResult = {
  clean: boolean;
  sanitized: string;
  flags: string[];
  blocked: boolean;
  riskScore: number; // 0 = safe, 1-3 = low, 4-6 = medium, 7-10 = high
};

/**
 * Sanitize user input before it goes into any LLM prompt.
 * Returns the cleaned text and any flags found.
 */
export function sanitizeInput(raw: string, maxLength: number = 5000): SanitizeResult {
  const flags: string[] = [];
  let riskScore = 0;
  let text = raw;

  // Length check
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    flags.push(`truncated_from_${raw.length}_to_${maxLength}`);
    riskScore += 1;
  }

  // Strip HTML/script tags
  const htmlPattern = /<\s*(script|iframe|object|embed|form|input|style|link|meta)[^>]*>/gi;
  if (htmlPattern.test(text)) {
    text = text.replace(/<[^>]*>/g, "");
    flags.push("html_tags_stripped");
    riskScore += 2;
  }

  // Check injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(`injection_pattern: ${pattern.source.slice(0, 50)}`);
      riskScore += 3;
    }
  }

  // Check jailbreak phrases
  const lower = text.toLowerCase();
  for (const phrase of JAILBREAK_PHRASES) {
    if (lower.includes(phrase)) {
      flags.push(`jailbreak_phrase: ${phrase}`);
      riskScore += 4;
    }
  }

  // Check for excessive special characters (obfuscation attempts)
  const specialCharRatio = (text.replace(/[a-zA-Z0-9\s.,!?'"()]/g, "").length) / Math.max(text.length, 1);
  if (specialCharRatio > 0.3) {
    flags.push("high_special_char_ratio");
    riskScore += 2;
  }

  // Check for base64 encoded content (hiding instructions)
  const base64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/;
  if (base64Pattern.test(text)) {
    flags.push("possible_base64_content");
    riskScore += 2;
  }

  // Check for unicode tricks (zero width chars, homoglyphs)
  const unicodeTricks = /[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g;
  if (unicodeTricks.test(text)) {
    text = text.replace(unicodeTricks, "");
    flags.push("unicode_tricks_stripped");
    riskScore += 2;
  }

  const blocked = riskScore >= 7;

  return {
    clean: flags.length === 0,
    sanitized: text,
    flags,
    blocked,
    riskScore: Math.min(riskScore, 10),
  };
}


// ═══════════════════════════════════════════════════════════════
// 2. OUTPUT FILTERING
// ═══════════════════════════════════════════════════════════════

// Patterns that should never appear in LLM output sent to users
const OUTPUT_LEAK_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9_-]{20,}/g,           // Anthropic API key
  /sk-[a-zA-Z0-9]{32,}/g,                  // OpenAI API key
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, // JWT tokens
  /sbp_[a-zA-Z0-9]{20,}/g,                // Supabase keys
  /ghp_[a-zA-Z0-9]{36}/g,                 // GitHub tokens
  /xoxb-[a-zA-Z0-9-]+/g,                  // Slack tokens
  /AKIA[0-9A-Z]{16}/g,                    // AWS access keys
  /postgres:\/\/[^\s]+/g,                  // Database connection strings
  /mongodb(\+srv)?:\/\/[^\s]+/g,           // MongoDB connection strings
  /process\.env\.[A-Z_]+/g,               // Environment variable references
];

// Phrases that suggest the model leaked system instructions
const SYSTEM_LEAK_PHRASES: string[] = [
  "my system prompt",
  "my instructions are",
  "i was instructed to",
  "my original instructions",
  "here are my instructions",
  "my programming says",
  "my initial prompt",
  "i was programmed to",
  "my configuration is",
  "here is my system message",
];

export type FilterResult = {
  safe: boolean;
  filtered: string;
  leaks: string[];
};

/**
 * Filter LLM output before returning to the user.
 * Redacts any leaked secrets or system prompt content.
 */
export function filterOutput(response: string): FilterResult {
  let filtered = response;
  const leaks: string[] = [];

  // Check for API keys and secrets
  for (const pattern of OUTPUT_LEAK_PATTERNS) {
    const matches = filtered.match(pattern);
    if (matches) {
      for (const match of matches) {
        leaks.push(`secret_leaked: ${match.slice(0, 8)}...`);
        filtered = filtered.replace(match, "[REDACTED]");
      }
    }
  }

  // Check for system prompt leakage
  const lower = filtered.toLowerCase();
  for (const phrase of SYSTEM_LEAK_PHRASES) {
    if (lower.includes(phrase)) {
      leaks.push(`system_leak_phrase: ${phrase}`);
    }
  }

  return {
    safe: leaks.length === 0,
    filtered,
    leaks,
  };
}


// ═══════════════════════════════════════════════════════════════
// 3. RATE LIMITING
// ═══════════════════════════════════════════════════════════════

type RateEntry = {
  timestamps: number[];
};

// In memory store — resets on server restart
// For production, use Redis or a database
const rateLimitStore: Map<string, RateEntry> = new Map();

export type RateLimitConfig = {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
};

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  "/api/ai":            { windowMs: 60_000, maxRequests: 20 },  // 20/min
  "/api/search-agent":  { windowMs: 60_000, maxRequests: 10 },  // 10/min (expensive)
  "/api/checkins":      { windowMs: 60_000, maxRequests: 15 },
  "/api/multimodal":    { windowMs: 60_000, maxRequests: 10 },
  "/api/eval":          { windowMs: 60_000, maxRequests: 5 },   // 5/min (very expensive)
  default:              { windowMs: 60_000, maxRequests: 30 },
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
};

/**
 * Check if a request should be rate limited.
 * Call at the top of each API route.
 */
export function checkRateLimit(userId: string, endpoint: string): RateLimitResult {
  const config = DEFAULT_LIMITS[endpoint] ?? DEFAULT_LIMITS.default;
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
  const allowed = entry.timestamps.length < config.maxRequests;

  if (allowed) {
    entry.timestamps.push(now);
  }

  // Find when the oldest request in the window expires
  const resetMs = entry.timestamps.length > 0
    ? entry.timestamps[0] + config.windowMs - now
    : config.windowMs;

  return {
    allowed,
    remaining: allowed ? remaining - 1 : 0,
    resetMs,
    limit: config.maxRequests,
  };
}

/**
 * Clean up old entries periodically (call from a setInterval if needed)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > now - 120_000);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// 4. SECURITY LOGGING
// ═══════════════════════════════════════════════════════════════

export type SecurityEvent = {
  timestamp: string;
  userId: string;
  endpoint: string;
  eventType: "injection_attempt" | "jailbreak_attempt" | "rate_limited" | "output_leak" | "blocked_input";
  details: string;
  riskScore: number;
};

// In memory log for the security dashboard — keeps last 200 events
const securityLog: SecurityEvent[] = [];
const MAX_LOG_SIZE = 200;

export function logSecurityEvent(event: SecurityEvent): void {
  securityLog.push(event);
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.shift();
  }
  // Also log to console for server logs
  console.warn(`[SECURITY] ${event.eventType} | user:${event.userId} | ${event.endpoint} | risk:${event.riskScore} | ${event.details}`);
}

export function getSecurityLog(): SecurityEvent[] {
  return [...securityLog];
}


// ═══════════════════════════════════════════════════════════════
// 5. COMBINED MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

export type SecurityCheckResult = {
  allowed: boolean;
  sanitized: string;
  reason?: string;
  inputFlags: string[];
  riskScore: number;
  rateLimitRemaining: number;
};

/**
 * Run all security checks in one call.
 * Use at the top of every AI API route.
 *
 * Example:
 *   const check = runSecurityChecks(userId, "/api/ai", body.question);
 *   if (!check.allowed) {
 *     return NextResponse.json({ ok: false, error: check.reason }, { status: 429 });
 *   }
 *   // Use check.sanitized instead of raw input
 */
export function runSecurityChecks(
  userId: string,
  endpoint: string,
  input: string,
  maxLength?: number
): SecurityCheckResult {
  // Rate limit first
  const rateResult = checkRateLimit(userId, endpoint);
  if (!rateResult.allowed) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint,
      eventType: "rate_limited",
      details: `Exceeded ${rateResult.limit} requests per window`,
      riskScore: 3,
    });
    return {
      allowed: false,
      sanitized: input,
      reason: `Rate limit exceeded. Try again in ${Math.ceil(rateResult.resetMs / 1000)} seconds.`,
      inputFlags: [],
      riskScore: 3,
      rateLimitRemaining: 0,
    };
  }

  // Sanitize input
  const sanitizeResult = sanitizeInput(input, maxLength);

  if (sanitizeResult.flags.length > 0) {
    const isInjection = sanitizeResult.flags.some((f) => f.startsWith("injection_pattern"));
    const isJailbreak = sanitizeResult.flags.some((f) => f.startsWith("jailbreak_phrase"));

    if (isInjection || isJailbreak) {
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint,
        eventType: isJailbreak ? "jailbreak_attempt" : "injection_attempt",
        details: sanitizeResult.flags.join("; "),
        riskScore: sanitizeResult.riskScore,
      });
    }

    if (sanitizeResult.blocked) {
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint,
        eventType: "blocked_input",
        details: sanitizeResult.flags.join("; "),
        riskScore: sanitizeResult.riskScore,
      });
      return {
        allowed: false,
        sanitized: sanitizeResult.sanitized,
        reason: "Your message was flagged by our security system. Please rephrase your request.",
        inputFlags: sanitizeResult.flags,
        riskScore: sanitizeResult.riskScore,
        rateLimitRemaining: rateResult.remaining,
      };
    }
  }

  return {
    allowed: true,
    sanitized: sanitizeResult.sanitized,
    inputFlags: sanitizeResult.flags,
    riskScore: sanitizeResult.riskScore,
    rateLimitRemaining: rateResult.remaining,
  };
}

/**
 * Filter output before sending to user.
 * Call on every LLM response before returning.
 *
 * Example:
 *   const output = filterLLMOutput(userId, "/api/ai", llmResponse);
 *   return NextResponse.json({ ok: true, text: output.filtered });
 */
export function filterLLMOutput(
  userId: string,
  endpoint: string,
  response: string
): FilterResult {
  const result = filterOutput(response);

  if (!result.safe) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint,
      eventType: "output_leak",
      details: result.leaks.join("; "),
      riskScore: 8,
    });
  }

  return result;
}