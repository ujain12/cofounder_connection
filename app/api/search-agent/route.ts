import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { callModel, safeParseJSON } from "@/lib/model-router";
import { ALL_TAGS } from "@/lib/tags";
import { requireCredits } from "@/lib/require-credits";

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(s) {
          try { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

async function tool_extract_tags(query: string): Promise<string[]> {
  const tagLabels = ALL_TAGS.map(t => t.label).join(", ");
  const result = await callModel("tag_extraction", `You are extracting skill tags from a founder's search query.\n\nAvailable tags: ${tagLabels}\n\nSearch query: "${query}"\n\nReturn ONLY a JSON array of tag labels that match. Maximum 6 tags.\nExample: ["AI / ML", "Technical Founder", "HealthTech"]\n\nReturn ONLY the JSON array.`);
  return safeParseJSON<string[]>(result) ?? [];
}

async function tool_search_by_tags(supabase: any, tags: string[], excludeUserId: string): Promise<string[]> {
  if (tags.length === 0) return [];
  const { data } = await supabase.from("profile_tags").select("user_id, tag").in("tag", tags).neq("user_id", excludeUserId);
  if (!data || data.length === 0) return [];
  const tagCounts: Record<string, number> = {};
  data.forEach((row: any) => { tagCounts[row.user_id] = (tagCounts[row.user_id] ?? 0) + 1; });
  return Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([userId]) => userId);
}

async function tool_get_profiles(supabase: any, userIds: string[]): Promise<any[]> {
  if (userIds.length === 0) return [];
  const [profilesRes, tagsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, bio, stage, goals, hours_per_week").in("id", userIds),
    supabase.from("profile_tags").select("user_id, tag, category").in("user_id", userIds),
  ]);
  const profiles = profilesRes.data ?? [];
  const tags = tagsRes.data ?? [];
  return profiles.map((p: any) => ({ ...p, tags: tags.filter((t: any) => t.user_id === p.id).map((t: any) => t.tag) }));
}

async function tool_score_match(myProfile: any, theirProfile: any, searchQuery: string): Promise<{ score: number; reason: string; match_tags: string[] }> {
  const result = await callModel("score_match", `You are scoring cofounder compatibility. Score based on complementarity, not similarity.\n\nSearch intent: "${searchQuery}"\n\nFounder A (searcher):\nName: ${myProfile.full_name}\nBio: ${myProfile.bio}\nStage: ${myProfile.stage}\nGoals: ${myProfile.goals}\nTags: ${myProfile.tags?.join(", ") ?? "none"}\n\nFounder B (candidate):\nName: ${theirProfile.full_name}\nBio: ${theirProfile.bio}\nStage: ${theirProfile.stage}\nTags: ${theirProfile.tags?.join(", ") ?? "none"}\n\nReturn ONLY valid JSON:\n{"score":8,"reason":"one specific sentence","match_tags":["AI / ML","HealthTech"]}`);
  return safeParseJSON<{ score: number; reason: string; match_tags: string[] }>(result) ?? { score: 5, reason: "Potential match", match_tags: [] };
}

async function tool_synthesize(query: string, myProfile: any, topMatches: any[]): Promise<string> {
  return await callModel("search_synthesis", `You are a cofounder matching expert summarizing search results.\n\nFounder searching: ${myProfile.full_name}\nBackground: ${myProfile.bio}\nTags: ${myProfile.tags?.join(", ")}\nSearch query: "${query}"\n\nTop matches:\n${topMatches.map((m, i) => `${i + 1}. ${m.profile.full_name} (score: ${m.score}/10)\n   Tags: ${m.profile.tags?.join(", ")}\n   Why: ${m.reason}`).join("\n")}\n\nWrite a 2-paragraph summary. Be specific and name actual founders.`);
}

