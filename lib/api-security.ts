/**
 * Security headers for API responses.
 * Apply these to every API route response.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // XSS protection
  "X-XSS-Protection": "1; mode=block",
  // Don't send referrer to external sites
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Prevent caching of sensitive responses
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

/**
 * Create a secure JSON response with all security headers.
 */
export function secureJson(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SECURITY_HEADERS,
    },
  });
}

/**
 * Validate that a request body doesn't contain suspicious content.
 * Blocks attempts to extract system prompts or inject malicious payloads.
 */
export function sanitizeInput(text: string): string {
  if (!text || typeof text !== "string") return "";

  // Remove null bytes
  let cleaned = text.replace(/\0/g, "");

  // Trim excessive whitespace
  cleaned = cleaned.trim();

  // Limit length (prevent megabyte payloads)
  if (cleaned.length > 10000) {
    cleaned = cleaned.slice(0, 10000);
  }

  return cleaned;
}

/**
 * Check if a prompt is trying to extract system instructions.
 * Returns true if the input looks like a prompt injection attack.
 */
export function isPromptInjection(text: string): boolean {
  if (!text) return false;

  const lower = text.toLowerCase();

  const injectionPatterns = [
    // System prompt extraction
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i,
    /what\s+(are|is)\s+(your|the)\s+system\s+(prompt|instructions|message)/i,
    /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions)/i,
    /show\s+me\s+(your|the)\s+(system|hidden)\s+(prompt|instructions|message)/i,
    /repeat\s+(your|the)\s+(system|initial)\s+(prompt|instructions|message)/i,
    /print\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
    /output\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
    /disregard\s+(all\s+)?(previous|prior)\s+(instructions|rules)/i,

    // Role hijacking
    /you\s+are\s+now\s+(a|an|the)\s+/i,
    /pretend\s+(you\s+are|to\s+be)\s+(a|an)\s+/i,
    /act\s+as\s+(if\s+you\s+are|a|an)\s+/i,
    /forget\s+(everything|all|your)\s+(you|previous|instructions)/i,
    /new\s+instructions?\s*:/i,

    // Developer mode tricks
    /developer\s+mode/i,
    /dan\s+mode/i,
    /jailbreak/i,
    /bypass\s+(your|the|all)\s+(restrictions|filters|rules|safety)/i,

    // API key extraction
    /what\s+(is|are)\s+(your|the)\s+api\s+key/i,
    /show\s+(me\s+)?(your|the)\s+api\s+key/i,
    /reveal\s+(your|the)\s+(secret|api)\s+key/i,
    /environment\s+variables/i,
    /process\.env/i,
    /\.env\s+file/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}
