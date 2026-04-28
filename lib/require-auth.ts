import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Verify that the current request has a valid, email-verified, APPROVED user.
 *
 *   const auth = await requireAuth();
 *   if (auth.error) return auth.error;
 *   const user = auth.user;
 */
export async function requireAuth(): Promise<
  | { user: { id: string; email: string }; error: null }
  | { user: null; error: Response }
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

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Unauthorized — please sign in." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  if (!user.email_confirmed_at) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Email not verified." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Check profile approval status
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "approved") {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Account not yet approved." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email || "" },
    error: null,
  };
}