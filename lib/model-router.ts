// lib/model-router.ts
// Central model routing — right model for each task

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type AgentTask =
  | "rewrite_profile"
  | "profile_missing"
  | "chatbot"
  | "match_explain"
  | "opener"
  | "coach"
  | "weekly_summary"
  | "agreement_summary"
  | "tag_extraction"      // extract tags from natural language
  | "score_match"         // score compatibility between two founders
  | "search_synthesis"    // final search result recommendation
  | "agent_extract"       // generic data extraction agent
  | "agent_synthesize";   // final synthesis agent

type ModelConfig = {
  provider: "openai" | "anthropic";
  model: string;
  max_tokens: number;
};

// ── The routing table ──────────────────────────────────────────
// Rule: cheap fast model for extraction, quality model for output
const MODEL_MAP: Record<AgentTask, ModelConfig> = {

  // Profile writing — user sees this publicly, worth quality
  rewrite_profile:    { provider: "openai",    model: "gpt-4o",                    max_tokens: 1200 },
  profile_missing:    { provider: "openai",    model: "gpt-4o-mini",               max_tokens: 1000 },

  // General Q&A — cheap is fine
  chatbot:            { provider: "openai",    model: "gpt-4o-mini",               max_tokens: 1200 },

  // High-stakes outputs — user makes decisions from these
  match_explain:      { provider: "openai",    model: "gpt-4o",                    max_tokens: 800 },
  opener:             { provider: "openai",    model: "gpt-4o",                    max_tokens: 400 },

  // Claude is better at conversation and document analysis
  coach:              { provider: "anthropic", model: "claude-sonnet-4-5-20250929", max_tokens: 1000 },
  agreement_summary:  { provider: "anthropic", model: "claude-sonnet-4-5-20250929", max_tokens: 1000 },

  // Fast summaries — Haiku is fast enough
  weekly_summary:     { provider: "anthropic", model: "claude-haiku-4-5-20251001",  max_tokens: 1024 },

  // Search agent tasks
  tag_extraction:     { provider: "anthropic", model: "claude-haiku-4-5-20251001",  max_tokens: 512  }, // cheap, just extracting tags
  score_match:        { provider: "anthropic", model: "claude-haiku-4-5-20251001",  max_tokens: 512  }, // cheap, runs per founder
  search_synthesis:   { provider: "anthropic", model: "claude-sonnet-4-5-20250929", max_tokens: 1024 }, // quality, user reads this

  // Generic agent tasks
  agent_extract:      { provider: "anthropic", model: "claude-haiku-4-5-20251001",  max_tokens: 512  },
  agent_synthesize:   { provider: "anthropic", model: "claude-sonnet-4-5-20250929", max_tokens: 1024 },
};

// ── Single unified call function ───────────────────────────────
export async function callModel(task: AgentTask, prompt: string): Promise<string> {
  const config = MODEL_MAP[task];

  if (config.provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: config.model,
      max_tokens: config.max_tokens,
      messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (config.provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content ?? [])
      .map((b: any) => b.type === "text" ? b.text : "")
      .join("");
  }

  return "";
}

// ── Helper to parse JSON from LLM output ──────────────────────
export function safeParseJSON<T>(text: string): T | null {
  try { return JSON.parse(text) as T; }
  catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)) as T; } catch {}
    }
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    if (arrStart >= 0 && arrEnd > arrStart) {
      try { return JSON.parse(text.slice(arrStart, arrEnd + 1)) as T; } catch {}
    }
    return null;
  }
}