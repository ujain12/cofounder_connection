"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import Link from "next/link";
import { CATEGORY_COLORS, ALL_TAGS } from "@/lib/tags";

type Candidate = {
  id: string; full_name: string | null; bio: string | null;
  stage: string | null; goals: string | null; hours_per_week: number | null;
  avatar_url?: string | null; tags?: string[];
};
type MatchRow = { id: string; user_id: string; candidate_id: string; status: "pending"|"accepted"|"declined"; created_at: string; };
type Connection = { match_id: string; other_id: string; other?: { id: string; full_name: string|null; bio: string|null; avatar_url?: string|null } | null; };

type AgentStep = { thought: string; action: string; result: string };
type AgentResult = { profile: any; score: number; reason: string; match_tags: string[] };

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function TagChip({ label }: { label: string }) {
  const tag = ALL_TAGS.find(t => t.label === label);
  const colors = tag ? CATEGORY_COLORS[tag.category] : CATEGORY_COLORS["Domain Expertise"];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: colors.text, background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 20, padding: "2px 8px",
      fontFamily: "'IBM Plex Mono', monospace",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function MatchesPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [myActions, setMyActions] = useState<MatchRow[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [query, setQuery] = useState("");

  // Agent state
  const [agentQuery, setAgentQuery] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [agentRecommendation, setAgentRecommendation] = useState("");
  const [agentTags, setAgentTags] = useState<string[]>([]);
  const [showAgent, setShowAgent] = useState(false);
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function loadAll() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setLoading(false); return; }
    setMe(user.id);

    // Matches I sent
    const { data: actions } = await supabase.from("matches").select("id,user_id,candidate_id,status,created_at").eq("user_id", user.id);
    const actionsRows = (actions as MatchRow[]) ?? [];
    setMyActions(actionsRows);

    // Matches sent TO me (incoming requests)
    const { data: incoming } = await supabase.from("matches").select("id,user_id,candidate_id,status,created_at").eq("candidate_id", user.id);
    const incomingRows = (incoming as MatchRow[]) ?? [];

    // Exclude BOTH directions — hide anyone already interacted with
    const actedIds = new Set([
      ...actionsRows.map(r => r.candidate_id),
      ...incomingRows.map(r => r.user_id),
    ]);

    // Load candidates with tags
    const { data: profs } = await supabase.from("profiles").select("id,full_name,bio,stage,goals,hours_per_week,avatar_url").neq("id", user.id).limit(80);
    const rawCandidates = ((profs as any) ?? []).filter((p: Candidate) => !actedIds.has(p.id)).slice(0, 30);

    // Load tags for all candidates
    const candidateIds = rawCandidates.map((c: Candidate) => c.id);
    if (candidateIds.length > 0) {
      const { data: tagsData } = await supabase.from("profile_tags").select("user_id,tag").in("user_id", candidateIds);
      const tagsByUser: Record<string, string[]> = {};
      (tagsData ?? []).forEach((t: any) => {
        if (!tagsByUser[t.user_id]) tagsByUser[t.user_id] = [];
        tagsByUser[t.user_id].push(t.tag);
      });
      setCandidates(rawCandidates.map((c: Candidate) => ({ ...c, tags: tagsByUser[c.id] ?? [] })));
    } else {
      setCandidates(rawCandidates);
    }

    const { data: acc } = await supabase.from("matches").select("id,user_id,candidate_id,status,created_at").eq("status", "accepted");
    const mineAccepted = ((acc as any) ?? []).filter((m: MatchRow) => m.user_id === user.id || m.candidate_id === user.id);
    const connectionRows: Connection[] = mineAccepted.map((m: MatchRow) => ({
      match_id: m.id, other_id: m.user_id === user.id ? m.candidate_id : m.user_id, other: null,
    }));
    const otherIds = Array.from(new Set(connectionRows.map(c => c.other_id)));
    let otherProfiles: any[] = [];
    if (otherIds.length > 0) {
      const { data: ops } = await supabase.from("profiles").select("id,full_name,bio,avatar_url").in("id", otherIds);
      otherProfiles = (ops as any[]) ?? [];
    }
    setConnections(connectionRows.map(c => ({ ...c, other: otherProfiles.find(p => p.id === c.other_id) ?? null })));
    setLoading(false);
  }

  async function unmatch(matchId: string) {
    if (!window.confirm("Remove this connection? This will also delete your chat history with them.")) return;
    setUnmatchingId(matchId);
    try {
      const res = await fetch("/api/search-agent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await loadAll();
    } catch (e: any) {
      alert("Unmatch failed: " + e.message);
    }
    setUnmatchingId(null);
  }

  async function like(candidateId: string) {
    if (!me) return;
    const { error } = await supabase.from("matches").insert({ user_id: me, candidate_id: candidateId, status: "pending" });
    if (error) return alert("Like failed: " + error.message);
    await loadAll();
  }

  async function decline(candidateId: string) {
    if (!me) return;
    const { error } = await supabase.from("matches").insert({ user_id: me, candidate_id: candidateId, status: "declined" });
    if (error) return alert("Decline failed: " + error.message);
    await loadAll();
  }

  // ── Run the search agent ───────────────────────────────────
  async function runSearchAgent() {
    if (!agentQuery.trim()) return;
    setAgentLoading(true);
    setAgentSteps([]);
    setAgentResults([]);
    setAgentRecommendation("");
    setAgentTags([]);

    try {
      const res = await fetch("/api/search-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: agentQuery }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAgentSteps(json.steps ?? []);
      setAgentResults(json.results ?? []);
      setAgentRecommendation(json.recommendation ?? "");
      setAgentTags(json.extracted_tags ?? []);
    } catch (e: any) {
      alert("Agent failed: " + e.message);
    }
    setAgentLoading(false);
  }

  const alreadyActed = (id: string) => myActions.some(r => r.candidate_id === id);

  const visible = candidates.filter(c => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.full_name ?? "").toLowerCase().includes(q) ||
      (c.bio ?? "").toLowerCase().includes(q) ||
      (c.stage ?? "").toLowerCase().includes(q) ||
      (c.tags ?? []).some(t => t.toLowerCase().includes(q))
    );
  });

  const scoreColor = (s: number) => s >= 8 ? "#34d399" : s >= 6 ? "#fbbf24" : "#f43f5e";

  return (
    <AppShell title="Find Cofounders">
      <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 960 }}>

        {/* ══ AI SEARCH AGENT ══ */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#f0f2fc", marginBottom: 2 }}>
                AI Search Agent
              </h2>
              <p style={{ fontSize: 12, color: "#64748b" }}>
                Describe who you're looking for — the agent reasons through tags, profiles, and compatibility to find your best matches.
              </p>
            </div>
            <button
              onClick={() => setShowAgent(v => !v)}
              style={{ background: "transparent", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "7px 16px", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", userSelect: "none" }}
            >
              {showAgent ? "Hide Agent" : "Show Agent"}
            </button>
          </div>

          {showAgent && (
            <div style={{ background: "#111827", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24 }}>

              {/* Search input */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <input
                  value={agentQuery}
                  onChange={e => setAgentQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runSearchAgent()}
                  placeholder='e.g. "I need a technical AI cofounder for healthcare, MVP stage"'
                  style={{ flex: 1, background: "#1e2235", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: "11px 16px", color: "#f0f2fc", fontSize: 13, outline: "none", fontFamily: "inherit", WebkitTextFillColor: "#f0f2fc" }}
                />
                <button
                  onClick={runSearchAgent}
                  disabled={agentLoading || !agentQuery.trim()}
                  style={{ background: agentLoading ? "rgba(79,70,229,0.3)" : "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: 10, padding: "11px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: agentLoading ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0, userSelect: "none" }}
                >
                  {agentLoading ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Agent thinking steps */}
              {(agentLoading || agentSteps.length > 0) && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                    Agent reasoning
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {agentLoading && agentSteps.length === 0 && (
                      ["Extracting tags from query...", "Searching founder database...", "Scoring compatibility...", "Building recommendation..."].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
                          <p style={{ fontSize: 12, color: "#334155" }}>{s}</p>
                        </div>
                      ))
                    )}
                    {agentSteps.map((step, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#0d1117", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", marginTop: 5, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{step.thought}</p>
                          <p style={{ fontSize: 12, color: "#94a3b8" }}>{step.result}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted tags */}
              {agentTags.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
                    Tags extracted from query
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {agentTags.map(t => <TagChip key={t} label={t} />)}
                  </div>
                </div>
              )}

              {/* Agent results */}
              {agentResults.length > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                    Top matches — ranked by compatibility
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {agentResults.map((result, i) => (
                      <div key={result.profile.id} style={{
                        background: "#0d1117", border: `1px solid ${i === 0 ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 14, padding: 18,
                        display: "flex", alignItems: "flex-start", gap: 16,
                      }}>
                        {/* Rank */}
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#1e2235", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                          {i + 1}
                        </div>

                        {/* Avatar */}
                        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: result.profile.avatar_url ? "transparent" : "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "2px solid rgba(99,102,241,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                          {result.profile.avatar_url ? <img src={result.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(result.profile.full_name)}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "#f0f2fc" }}>{result.profile.full_name}</p>
                            <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(result.score) }}>{result.score}/10</span>
                          </div>
                          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>{result.reason}</p>
                          {result.match_tags.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              {result.match_tags.map(t => <TagChip key={t} label={t} />)}
                            </div>
                          )}
                          {/* Action buttons */}
                          {!alreadyActed(result.profile.id) && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => like(result.profile.id)} style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "6px 16px", color: "#34d399", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Connect</button>
                              <button onClick={() => decline(result.profile.id)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 16px", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Pass</button>
                            </div>
                          )}
                          {alreadyActed(result.profile.id) && <p style={{ fontSize: 11, color: "#475569" }}>Already actioned</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Agent recommendation */}
                  {agentRecommendation && (
                    <div style={{ background: "#0d1117", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: 18 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                        Agent recommendation
                      </p>
                      <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>{agentRecommendation}</p>
                    </div>
                  )}
                </>
              )}

              {!agentLoading && agentResults.length === 0 && agentSteps.length === 0 && (
                <p style={{ fontSize: 13, color: "#334155", textAlign: "center", padding: "8px 0" }}>
                  Describe what you need — the agent will reason through the database to find your best matches.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ══ YOUR CONNECTIONS ══ */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#f0f2fc", marginBottom: 2 }}>Your Connections</h2>
              <p style={{ fontSize: 12, color: "#64748b" }}>Accepted matches — open chat to collaborate</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#818cf8", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 20, padding: "4px 12px", fontFamily: "'IBM Plex Mono', monospace" }}>
              {connections.length} connected
            </span>
          </div>
          {connections.length === 0 ? (
            <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "24px 20px" }}>
              <p style={{ fontSize: 13, color: "#475569" }}>No connections yet. Use the AI search agent or browse below to find your cofounder.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {connections.map(c => (
                <div key={c.match_id} style={{ background: "#111827", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: 18, display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: c.other?.avatar_url ? "transparent" : "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "2px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden" }}>
                    {c.other?.avatar_url ? <img src={c.other.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(c.other?.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "#f0f2fc", marginBottom: 4 }}>{c.other?.full_name ?? "Unnamed"}</p>
                    <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{c.other?.bio ?? "No bio"}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
                      <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>Connected</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <Link href={`/chat/${c.match_id}`} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: "#a5b4fc", textDecoration: "none", textAlign: "center" }}>
                      Chat →
                    </Link>
                    <button
                      onClick={() => unmatch(c.match_id)}
                      disabled={unmatchingId === c.match_id}
                      style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "5px 14px", fontSize: 11, fontWeight: 600, color: "#fb7185", cursor: "pointer", fontFamily: "inherit", userSelect: "none", opacity: unmatchingId === c.match_id ? 0.5 : 1 }}
                    >
                      {unmatchingId === c.match_id ? "Removing..." : "Unmatch"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ══ BROWSE FOUNDERS ══ */}
        <section>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#f0f2fc", marginBottom: 2 }}>Browse Founders</h2>
            <p style={{ fontSize: 12, color: "#64748b" }}>Search by name, bio, stage, or tags</p>
          </div>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, bio, stage, or tag..." style={{ width: "100%", background: "#111827", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "11px 14px 11px 38px", color: "#f0f2fc", fontSize: 13, outline: "none", fontFamily: "inherit", WebkitTextFillColor: "#f0f2fc" }} />
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6, width: "40%", marginBottom: 8 }} />
                      <div style={{ height: 10, background: "rgba(255,255,255,0.03)", borderRadius: 6, width: "70%" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#475569" }}>No founders found — try the AI Search Agent above for smarter matching.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {visible.map(c => (
                <div key={c.id} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column" }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: c.avatar_url ? "transparent" : "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "2px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden" }}>
                      {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(c.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#f0f2fc", marginBottom: 3 }}>{c.full_name || "Unnamed"}</p>
                      <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{c.bio || "No bio."}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  {(c.tags ?? []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {(c.tags ?? []).slice(0, 4).map(t => <TagChip key={t} label={t} />)}
                      {(c.tags ?? []).length > 4 && <span style={{ fontSize: 10, color: "#475569" }}>+{(c.tags ?? []).length - 4}</span>}
                    </div>
                  )}

                  {/* Stage + hours */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {c.stage && <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, padding: "2px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>{c.stage}</span>}
                    {c.hours_per_week != null && <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "2px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>{c.hours_per_week}h/wk</span>}
                  </div>

                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 12 }} />

                  {/* Actions */}
                  {!alreadyActed(c.id) ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => like(c.id)} style={{ flex: 1, padding: "9px 0", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#34d399", fontFamily: "inherit", userSelect: "none" }}>Connect</button>
                      <button onClick={() => decline(c.id)} style={{ flex: 1, padding: "9px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#64748b", fontFamily: "inherit", userSelect: "none" }}>Pass</button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>Already actioned</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </AppShell>
  );
}