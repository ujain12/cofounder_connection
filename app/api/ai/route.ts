import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase-server";

type Provider = "openai" | "anthropic" | "hf";
type Task =
  | "chatbot"
  | "rewrite_profile"
  | "profile_missing"
  | "match_explain"
  | "opener"
  | "coach";

type Payload = {
  question?: string;
  bio?: string;
  full_name?: string;
  timezone?: string;
  hours_per_week?: number | null;
  stage?: string;
  goals?: string;
  me?: any;
  other?: any;
  transcript?: string;
};

function safeJson(obj: unknown, maxChars = 8000) {
  const s = JSON.stringify(obj, null, 2);
  return s.length <= maxChars ? s : s.slice(0, maxChars) + "\n...(truncated)";
}

function buildPrompt(task: Task, payload: Payload): string {
  if (task === "chatbot") {
    const q = (payload.question ?? "").trim();
    return `You are the Cofounder Connection AI — an expert on startups, cofounder relationships, equity splits, product strategy, and early-stage company building.

Answer the following question in a helpful, specific, and direct way. Use bullet points or numbered lists where useful. Be practical and actionable.

QUESTION:
${q || "Tell me something useful about finding a cofounder."}`;
  }

  if (task === "rewrite_profile") {
    return `You are helping a founder improve their cofounder-matching profile. Only improve what exists — do not invent details.

CURRENT PROFILE:
${safeJson(payload)}

Return ONLY valid JSON:
{
  "bio": "improved bio",
  "goals": "improved goals",
  "stage": "improved stage",
  "timezone": "timezone",
  "hours_per_week": 10,
  "summary": ["note 1", "note 2", "note 3"]
}`;
  }

  if (task === "profile_missing") {
    return `You are reviewing a founder profile for weak or missing areas.

CURRENT PROFILE:
${safeJson(payload)}

Return ONLY valid JSON:
{
  "missing": [{"field": "bio", "reason": "why weak", "suggestion": "better text"}],
  "suggested_fields": {"bio": "...", "goals": "...", "stage": "...", "timezone": "...", "hours_per_week": 10},
  "overall_feedback": ["feedback 1", "feedback 2", "feedback 3"]
}`;
  }

  if (task === "match_explain") {
    return `You are a cofounder matching expert.

Explain in 4-5 sentences why these two founders could be a strong match. Be specific about complementary skills, shared goals, and potential synergies. End with one honest challenge they should discuss early.

FOUNDER (YOU):
${safeJson(payload.me ?? {})}

POTENTIAL COFOUNDER:
${safeJson(payload.other ?? {})}`;
  }

  if (task === "opener") {
    return `You are a startup networking expert.

Write a short, warm, personalized connection message (3-4 sentences) from Founder A to Founder B. Reference something specific from their profile. End with a clear, low-pressure call to action.

FOUNDER A (you):
${safeJson(payload.me ?? {})}

FOUNDER B (recipient):
${safeJson(payload.other ?? {})}`;
  }

  if (task === "coach") {
    return `You are a startup communication coach reviewing a conversation between two potential cofounders.

Give 3 specific, actionable suggestions to help them communicate better, build trust, and make progress. Be direct and practical.

CONVERSATION TRANSCRIPT:
${payload.transcript || "(no messages yet — suggest how to start the conversation)"}`;
  }

  return `You are the Cofounder Connection AI assistant. Answer helpfully.\n\n${safeJson(payload)}`;
}

async function callOpenAI(model: string, prompt: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  return { text: res.choices[0]?.message?.content ?? "" };
}

async function callAnthropic(model: string, prompt: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (msg.content || [])
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("");
  return { text };
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
      parameters: { max_new_tokens: 600, return_full_text: false },
    }),
  });
  const json = await r.json();
  let text = "";
  if (Array.isArray(json) && json[0]?.generated_text) text = json[0].generated_text;
  else if (json?.generated_text) text = json.generated_text;
  else text = JSON.stringify(json);
  return { text };
}

function tryParseJson(raw: string) {
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const provider = (body.provider as Provider) || "openai";
    const model = (body.model as string) || "gpt-4o-mini";
    const task = (body.task as Task) || "chatbot";

    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData.user) {
      return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
    }

    const userId = userData.user.id;

    // Start with whatever payload the frontend sent
    let payload: Payload = { ...(body.payload ?? {}) };

    // For profile tasks — always load fresh from DB if fields are missing
    if (task === "rewrite_profile" || task === "profile_missing") {
      if (!payload.bio && !payload.goals && !payload.stage) {
        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("full_name,bio,timezone,hours_per_week,stage,goals")
          .eq("id", userId)
          .maybeSingle();
        payload = { ...payload, ...(dbProfile ?? {}) };
      }
    }

    const prompt = buildPrompt(task, payload);

    let output_text = "";
    if (provider === "openai") {
      output_text = (await callOpenAI(model, prompt)).text;
    } else if (provider === "anthropic") {
      output_text = (await callAnthropic(model, prompt)).text;
    } else if (provider === "hf") {
      output_text = (await callHF(model, prompt)).text;
    } else {
      return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
    }

    const parsed = tryParseJson(output_text);

    return NextResponse.json({ ok: true, output_text, parsed, task });
  } catch (e: any) {
    console.error("AI route error:", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}