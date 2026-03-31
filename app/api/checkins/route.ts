import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* server component */ }
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await makeSupabase();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, type } = body as { prompt: string; type: "weekly_summary" | "agreement_summary" };

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content ?? [])
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("");

    return NextResponse.json({ ok: true, text, type });
  } catch (e: any) {
    console.error("Checkins AI error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "AI call failed" }, { status: 500 });
  }
}