import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Check if the user has credits to use AI features.
 * Returns the user and balance if allowed, or an error Response if not.
 *
 * Usage in any AI API route:
 *
 *   const gate = await requireCredits();
 *   if (gate.error) return gate.error;
 *   // gate.user and gate.balance are available
 */
export async function requireCredits(
  minimumCredits: number = 0.001
): Promise<
  | { user: { id: string; email: string }; balance: number; error: null }
  | { user: null; balance: 0; error: Response }
> {
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

  // Check auth
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null, balance: 0,
      error: new Response(
        JSON.stringify({ error: "Please sign in to use this feature." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Check credits
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance, status, is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_banned) {
    return {
      user: null, balance: 0,
      error: new Response(
        JSON.stringify({ error: "Your account has been suspended." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  if (profile?.status !== "approved") {
    return {
      user: null, balance: 0,
      error: new Response(
        JSON.stringify({ error: "Your account is not yet approved." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const balance = Number(profile?.credits_balance || 0);

  if (balance < minimumCredits) {
    return {
      user: null, balance: 0,
      error: new Response(
        JSON.stringify({
          error: "You need credits to use this feature. Add credits in the Billing section to unlock AI-powered tools.",
          needsCredits: true,
          balance: 0,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email || "" },
    balance,
    error: null,
  };
}