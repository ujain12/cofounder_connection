import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { recordFlag } from "@/lib/moderation";
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

  // Rate limit reports to prevent spam-reporting
  const limit = checkRateLimit(user.id, "auth");
  if (!limit.allowed) return rateLimitResponse(limit.resetIn);

  const body = await req.json();
  const flaggedUserId = body.userId;
  const reason = sanitizeInput(body.reason || "");

  if (!flaggedUserId || !reason) {
    return secureJson({ error: "userId and reason are required." }, 400);
  }

  // Can't report yourself
  if (flaggedUserId === user.id) {
    return secureJson({ error: "You cannot report yourself." }, 400);
  }

  const result = await recordFlag(supabase, {
    flaggedUserId,
    reporterId: user.id,
    reason,
    severity: "medium",
    autoDetected: false,
  });

  return secureJson({
    ok: true,
    message: "Report submitted. Our team will review this.",
  });
}
