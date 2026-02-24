import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // Build the base URL dynamically (works locally and on deployment)
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const baseUrl = `${proto}://${host}`;

    // This request forces tool usage
    const r = await fetch(`${baseUrl}/api/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        // IMPORTANT:
        // Forward cookies so Supabase auth works (tool get_my_profile needs login)
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o-mini",
        task: "chatbot",
        enableTools: true,
        debug: true,

        // You can keep this false; tool will fetch profile
        useAppContext: false,

        payload: {
          question:
            "Before answering, call get_my_profile with select 'id,full_name,bio,stage,goals,hours_per_week' and then summarize my profile."
        }
      }),
    });

    const json = await r.json();
    return NextResponse.json({
      ok: true,
      demo: true,
      ...json,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}