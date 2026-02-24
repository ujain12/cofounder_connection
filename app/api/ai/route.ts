import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase-server";
import { asOpenAITools, runToolByName } from "@/lib/tools/runTool";

type Provider = "openai" | "anthropic" | "hf";
type Task = "chatbot" | "rewrite_profile" | "match_explain" | "opener" | "coach";

function safeJson(obj: any, maxChars = 12000) {
  const s = JSON.stringify(obj, null, 2);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n... (truncated)";
}

function buildPrompt(task: Task, payload: any, appContext: any) {
  const ctxBlock = appContext
    ? `\n\n=== APP_CONTEXT (source of truth) ===\n${safeJson(appContext)}\n=== END_CONTEXT ===\n`
    : "";

  const toolsHint = `
You have access to backend tools that fetch real app data from Supabase:
- get_my_profile(select)
- get_other_profile(userId, select)
- get_recent_messages(chatId, limit)

Rules:
- Use tools if you need real profile/chat data.
- If the user asks about THEIR profile, call get_my_profile first.
- If a tool fails, explain what went wrong and what input you need.
After tools return, continue and produce the final answer.
`;

  switch (task) {
    case "rewrite_profile":
      return `${toolsHint}
Rewrite this founder profile to be clearer and more specific for cofounder matching.

Return:
1) Improved Bio (short paragraph)
2) Bullet points: Skills, Stage, Availability, Ask

If profile info is missing, call get_my_profile.

Profile:
${safeJson(payload)}${ctxBlock}`;

    case "match_explain":
      return `${toolsHint}
Explain why these two founders may match.

Return:
- 3 reasons they match
- 3 risks/misalignments
- 5 questions they should ask each other

If any profile data is missing, call get_my_profile and/or get_other_profile.

My profile:
${safeJson(payload?.me)}
Other profile:
${safeJson(payload?.other)}${ctxBlock}`;

    case "opener":
      return `${toolsHint}
Write 3 first messages (icebreakers) from me to them.

Style: short, friendly, specific, mention 1 detail from their profile.

If any profile data is missing, call get_my_profile and/or get_other_profile.

Me:
${safeJson(payload?.me)}
Them:
${safeJson(payload?.other)}${ctxBlock}`;

    case "coach":
      return `${toolsHint}
You are a cofounder conversation coach.

Given this chat transcript, produce:
- Summary (5 bullets)
- Missing topics to cover
- Suggested next message (ready-to-send)

If transcript is empty and chatId is provided, call get_recent_messages(chatId, limit).

Transcript:
${payload?.transcript ?? ""}${ctxBlock}`;

    case "chatbot":
    default:
      return `${toolsHint}
You are the Cofounder Connection in-app assistant.

Use APP_CONTEXT as the source of truth about the user, their profile, matches, requests, and chats.
If something is missing from APP_CONTEXT, use tools to fetch what you need.

User question: ${payload?.question ?? ""}${ctxBlock}`;
  }
}

async function callOpenAI(model: string, prompt: string, enableTools: boolean) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const tools = enableTools ? (asOpenAITools() as any) : undefined;

  const toolTrace: Array<{
    name: string;
    args: any;
    ok: boolean;
    error?: string;
  }> = [];

  let previousResponseId: string | undefined = undefined;
  let input: any = prompt;

  for (let step = 0; step < 6; step++) {
    const res = await client.responses.create({
      model,
      input,
      tools,
      tool_choice: enableTools ? "auto" : undefined,
      previous_response_id: previousResponseId,
    } as any);

    const resAny = res as any;
    previousResponseId = resAny.id;

    const outputText = resAny.output_text ?? "";
    const items = resAny.output ?? [];

    // ✅ STRICT: Responses API tool calls are items with type === "function_call"
    const functionCalls = items.filter((x: any) => x?.type === "function_call");

    if (!functionCalls.length) {
      return { text: String(outputText), toolTrace };
    }

    const toolOutputs: any[] = [];

    for (const fc of functionCalls) {
      // ✅ IMPORTANT: call_id must match exactly what model produced
      const callId = fc.call_id ?? fc.id;
      const name = fc.name;
      const rawArgs = fc.arguments;

      let argsObj: any = {};
      try {
        argsObj = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs ?? {};
      } catch {
        argsObj = { _raw: rawArgs };
      }

      const result = await runToolByName(String(name), argsObj);

      toolTrace.push({
        name: String(name),
        args: argsObj,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
      });

      toolOutputs.push({
        type: "function_call_output",
        call_id: callId, // ✅ must match
        output: JSON.stringify(result),
      });
    }

    // ✅ Next request should be ONLY tool outputs
    input = toolOutputs;
  }

  return { text: "Tool loop exceeded max iterations.", toolTrace };
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

  return { text };
}

