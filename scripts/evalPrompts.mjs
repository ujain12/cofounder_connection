import OpenAI from "openai";
import { buildMatchPrompt } from "../lib/prompts/matchPrompt.ts";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const user = {
  name: "User",
  skills: ["React", "TypeScript"],
  role: "Technical",
  industry: "EdTech",
  stage: "MVP",
  goals: "Ship fast and acquire early users",
  workStyle: "Async, weekly sprints",
};

const candidates = [
  { name: "A", skills: ["Sales", "Partnerships"], role: "Business", industry: "EdTech", stage: "MVP", goals: "Get pilots" },
  { name: "B", skills: ["iOS", "Swift"], role: "Technical", industry: "Gaming", stage: "Idea", goals: "Build a mobile game" },
];

async function runOnce() {
  const prompt = buildMatchPrompt(user, candidates);
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: "Output strictly valid JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const text = resp.choices?.[0]?.message?.content ?? "";
  let ok = true;
  try {
    JSON.parse(text);
  } catch {
    ok = false;
  }
  return { ok, text_len: text.length };
}

const N = 10;
let valid = 0;
for (let i = 0; i < N; i++) {
  const r = await runOnce();
  if (r.ok) valid++;
}
console.log({ trials: N, json_valid_rate: valid / N });