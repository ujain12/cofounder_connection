import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
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
    const { prompt, type } = body as { prompt: string; type: string };

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing from .env.local");
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY not set in .env.local" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.choices[0]?.message?.content ?? "";

    return NextResponse.json({ ok: true, text, type });

  } catch (e: any) {
    console.error("checkins-ai error:", e?.message, e?.status);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "AI call failed" },
      { status: 500 }
    );
  }
}