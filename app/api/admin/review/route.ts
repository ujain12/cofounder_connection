import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendEmail, approvedEmail, rejectedEmail, bannedEmail } from "@/lib/email";

const ADMIN_EMAILS = [
  "utkarshj1107@gmail.com",
  "ujain@charlotte.edu",
];

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email?.toLowerCase() || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, action } = body;

  if (!userId || !["approved", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user's profile and email
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, is_banned")
    .eq("id", userId)
    .maybeSingle();

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;
  const userName = profile?.full_name || "there";

  // Update status
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ status: action })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email notification
  if (userEmail) {
    if (action === "approved") {
      const email = approvedEmail(userName);
      email.to = userEmail;
      await sendEmail(email);
    } else if (action === "rejected") {
      // Check if this is a ban (is_banned flag) or just a rejection
      if (profile?.is_banned) {
        const email = bannedEmail(userName);
        email.to = userEmail;
        await sendEmail(email);
      } else {
        const email = rejectedEmail(userName);
        email.to = userEmail;
        await sendEmail(email);
      }
    }
  }

  return NextResponse.json({ success: true, status: action });
}