async function callHF(model: string, prompt: string) {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(
    model
  )}`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 300, return_full_text: false },
    }),
  });

  const json = await r.json();

  let text = "";
  if (Array.isArray(json) && json[0]?.generated_text) text = json[0].generated_text;
  else if (typeof json === "object" && (json as any)?.generated_text)
    text = (json as any).generated_text;
  else text = JSON.stringify(json);

  return { text };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const provider = (body.provider as Provider) || "openai";
    const model = (body.model as string) || "gpt-4o-mini";
    const task = (body.task as Task) || "chatbot";
    const payload = body.payload ?? {};

    const enableTools = Boolean(body.enableTools ?? true);
    const debug = Boolean(body.debug ?? false);

    const useAppContext = Boolean(body.useAppContext ?? body.useAppData ?? false);
    const includeMessages = Boolean(body.includeMessages ?? body.useRecentChat ?? false);
    const messagesLimit = Number(body.messagesLimit ?? 20);

    let appContext: any = null;

    if (useAppContext) {
      const supabase = await supabaseServer();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
      }
      const user = userData.user;
      if (!user) {
        return NextResponse.json(
          { ok: false, error: "Not logged in. Sign in first." },
          { status: 401 }
        );
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("id,full_name,bio,timezone,hours_per_week,stage,goals")
        .eq("id", user.id)
        .maybeSingle();

      const { data: incoming } = await supabase
        .from("matches")
        .select("id,user_id,candidate_id,status,created_at")
        .eq("candidate_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const { data: outgoing } = await supabase
        .from("matches")
        .select("id,user_id,candidate_id,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: acceptedAll } = await supabase
        .from("matches")
        .select("id,user_id,candidate_id,status,created_at")
        .eq("status", "accepted");

      const accepted = (acceptedAll ?? []).filter(
        (m: any) => m.user_id === user.id || m.candidate_id === user.id
      );

      const otherIds = Array.from(
        new Set([
          ...(incoming ?? []).map((m: any) => m.user_id),
          ...accepted.map((m: any) =>
            m.user_id === user.id ? m.candidate_id : m.user_id
          ),
        ])
      );

      let otherProfiles: any[] = [];
      if (otherIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id,full_name,bio,stage,goals,hours_per_week")
          .in("id", otherIds);

        otherProfiles = data ?? [];
      }

      let recentMessages: any[] = [];
      if (includeMessages) {
        const { data: chats } = await supabase
          .from("chats")
          .select("id,match_id,created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        const chatIds = (chats ?? []).map((c: any) => c.id);

        if (chatIds.length > 0) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("chat_id,sender_id,body,created_at")
            .in("chat_id", chatIds)
            .order("created_at", { ascending: false })
            .limit(messagesLimit);

          recentMessages = msgs ?? [];
        }
      }

      appContext = {
        me: { id: user.id, email: user.email },
        myProfile,
        stats: {
          incomingRequests: (incoming ?? []).length,
          outgoingActions: (outgoing ?? []).length,
          acceptedConnections: accepted.length,
        },
        incomingRequests: incoming ?? [],
        outgoingActions: outgoing ?? [],
        acceptedConnections: accepted,
        otherProfiles,
        recentMessages,
      };
    }

    const prompt = buildPrompt(task, payload, appContext);

    if (provider === "openai") {
      const out = await callOpenAI(model, prompt, enableTools);
      return NextResponse.json({
        ok: true,
        output_text: out.text,
        toolTrace: out.toolTrace,
        appContextPreview: appContext?.stats ?? null,
        ...(debug ? { debugPrompt: prompt } : {}),
      });
    }

    let output_text = "";
    if (provider === "anthropic") {
      output_text = (await callAnthropic(model, prompt)).text;
    } else if (provider === "hf") {
      output_text = (await callHF(model, prompt)).text;
    } else {
      return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      output_text,
      appContextPreview: appContext?.stats ?? null,
      ...(debug ? { debugPrompt: prompt } : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}