import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { scanMessage, recordFlag } from "@/lib/moderation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { secureJson, sanitizeInput } from "@/lib/api-security";

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return secureJson({ error: "Unauthorized" }, 401);

  // Rate limit
  const limit = checkRateLimit(user.id, "chat");
  if (!limit.allowed) return rateLimitResponse(limit.resetIn);

  // Check if banned
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_banned) {
    return secureJson({ error: "Your account has been suspended for violating community guidelines." }, 403);
  }

  // Parse input
  const body = await req.json();
  const message = sanitizeInput(body.body || "");
  const chatId = body.chat_id;

  if (!message || !chatId) {
    return secureJson({ error: "Message and chat_id are required." }, 400);
  }

  // Scan message for bad content
  const modResult = scanMessage(message);

  if (modResult.flagged) {
    await recordFlag(supabase, {
      flaggedUserId: user.id,
      reason: modResult.reason || "Flagged content",
      severity: modResult.severity || "low",
      autoDetected: true,
    });

    if (modResult.blocked) {
      return secureJson({
        error: "This message was blocked. Inappropriate content is not allowed. Continued violations will result in account suspension.",
        flagged: true,
      }, 400);
    }
  }

  // Insert message
  const { data: msg, error: insertError } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      sender_id: user.id,
      body: message,
    })
    .select()
    .single();

  if (insertError) {
    return secureJson({ error: "Failed to send message." }, 500);
  }

  return secureJson({
    ok: true,
    message: msg,
    warning: modResult.flagged ? "Your message has been flagged for review." : undefined,
  });
}