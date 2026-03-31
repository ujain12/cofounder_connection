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

type ProfilePayload = {
  full_name?: string;
  bio?: string;
  timezone?: string;
  hours_per_week?: number | null;
  stage?: string;
  goals?: string;
  question?: string;
  me?: any;
  other?: any;
  transcript?: string;
};

function safeJson(obj: unknown, maxChars = 12000) {
  const s = JSON.stringify(obj, null, 2);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n...(truncated)";
}

function buildPrompt(task: Task, payload: ProfilePayload) {
  // ── CHATBOT ──────────────────────────────────────────────────────────────
  if (task === "chatbot") {
    const q = payload.question ?? "";
    return `You are the Cofounder Connection AI assistant — an expert on startups, cofounder relationships, equity, product, and early-stage company building.

Answer the following question in a helpful, direct, and specific way. Use numbered lists or bullet points where appropriate.

QUESTION: ${q}`;
  }

  // ── REWRITE PROFILE ───────────────────────────────────────────────────────
  if (task === "rewrite_profile") {
    const profileBlock = safeJson(payload);
    return `You are helping a founder improve their cofounder-matching profile.

Use the CURRENT PROFILE below as the source of truth.
Do not invent random background details.
Only improve clarity, specificity, and attractiveness for cofounder matching.
If a field is blank, suggest a strong but realistic version that fits the rest of the profile.

CURRENT PROFILE:
${profileBlock}

Return ONLY valid JSON in this exact shape:
{
  "bio": "improved bio text",
  "goals": "improved goals text",
  "stage": "improved startup stage text",
  "timezone": "improved timezone text or existing timezone",
  "hours_per_week": 10,
  "summary": [
    "short note 1",
    "short note 2",
    "short note 3"
  ]
}`;
  }

  // ── PROFILE MISSING ───────────────────────────────────────────────────────
  if (task === "profile_missing") {
    const profileBlock = safeJson(payload);
    return `You are reviewing a founder profile for missing or weak areas.

Use the CURRENT PROFILE below as the source of truth.
Identify what is missing, too vague, or weak for cofounder matching.
For each weak or missing field, suggest a better replacement.

CURRENT PROFILE:
${profileBlock}

Return ONLY valid JSON in this exact shape:
{
  "missing": [
    {
      "field": "bio",
      "reason": "why this is weak or missing",
      "suggestion": "better text for that field"
    }
  ],
  "suggested_fields": {
    "bio": "optional improved bio",
    "goals": "optional improved goals",
    "stage": "optional improved stage",
    "timezone": "optional improved timezone",
    "hours_per_week": 10
  },
  "overall_feedback": [
    "short feedback 1",
    "short feedback 2",
    "short feedback 3"
  ]
}`;
  }

  // ── MATCH EXPLAIN ─────────────────────────────────────────────────────────
  if (task === "match_explain") {
    return `You are a cofounder matching expert.

Explain in 3-5 sentences why these two founders could be a strong match. Be specific about complementary skills, shared goals, and potential synergies. End with one honest potential challenge they should discuss.

FOUNDER (YOU):
${safeJson(payload.me ?? {})}

POTENTIAL COFOUNDER:
${safeJson(payload.other ?? {})}`;
  }

  // ── OPENER ────────────────────────────────────────────────────────────────
  if (task === "opener") {
    return `You are a startup networking expert.

Write a short, warm, personalized connection message (3-4 sentences max) from Founder A to Founder B. Make it feel genuine — mention something specific from their profile. End with a clear call to action.

FOUNDER A (sender):
${safeJson(payload.me ?? {})}

FOUNDER B (recipient):
${safeJson(payload.other ?? {})}`;
  }

  // ── COACH ─────────────────────────────────────────────────────────────────
  if (task === "coach") {
    return `You are a startup communication coach.

Review this conversation transcript between two founders and give 3 specific, actionable suggestions on how they can communicate better, build trust faster, or make progress on their collaboration.

TRANSCRIPT:
${payload.transcript ?? "(no messages yet)"}`;
  }

  // ── FALLBACK ──────────────────────────────────────────────────────────────
  return `You are the Cofounder Connection AI assistant. Answer helpfully and briefly.\n\n${safeJson(payload)}`;
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
    .map((block: any) => (block.type === "text" ? block.text : ""))
    .join("") || "";
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
  else if (typeof json === "object" && json?.generated_text) text = json.generated_text;
  else text = JSON.stringify(json);
  return { text };
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
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

    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
    }
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
    }

    // Build payload — merge body.payload with any top-level fields
    let payload: ProfilePayload = {
      ...(body.payload ?? {}),
    };

    // For profile tasks with no payload, load from DB
    if (
      (task === "rewrite_profile" || task === "profile_missing") &&
      (!payload.bio && !payload.goals && !payload.stage)
    ) {
      const { data: dbProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name,bio,timezone,hours_per_week,stage,goals")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileErr) {
        return NextResponse.json({ ok: false, error: profileErr.message }, { status: 500 });
      }
      payload = { ...payload, ...(dbProfile ?? {}) };
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