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
};

function safeJson(obj: unknown, maxChars = 12000) {
  const s = JSON.stringify(obj, null, 2);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n...(truncated)";
}

function buildPrompt(task: Task, profile: ProfilePayload) {
  const profileBlock = safeJson(profile);

  if (task === "rewrite_profile") {
    return `
You are helping a founder improve their cofounder-matching profile.

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
}
`;
  }

  if (task === "profile_missing") {
    return `
You are reviewing a founder profile for missing or weak areas.

Use the CURRENT PROFILE below as the source of truth.
Do not invent random details.
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
}
`;
  }

  return `
You are the Cofounder Connection assistant.
Answer helpfully and briefly.
`;
}

async function callOpenAI(model: string, prompt: string) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const res = await client.responses.create({
    model,
    input: prompt,
  });

  return { text: res.output_text ?? "" };
}

async function callAnthropic(model: string, prompt: string) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const msg = await client.messages.create({
    model,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    (msg.content || [])
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
      parameters: {
        max_new_tokens: 600,
        return_full_text: false,
      },
    }),
  });

  const json = await r.json();

  let text = "";
  if (Array.isArray(json) && json[0]?.generated_text) {
    text = json[0].generated_text;
  } else if (typeof json === "object" && json?.generated_text) {
    text = json.generated_text;
  } else {
    text = JSON.stringify(json);
  }

  return { text };
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const provider = (body.provider as Provider) || "openai";
    const model = (body.model as string) || "gpt-4o-mini";

    const task = (body.task ||
      (body.feature === "enhance" ? "rewrite_profile" : null) ||
      (body.feature === "missing" ? "profile_missing" : null) ||
      "rewrite_profile") as Task;

    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
    }

    const user = userData.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
    }

    let profile: ProfilePayload = body.payload ?? {};

    if (
      !profile ||
      Object.keys(profile).length === 0 ||
      (!profile.bio && !profile.goals && !profile.stage)
    ) {
      const { data: dbProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name,bio,timezone,hours_per_week,stage,goals")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        return NextResponse.json(
          { ok: false, error: profileErr.message },
          { status: 500 }
        );
      }

      profile = dbProfile ?? {};
    }

    const prompt = buildPrompt(task, profile);

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

    return NextResponse.json({
      ok: true,
      output_text,
      parsed,
      profile_used: profile,
      task,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}