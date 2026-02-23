import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase-server";

type Provider = "openai" | "anthropic" | "hf";

type Feature =
  | "profile_enhance"
  | "profile_missing"
  | "match_explain"
  | "opener"
  | "chat_summary"
  | "chat_suggest"
  | "chat_agenda";

function promptFor(feature: Feature, ctx: any) {
  switch (feature) {
    case "profile_enhance":
      return `Rewrite this founder profile to be clearer, more specific, and attractive for cofounder matching.
Return:
1) Improved Bio (short, 2-4 sentences)
2) Bullet points: Skills, Stage, Availability, Ask
3) 3 specific edits they should make

Profile:
${JSON.stringify(ctx.me, null, 2)}`;

    case "profile_missing":
      return `You are a cofounder profile coach.
Given the profile, list:
- Missing details that hurt matching (max 8 bullets)
- Suggested text for each missing part
- A better short tagline (one-liner)

Profile:
${JSON.stringify(ctx.me, null, 2)}`;

    case "match_explain":
      return `Explain why these two founders may match.
Return:
- 3 reasons they match
- 3 risks/misalignments
- 5 questions they should ask each other
- Suggested roles split (who does what) in 4 bullets

My profile:
${JSON.stringify(ctx.me, null, 2)}

Other profile:
${JSON.stringify(ctx.other, null, 2)}`;

    case "opener":
      return `Write 3 first messages (icebreakers) from me to them.
Style: short, friendly, specific, mention 1 detail from their profile.
Return exactly 3 options.

Me:
${JSON.stringify(ctx.me, null, 2)}

Them:
${JSON.stringify(ctx.other, null, 2)}`;

    case "chat_summary":
      return `Summarize this cofounder chat.
Return:
- Summary (5 bullets)
- Decisions made
- Open questions
- Suggested next step (one sentence)

Transcript:
${ctx.transcript}`;

    case "chat_suggest":
      return `You are a cofounder conversation coach.
Given this chat transcript, produce:
- 5 missing topics to cover
- Suggested next message (1-2 short paragraphs, actionable, friendly)

Transcript:
${ctx.transcript}`;

    case "chat_agenda":
      return `Create a 15-minute call agenda based on this chat.
Return:
- Agenda with timestamps (0:00–15:00)
- 6 questions to ask
- 3 red flags to watch for

Transcript:
${ctx.transcript}`;

    default:
      return `Answer briefly: ${ctx.question ?? ""}`;
  }
}

async function callOpenAI(model: string, prompt: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.responses.create({ model, input: prompt });
  // @ts-ignore
  return res.output_text ?? "";
}

async function callAnthropic(model: string, prompt: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  });
  const text =
    (msg.content || [])
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("") || "";
  return text;
}

async function callHF(model: string, prompt: string) {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 350, return_full_text: false },
    }),
  });
  const json = await r.json();
  if (Array.isArray(json) && json[0]?.generated_text) return json[0].generated_text;
  if (json?.generated_text) return json.generated_text;
  return JSON.stringify(json);
}

async function buildContext(feature: Feature, userId: string, body: any) {
  const supabase = await supabaseServer();

  // Load my profile always
  const { data: me } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (feature === "profile_enhance" || feature === "profile_missing") {
    return { me };
  }

  if (feature === "match_explain" || feature === "opener") {
    const candidateId = body.candidateId as string;
    if (!candidateId) throw new Error("candidateId missing");
    const { data: other } = await supabase.from("profiles").select("*").eq("id", candidateId).maybeSingle();
    return { me, other };
  }

  // Chat features require matchId + membership
  if (feature === "chat_summary" || feature === "chat_suggest" || feature === "chat_agenda") {
    const matchId = body.matchId as string;
    if (!matchId) throw new Error("matchId missing");

    const { data: matchRow, error: mErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status")
      .eq("id", matchId)
      .maybeSingle();

    if (mErr) throw new Error("Match lookup failed (RLS).");
    if (!matchRow) throw new Error("Match not found.");
    if (matchRow.status !== "accepted") throw new Error("Chat is only available after accepted.");
    if (matchRow.user_id !== userId && matchRow.candidate_id !== userId) throw new Error("Not your match.");

    const otherId = matchRow.user_id === userId ? matchRow.candidate_id : matchRow.user_id;

    const { data: chatRow } = await supabase
      .from("chats")
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle();

    if (!chatRow?.id) throw new Error("Chat row missing for this match.");

    const limit = Math.min(Math.max(Number(body.messagesLimit ?? 25), 5), 50);

    const { data: msgs } = await supabase
      .from("messages")
      .select("sender_id,body,created_at")
      .eq("chat_id", chatRow.id)
      .order("created_at", { ascending: true })
      .limit(limit);

    const transcript =
      (msgs ?? [])
        .map((m) => `${m.sender_id === userId ? "Me" : "Them"}: ${m.body}`)
        .join("\n") || "(no messages)";

    return { me, otherId, transcript };
  }

  return { me };
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json();

    const provider = (body.provider as Provider) || "openai";
    const model = (body.model as string) || "gpt-4o-mini";
    const feature = (body.feature as Feature) || "profile_enhance";

    const ctx = await buildContext(feature, user.id, body);
    const prompt = promptFor(feature, ctx);

    let output_text = "";
    if (provider === "openai") output_text = await callOpenAI(model, prompt);
    else if (provider === "anthropic") output_text = await callAnthropic(model, prompt);
    else output_text = await callHF(model, prompt);

    return NextResponse.json({ ok: true, output_text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
