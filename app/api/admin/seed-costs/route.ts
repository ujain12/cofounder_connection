import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = ["utkarshj1107@gmail.com", "ujain@charlotte.edu"];

// Realistic usage patterns for a cofounder matching platform
const ACTIONS = [
  { action: "chatbot", models: ["gpt-4o-mini", "gpt-4o"], weight: 25 },
  { action: "rewrite_profile", models: ["gpt-4o-mini"], weight: 15 },
  { action: "profile_missing", models: ["gpt-4o-mini"], weight: 10 },
  { action: "match_explain", models: ["gpt-4o-mini", "gpt-4o"], weight: 15 },
  { action: "opener", models: ["gpt-4o-mini"], weight: 10 },
  { action: "coach", models: ["gpt-4o-mini"], weight: 5 },
  { action: "tag_extraction", models: ["claude-haiku-4-5-20251001"], weight: 20 },
  { action: "score_match", models: ["claude-haiku-4-5-20251001"], weight: 25 },
  { action: "search_synthesis", models: ["claude-sonnet-4-5-20250929", "gpt-4o-mini"], weight: 8 },
  { action: "weekly_summary", models: ["gpt-4o-mini"], weight: 7 },
  { action: "agreement_summary", models: ["gpt-4o-mini"], weight: 5 },
  { action: "multimodal_analysis", models: ["openrouter/free"], weight: 3 },
];

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":                    { input: 0.00015, output: 0.0006 },
  "gpt-4o":                         { input: 0.0025,  output: 0.01 },
  "claude-haiku-4-5-20251001":      { input: 0.0008,  output: 0.004 },
  "claude-sonnet-4-5-20250929":     { input: 0.003,   output: 0.015 },
  "openrouter/free":                { input: 0.0,     output: 0.0 },
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items: typeof ACTIONS): (typeof ACTIONS)[0] {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[0];
}

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email?.toLowerCase() || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get all approved users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("status", "approved");

  const users = profiles || [];

  if (users.length === 0) {
    // If no approved users, use the admin's own ID
    users.push({ id: user.id, full_name: "Admin User" });
  }

  const rows: any[] = [];
  const now = Date.now();

  // Generate 30 days of usage data
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(now - dayOffset * 24 * 60 * 60 * 1000);

    // Each user makes 2-8 requests per day (some days 0)
    for (const u of users) {
      const requestsToday = dayOffset < 3 ? randomInt(3, 10) : randomInt(0, 6);

      for (let r = 0; r < requestsToday; r++) {
        const actionConfig = pickWeighted(ACTIONS);
        const model = actionConfig.models[randomInt(0, actionConfig.models.length - 1)];
        const pricing = MODEL_COSTS[model] || { input: 0.001, output: 0.002 };

        const inputTokens = randomInt(150, 1200);
        const outputTokens = randomInt(80, 800);

        const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
        const margin = cost * 0.10;
        const totalCharged = cost + margin;

        // Random time during the day
        const hour = randomInt(8, 23);
        const minute = randomInt(0, 59);
        const ts = new Date(date);
        ts.setHours(hour, minute, randomInt(0, 59));

        rows.push({
          user_id: u.id,
          action: actionConfig.action,
          model,
          tokens_used: inputTokens + outputTokens,
          cost: Math.round(cost * 1000000) / 1000000,
          your_margin: Math.round(margin * 1000000) / 1000000,
          total_charged: Math.round(totalCharged * 1000000) / 1000000,
          created_at: ts.toISOString(),
        });
      }
    }
  }

  // Insert in batches of 100
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("usage_log").insert(batch);
    if (error) {
      return NextResponse.json({ error: error.message, inserted }, { status: 500 });
    }
    inserted += batch.length;
  }

  return NextResponse.json({
    ok: true,
    message: `Seeded ${inserted} usage records across ${users.length} users over 30 days`,
    users: users.map(u => u.full_name),
    totalRecords: inserted,
  });
}
