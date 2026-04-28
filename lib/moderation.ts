import { SupabaseClient } from "@supabase/supabase-js";

// ── Individual bad words (instant flag) ──────────────────
const BAD_WORDS_HIGH: string[] = [
  "fuck", "f*ck", "fck", "fuck", "fuk",
  "shit", "sh*t", "sht",
  "bitch", "b*tch", "btch",
  "ass", "asshole", "a**hole",
  "dick", "d*ck",
  "pussy", "p*ssy",
  "whore", "slut", "hoe",
  "cunt", "c*nt",
  "retard", "retarded",
  "faggot", "fag",
  "nigger", "nigga", "n*gger", "n*gga",
];

const BAD_WORDS_MEDIUM: string[] = [
  "sexy", "hot", "nude", "nudes", "naked",
  "porn", "xxx", "onlyfans",
  "idiot", "stupid", "dumb", "loser", "pathetic",
  "creep", "creepy", "weirdo",
];

// ── Phrase patterns (contextual) ─────────────────────────
const BAD_PATTERNS: { pattern: RegExp; severity: "high" | "critical"; reason: string }[] = [
  // Threats
  { pattern: /\b(kill|murder|shoot|stab|attack)\s+(you|her|him|them)\b/i, severity: "critical", reason: "Violent threat detected" },
  { pattern: /\bi('ll|m going to)\s+(hurt|harm|destroy)\b/i, severity: "critical", reason: "Threat of harm detected" },
  // Stalking
  { pattern: /\b(stalk|follow\s+you\s+home|find\s+where\s+you\s+live)\b/i, severity: "critical", reason: "Stalking language detected" },
  // Sexual harassment
  { pattern: /\b(send\s+(me\s+)?(nudes|pics|photos|videos))\b/i, severity: "high", reason: "Sexual harassment detected" },
  { pattern: /\b(naked\s+(pics|photos|videos|images))\b/i, severity: "high", reason: "Sexual content request" },
  { pattern: /\b(wanna\s+(hook\s*up|smash|bang|sleep\s+with))\b/i, severity: "high", reason: "Sexual harassment detected" },
  // Phishing
  { pattern: /\b(give\s+me\s+(your\s+)?(password|login|credentials|ssn|social|credit\s+card))\b/i, severity: "critical", reason: "Credential phishing detected" },
  // Scam
  { pattern: /\b(guaranteed\s+returns|double\s+your\s+money|wire\s+transfer|bitcoin\s+invest)\b/i, severity: "high", reason: "Scam detected" },
  // Pressure
  { pattern: /\b(don'?t\s+tell\s+anyone|keep\s+this\s+(a\s+)?secret|between\s+us)\b/i, severity: "high", reason: "Secretive pressure detected" },
];

const AUTO_BAN_THRESHOLD = 3;

export type ModerationResult = {
  flagged: boolean;
  severity: "low" | "medium" | "high" | "critical" | null;
  reason: string | null;
  blocked: boolean;
};

/**
 * Scan a message for bad content.
 */
export function scanMessage(text: string): ModerationResult {
  if (!text || typeof text !== "string") {
    return { flagged: false, severity: null, reason: null, blocked: false };
  }

  const cleaned = text.trim().toLowerCase();
  if (cleaned.length === 0) {
    return { flagged: false, severity: null, reason: null, blocked: false };
  }

  // Check phrase patterns first (most severe)
  for (const rule of BAD_PATTERNS) {
    if (rule.pattern.test(cleaned)) {
      return {
        flagged: true,
        severity: rule.severity,
        reason: rule.reason,
        blocked: true,
      };
    }
  }

  // Check individual high-severity bad words
  for (const word of BAD_WORDS_HIGH) {
    // Match whole word or word with common suffixes
    const regex = new RegExp(`\\b${word.replace(/\*/g, "\\*")}(s|ed|ing|er|ers)?\\b`, "i");
    if (regex.test(cleaned)) {
      return {
        flagged: true,
        severity: "high",
        reason: `Profanity detected: inappropriate language`,
        blocked: true,
      };
    }
  }

  // Check medium-severity words
  for (const word of BAD_WORDS_MEDIUM) {
    const regex = new RegExp(`\\b${word.replace(/\*/g, "\\*")}(s|ed|ing|er|ers)?\\b`, "i");
    if (regex.test(cleaned)) {
      return {
        flagged: true,
        severity: "medium",
        reason: `Inappropriate content detected`,
        blocked: true,
      };
    }
  }

  return { flagged: false, severity: null, reason: null, blocked: false };
}

/**
 * Record a flag and auto-ban if threshold reached.
 */
export async function recordFlag(
  supabase: SupabaseClient,
  {
    flaggedUserId,
    reporterId,
    messageId,
    reason,
    severity,
    autoDetected = false,
  }: {
    flaggedUserId: string;
    reporterId?: string;
    messageId?: string;
    reason: string;
    severity: "low" | "medium" | "high" | "critical";
    autoDetected?: boolean;
  }
) {
  // Insert the flag
  await supabase.from("content_flags").insert({
    flagged_user_id: flaggedUserId,
    reporter_id: reporterId || null,
    message_id: messageId || null,
    reason,
    severity,
    auto_detected: autoDetected,
  });

  // Increment flag count
  const { data: profile } = await supabase
    .from("profiles")
    .select("flag_count")
    .eq("id", flaggedUserId)
    .maybeSingle();

  const newCount = (profile?.flag_count || 0) + 1;

  // Auto-ban check
  const shouldBan =
    newCount >= AUTO_BAN_THRESHOLD ||
    severity === "critical";

  const updateData: any = { flag_count: newCount };
  if (shouldBan) {
    updateData.is_banned = true;
    updateData.banned_reason = `Auto-banned: ${reason} (${newCount} flags)`;
    updateData.status = "rejected";
  }

  await supabase.from("profiles").update(updateData).eq("id", flaggedUserId);

  return { flagCount: newCount, banned: shouldBan };
}