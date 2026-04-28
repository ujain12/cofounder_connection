import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const pathname = req.nextUrl.pathname;

  // Public routes
  const publicRoutes = ["/", "/auth/callback", "/auth/verify-email"];
  const isPublic = publicRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (isPublic || pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return res;
  }

  // No session → login
  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Email not confirmed
  if (!session.user?.email_confirmed_at) {
    if (pathname !== "/auth/verify-email") {
      const verifyUrl = new URL("/auth/verify-email", req.url);
      verifyUrl.searchParams.set("email", session.user?.email || "");
      return NextResponse.redirect(verifyUrl);
    }
    return res;
  }

  // Pages allowed while pending
  const pendingAllowed = ["/onboarding", "/pending", "/admin"];
  const isAllowedWhilePending = pendingAllowed.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", session.user.id)
    .maybeSingle();

  // No profile → onboarding
  if (!profile) {
    if (pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return res;
  }

  // Pending or rejected → pending page
  if (profile.status !== "approved") {
    if (!isAllowedWhilePending) {
      return NextResponse.redirect(new URL("/pending", req.url));
    }
    return res;
  }

  // Approved user on onboarding/pending → home
  if (profile.status === "approved" && (pathname === "/onboarding" || pathname === "/pending")) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};