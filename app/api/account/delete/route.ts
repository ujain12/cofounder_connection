import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE() {
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
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = user.id;

  // Delete all user data from database tables (order matters)
  await supabase.from("messages").delete().eq("sender_id", userId);
  await supabase.from("chats").delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
  await supabase.from("profile_tags").delete().eq("user_id", userId);
  await supabase.from("matches").delete().or(`user_id.eq.${userId},candidate_id.eq.${userId}`);
  await supabase.from("checkins").delete().eq("user_id", userId);
  await supabase.from("profiles").delete().eq("id", userId);

  // Delete avatar from storage
  const { data: avatarFiles } = await supabase.storage.from("avatars").list(userId);
  if (avatarFiles && avatarFiles.length > 0) {
    const filePaths = avatarFiles.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from("avatars").remove(filePaths);
  }

  // Delete the auth user (requires service role key)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete auth account: " + deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}