async function reactSearchAgent(supabase: any, userId: string, query: string) {
  const steps: { thought: string; action: string; result: string }[] = [];

  steps.push({ thought: "Extracting skill tags from search query", action: "tag_extraction", result: "" });
  const extractedTags = await tool_extract_tags(query);
  steps[0].result = `Found tags: ${extractedTags.join(", ") || "none — will use broad search"}`;

  const [sentMatches, receivedMatches] = await Promise.all([
    supabase.from("matches").select("candidate_id").eq("user_id", userId),
    supabase.from("matches").select("user_id").eq("candidate_id", userId),
  ]);
  const alreadyMatchedIds = new Set([
    ...((sentMatches.data ?? []).map((m: any) => m.candidate_id)),
    ...((receivedMatches.data ?? []).map((m: any) => m.user_id)),
  ]);

  steps.push({ thought: "Searching founders database by extracted tags", action: "search_by_tags", result: "" });
  let candidateIds = await tool_search_by_tags(supabase, extractedTags, userId);
  candidateIds = candidateIds.filter((id: string) => !alreadyMatchedIds.has(id));

  if (candidateIds.length === 0) {
    const { data: allProfiles } = await supabase.from("profiles").select("id").neq("id", userId).limit(50);
    candidateIds = (allProfiles ?? []).map((p: any) => p.id).filter((id: string) => !alreadyMatchedIds.has(id));
    steps[1].result = `No tag matches — broadening to ${candidateIds.length} unmatched founders`;
  } else {
    steps[1].result = `Found ${candidateIds.length} unmatched founders matching tags`;
  }

  steps.push({ thought: "Loading full profiles and tags for candidates", action: "get_profiles", result: "" });
  const [myProfileRes, candidateProfiles] = await Promise.all([
    supabase.from("profiles").select("id,full_name,bio,stage,goals,hours_per_week").eq("id", userId).maybeSingle(),
    tool_get_profiles(supabase, candidateIds),
  ]);
  const myProfile = myProfileRes.data;
  const { data: myTagsData } = await supabase.from("profile_tags").select("tag").eq("user_id", userId);
  myProfile.tags = (myTagsData ?? []).map((t: any) => t.tag);
  steps[2].result = `Loaded ${candidateProfiles.length} profiles with tags`;

  steps.push({ thought: "Scoring compatibility with each founder", action: "score_matches", result: "" });
  const scoreResults = await Promise.all(
    candidateProfiles.map(async (candidate) => {
      const { score, reason, match_tags } = await tool_score_match(myProfile, candidate, query);
      return { profile: candidate, score, reason, match_tags };
    })
  );
  const ranked = scoreResults.sort((a, b) => b.score - a.score).slice(0, 5);
  steps[3].result = `Scored ${scoreResults.length} founders — top score: ${ranked[0]?.score ?? 0}/10`;

  steps.push({ thought: "Building final recommendation", action: "synthesize", result: "" });
  const recommendation = await tool_synthesize(query, myProfile, ranked.slice(0, 3));
  steps[4].result = "Recommendation generated";

  return { steps, ranked, recommendation, extractedTags };
}

// ── DELETE: Unmatch (no credits needed) ──
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await makeSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { match_id } = await req.json();
    if (!match_id) return NextResponse.json({ ok: false, error: "match_id required" }, { status: 400 });

    const userId = userData.user.id;
    const { error } = await supabase.from("matches").delete().eq("id", match_id).or(`user_id.eq.${userId},candidate_id.eq.${userId}`);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await supabase.from("chats").delete().eq("match_id", match_id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// ── POST: Search (requires credits) ──
export async function POST(req: NextRequest) {
  try {
    // ── Credit gate — blocks if no credits ──
    const gate = await requireCredits();
    if (gate.error) return gate.error;

    const supabase = await makeSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { query } = await req.json();
    if (!query?.trim()) return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });

    const result = await reactSearchAgent(supabase, userData.user.id, query);

    return NextResponse.json({
      ok: true, query,
      extracted_tags: result.extractedTags,
      steps: result.steps,
      results: result.ranked,
      recommendation: result.recommendation,
    });
  } catch (e: any) {
    console.error("Search agent error:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}