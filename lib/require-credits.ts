import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const OWNER_EMAIL = "utkarshj1107@gmail.com";

/**
 * Check if the user has credits to use AI features.
 * Owner email can use AI APIs without credit limits.
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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      balance: 0,
      error: new Response(
        JSON.stringify({ error: "Please sign in to use this feature." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const email = (user.email || "").toLowerCase();

  if (email === OWNER_EMAIL) {
    return {
      user: { id: user.id, email },
      balance: Number.POSITIVE_INFINITY,
      error: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_balance, status, is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_banned) {
    return {
      user: null,
      balance: 0,
      error: new Response(
        JSON.stringify({ error: "Your account has been suspended." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  if (profile?.status !== "approved") {
    return {
      user: null,
      balance: 0,
      error: new Response(
        JSON.stringify({ error: "Your account is not yet approved." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const balance = Number(profile?.credits_balance || 0);

  if (balance < minimumCredits) {
    return {
      user: null,
      balance: 0,
      error: new Response(
        JSON.stringify({
          error:
            "AI features are currently under construction. This will use a consumption-based model where users add a credit card and pay only for the amount they use.",
          needsCredits: true,
          billingUnderConstruction: true,
          balance,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return {
    user: { id: user.id, email },
    balance,
    error: null,
  };
}