"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState, useCallback } from "react";
import AppShell from "../../components/AppShell";

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  bio?: string | null;
  stage?: string | null;
};

type AcceptedMatch = {
  match_id: string;
  founder_a_id: string;
  founder_b_id: string;
  other_id: string;
  other: ProfileRow | null;
};

type TaskRow = {
  id: string;
  match_id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  assigned_to: string | null;
  due_date: string | null;
  updated_at: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  created_at: string;
};

type AgreementRow = {
  id: string;
  match_id: string;
  agreement_title: string | null;
  project_name: string | null;
  founder_a_role: string | null;
  founder_b_role: string | null;
  equity_expectations: string | null;
  time_commitment: string | null;
  milestones: string | null;
  decision_style: string | null;
  conflict_handling: string | null;
  status: "draft" | "finalized";
  updated_at: string;
};

type Tab = "my" | "both" | "agreement" | "ai";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch { return ts; }
}

function daysSince(ts: string | null) {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 40, color = "indigo" }: { name?: string | null; size?: number; color?: string }) {
  const bg = color === "violet"
    ? "linear-gradient(135deg, #7c3aed, #a855f7)"
    : "linear-gradient(135deg, #4f46e5, #7c3aed)";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff",
      fontWeight: 700, fontSize: size * 0.35,
      border: "2px solid rgba(99,102,241,0.3)", flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

function StatCard({ label, value, sub, accent = "#6366f1" }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: "16px 20px",
      boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginBottom: 12 }}>
      {children}
    </h3>
  );
}

function Pill({ children, color = "indigo" }: { children: React.ReactNode; color?: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: "rgba(99,102,241,0.12)", text: "#a5b4fc", border: "rgba(99,102,241,0.25)" },
    emerald: { bg: "rgba(16,185,129,0.1)", text: "#34d399", border: "rgba(16,185,129,0.25)" },
    rose: { bg: "rgba(244,63,94,0.1)", text: "#fb7185", border: "rgba(244,63,94,0.2)" },
    amber: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24", border: "rgba(245,158,11,0.2)" },
    zinc: { bg: "rgba(255,255,255,0.06)", text: "#94a3b8", border: "rgba(255,255,255,0.1)" },
  };
  const s = styles[color] ?? styles.indigo;
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 20, padding: 20,
      boxShadow: "0 2px 20px rgba(0,0,0,0.5)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function TaskBar({ tasks, userId, label }: { tasks: TaskRow[]; userId: string | null; label: string }) {
  const mine = tasks.filter(t => t.assigned_to === userId);
  const done = mine.filter(t => t.status === "done").length;
  const blocked = mine.filter(t => t.status === "blocked").length;
  const inProgress = mine.filter(t => t.status === "in_progress").length;
  const todo = mine.filter(t => t.status === "todo").length;
  const total = mine.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Avatar name={label} size={32} />
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9" }}>{label}</p>
          <p style={{ fontSize: 11, color: "#475569" }}>{total} tasks assigned</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Pill color={pct === 100 ? "emerald" : pct > 50 ? "indigo" : "zinc"}>{pct}% done</Pill>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
          borderRadius: 99, transition: "width 0.6s ease",
        }} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {todo > 0 && <Pill color="zinc">📋 {todo} todo</Pill>}
        {inProgress > 0 && <Pill color="indigo">⚡ {inProgress} in progress</Pill>}
        {blocked > 0 && <Pill color="rose">🚧 {blocked} blocked</Pill>}
        {done > 0 && <Pill color="emerald">✅ {done} done</Pill>}
        {total === 0 && <p style={{ fontSize: 12, color: "#475569" }}>No tasks assigned yet</p>}
      </div>
    </Card>
  );
}

function ActivityRow({ icon, text, time }: { icon: string; text: string; time: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, color: "#cbd5e1" }}>{text}</p>
        <p style={{ fontSize: 11, color: "#475569" }}>{time}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CheckinsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState("You");
  const [matches, setMatches] = useState<AcceptedMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [loadingMatches, setLoadingMatches] = useState(true);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [agreement, setAgreement] = useState<AgreementRow | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const [tab, setTab] = useState<Tab>("both");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiNudge, setAiNudge] = useState<string | null>(null);
  const [aiAgreementSummary, setAiAgreementSummary] = useState<string | null>(null);
  const [aiAgreementLoading, setAiAgreementLoading] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoadingMatches(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoadingMatches(false); return; }
      setMe(user.id);

      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (prof?.full_name) setMyName(prof.full_name);

      const { data: acc } = await supabase
        .from("matches").select("id,user_id,candidate_id,status,created_at").eq("status", "accepted");

      const myMatches = ((acc as MatchRow[]) ?? []).filter(
        m => m.user_id === user.id || m.candidate_id === user.id
      );

      const otherIds = Array.from(new Set(myMatches.map(m =>
        m.user_id === user.id ? m.candidate_id : m.user_id
      )));

      let otherProfiles: ProfileRow[] = [];
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id,full_name,bio,stage").in("id", otherIds);
        otherProfiles = (profs as ProfileRow[]) ?? [];
      }

      const hydrated: AcceptedMatch[] = myMatches.map(m => {
        const otherId = m.user_id === user.id ? m.candidate_id : m.user_id;
        return {
          match_id: m.id,
          founder_a_id: m.user_id,
          founder_b_id: m.candidate_id,
          other_id: otherId,
          other: otherProfiles.find(p => p.id === otherId) ?? null,
        };
      });

      setMatches(hydrated);
      if (hydrated[0]) setSelectedMatchId(hydrated[0].match_id);
      setLoadingMatches(false);
    })();
  }, [supabase]);

  // ── Load match data when match changes ────────────────────────────────────

  const loadMatchData = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setLoadingData(true);
    setAiSummary(null);
    setAiNudge(null);
    setAiAgreementSummary(null);

    const [tasksRes, agreementRes] = await Promise.all([
      supabase.from("founder_tasks").select("id,match_id,title,status,priority,assigned_to,due_date,updated_at,created_at").eq("match_id", matchId),
      supabase.from("founder_agreements").select("id,match_id,agreement_title,project_name,founder_a_role,founder_b_role,equity_expectations,time_commitment,milestones,decision_style,conflict_handling,status,updated_at").eq("match_id", matchId).maybeSingle(),
    ]);

    setTasks((tasksRes.data as TaskRow[]) ?? []);
    setAgreement((agreementRes.data as AgreementRow) ?? null);

    // Load messages via chat
    const { data: chatRow } = await supabase
      .from("chats").select("id").eq("match_id", matchId).maybeSingle();

    if (chatRow?.id) {
      const { data: msgs } = await supabase
        .from("messages").select("id,sender_id,created_at").eq("chat_id", chatRow.id).order("created_at", { ascending: false }).limit(100);
      setMessages((msgs as MessageRow[]) ?? []);
    } else {
      setMessages([]);
    }

    setLoadingData(false);
  }, [supabase]);

  useEffect(() => {
    if (selectedMatchId) loadMatchData(selectedMatchId);
  }, [selectedMatchId, loadMatchData]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const selectedMatch = matches.find(m => m.match_id === selectedMatchId) ?? null;
  const otherName = selectedMatch?.other?.full_name ?? "Cofounder";
  const otherId = selectedMatch?.other_id ?? null;

  const myTasks = tasks.filter(t => t.assigned_to === me);
  const otherTasks = tasks.filter(t => t.assigned_to === otherId);
  const myDone = myTasks.filter(t => t.status === "done").length;
  const otherDone = otherTasks.filter(t => t.status === "done").length;

  const myMessages = messages.filter(m => m.sender_id === me);
  const otherMessages = messages.filter(m => m.sender_id === otherId);

  const lastMyMessage = myMessages[0]?.created_at ?? null;
  const lastOtherMessage = otherMessages[0]?.created_at ?? null;
  const lastMyTask = myTasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]?.updated_at ?? null;

  const myInactiveDays = daysSince(lastMyMessage ?? lastMyTask);
  const otherInactiveDays = daysSince(lastOtherMessage);

  // ── AI Calls ───────────────────────────────────────────────────────────────

  async function generateWeeklySummary() {
    if (!selectedMatch) return;
    setAiLoading(true);
    setTab("ai");

    const taskSummary = tasks.map(t =>
      `${t.title} [${t.status}] assigned to ${t.assigned_to === me ? myName : otherName}`
    ).join("\n");

    const prompt = `You are an AI assistant for a cofounder collaboration tool.

Here is the weekly data for a founder pair:

MATCH: ${myName} <> ${otherName}

TASKS (${tasks.length} total):
${taskSummary || "No tasks yet"}

MESSAGES: ${myName} sent ${myMessages.length} messages, ${otherName} sent ${otherMessages.length} messages.

AGREEMENT STATUS: ${agreement?.status ?? "Not created"}, Project: ${agreement?.project_name ?? "Unnamed"}

MY TASKS DONE: ${myDone}/${myTasks.length}
COFOUNDER TASKS DONE: ${otherDone}/${otherTasks.length}

Generate:
1. A 3-4 sentence weekly summary of collaboration health
2. One specific nudge or action item for each founder (be direct and constructive)
3. A "collaboration score" from 1-10 with one sentence of reasoning

Format your response with clear sections: WEEKLY SUMMARY, NUDGE FOR ${myName.toUpperCase()}, NUDGE FOR ${otherName.toUpperCase()}, COLLABORATION SCORE`;

    try {
      const res = await fetch("/api/checkins-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type: "weekly_summary" }),
      });
      const json = await res.json();
      if (json.ok) {
        const text: string = json.text ?? "";
        const nudgeMatch = text.match(/NUDGE FOR [A-Z\s]+:([\s\S]*?)(?:COLLABORATION SCORE|$)/i);
        setAiNudge(nudgeMatch ? nudgeMatch[0] : null);
        setAiSummary(text);
      } else {
        setAiSummary("Failed to generate summary. Please try again.");
      }
    } catch {
      setAiSummary("Network error. Please try again.");
    }
    setAiLoading(false);
  }

  async function generateAgreementSummary() {
    if (!agreement) return;
    setAiAgreementLoading(true);
    setTab("agreement");

    const prompt = `You are an AI assistant for a cofounder collaboration tool.

Summarize this founder agreement in plain language. Be concise, direct, and highlight the most important points.

AGREEMENT DATA:
Project: ${agreement.project_name ?? "Unnamed"}
Title: ${agreement.agreement_title ?? "Untitled"}
Founder A Role: ${agreement.founder_a_role ?? "Not defined"}
Founder B Role: ${agreement.founder_b_role ?? "Not defined"}
Equity: ${agreement.equity_expectations ?? "Not defined"}
Time Commitment: ${agreement.time_commitment ?? "Not defined"}
Decision Style: ${agreement.decision_style ?? "Not defined"}
Conflict Handling: ${agreement.conflict_handling ?? "Not defined"}
Milestones: ${agreement.milestones ?? "Not defined"}
Status: ${agreement.status}

Provide:
1. A 2-3 sentence plain English summary of what was agreed
2. Key commitments (bullet points, max 4)
3. Any gaps or items that still need to be defined (be honest)`;

    try {
      const res = await fetch("/api/checkins-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type: "agreement_summary" }),
      });
      const json = await res.json();
      if (json.ok) {
        setAiAgreementSummary(json.text ?? "Could not generate summary.");
      } else {
        setAiAgreementSummary("Failed to generate summary.");
      }
    } catch {
      setAiAgreementSummary("Network error.");
    }
    setAiAgreementLoading(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loadingMatches) {
    return (
      <AppShell title="Check-ins">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#475569" }}>
          Loading your matches...
        </div>
      </AppShell>
    );
  }

  if (matches.length === 0) {
    return (
      <AppShell title="Check-ins">
        <div style={{
          maxWidth: 520, margin: "60px auto", textAlign: "center",
          background: "#0d0f1a", border: "1px dashed rgba(99,102,241,0.2)",
          borderRadius: 24, padding: "48px 32px",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
            No accepted matches yet
          </h2>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
            The Check-ins dashboard unlocks once you have an accepted cofounder match.
            Head to Matches to connect with a founder.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Check-ins">
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, color: "#475569" }}>Collaboration dashboard — only visible to you and your cofounder</p>
          </div>

          {/* Match selector */}
          {matches.length > 1 && (
            <select
              value={selectedMatchId}
              onChange={e => setSelectedMatchId(e.target.value)}
              style={{
                background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "8px 16px", color: "#f1f5f9",
                fontSize: 13, outline: "none",
              }}
            >
              {matches.map(m => (
                <option key={m.match_id} value={m.match_id}>
                  {m.other?.full_name ?? "Unnamed"}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Partner header ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.08))",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 20, padding: "20px 24px",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: -8 }}>
            <Avatar name={myName} size={44} />
            <div style={{ marginLeft: -8 }}>
              <Avatar name={otherName} size={44} color="violet" />
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{myName} & {otherName}</p>
            <p style={{ fontSize: 12, color: "#6366f1", marginTop: 2 }}>
              {selectedMatch?.other?.stage ?? "Active collaboration"}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={generateWeeklySummary}
              disabled={aiLoading}
              style={{
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                border: "none", borderRadius: 12, padding: "10px 18px",
                color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                opacity: aiLoading ? 0.6 : 1,
              }}
            >
              {aiLoading ? "Generating..." : "✨ AI Weekly Summary"}
            </button>
          </div>
        </div>

        {/* ── Inactivity Nudge Banner ── */}
        {(myInactiveDays !== null && myInactiveDays >= 5) && (
          <div style={{
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 16, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, color: "#fbbf24" }}>You've been inactive for {myInactiveDays} days</p>
              <p style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>
                Send a message or update a task to keep momentum with {otherName}.
              </p>
            </div>
          </div>
        )}
        {(otherInactiveDays !== null && otherInactiveDays >= 7) && (
          <div style={{
            background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.15)",
            borderRadius: 16, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>👻</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, color: "#fb7185" }}>{otherName} has been inactive for {otherInactiveDays} days</p>
              <p style={{ fontSize: 12, color: "#9f1239", marginTop: 2 }}>
                Consider reaching out via chat to check in.
              </p>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            { key: "both", label: "📊 Both Founders" },
            { key: "my", label: "🔒 My Activity" },
            { key: "agreement", label: "📄 Agreement" },
            { key: "ai", label: "✨ AI Insights" },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: tab === t.key
                  ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                  : "rgba(255,255,255,0.04)",
                border: tab === t.key ? "none" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "9px 18px",
                color: tab === t.key ? "#fff" : "#94a3b8",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loadingData && (
          <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Loading data...</div>
        )}

        {/* ═══════════════════ TAB: BOTH FOUNDERS ════════════════════ */}
        {!loadingData && tab === "both" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Top stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <StatCard label="Total Tasks" value={tasks.length} sub={`${tasks.filter(t => t.status === "done").length} completed`} />
              <StatCard label="Messages Sent" value={messages.length} sub="in this match" accent="#7c3aed" />
              <StatCard label="Blocked Tasks" value={tasks.filter(t => t.status === "blocked").length} sub="need attention" accent="#f43f5e" />
              <StatCard
                label="Agreement"
                value={agreement?.status === "finalized" ? "✓" : "Draft"}
                sub={agreement ? agreement.project_name ?? "In progress" : "Not started"}
                accent={agreement?.status === "finalized" ? "#10b981" : "#f59e0b"}
              />
            </div>

            {/* Task breakdown per founder */}
            <div>
              <SectionTitle>Task Breakdown</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <TaskBar tasks={tasks} userId={me} label={`${myName} (You)`} />
                <TaskBar tasks={tasks} userId={otherId} label={otherName} />
              </div>
            </div>

            {/* Recent activity */}
            <div>
              <SectionTitle>Recent Activity</SectionTitle>
              <Card>
                {tasks.length === 0 && messages.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                    No activity yet. Create tasks or send messages to get started.
                  </p>
                ) : (
                  <div>
                    {[...tasks]
                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                      .slice(0, 6)
                      .map(t => (
                        <ActivityRow
                          key={t.id}
                          icon={t.status === "done" ? "✅" : t.status === "blocked" ? "🚧" : t.status === "in_progress" ? "⚡" : "📋"}
                          text={`${t.title} — ${t.status.replace("_", " ")} (${t.assigned_to === me ? myName : otherName})`}
                          time={fmtDate(t.updated_at)}
                        />
                      ))}
                    {messages.slice(0, 3).map(m => (
                      <ActivityRow
                        key={m.id}
                        icon="💬"
                        text={`Message from ${m.sender_id === me ? myName : otherName}`}
                        time={fmtDate(m.created_at)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Last active */}
            <div>
              <SectionTitle>Last Seen Active</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Avatar name={myName} size={32} />
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>{myName} (You)</p>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: myInactiveDays !== null && myInactiveDays >= 5 ? "#f59e0b" : "#34d399" }}>
                    {myInactiveDays === null ? "—" : myInactiveDays === 0 ? "Today" : `${myInactiveDays}d ago`}
                  </p>
                  <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                    {myMessages.length} messages · {myTasks.length} tasks
                  </p>
                </Card>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Avatar name={otherName} size={32} color="violet" />
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>{otherName}</p>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: otherInactiveDays !== null && otherInactiveDays >= 7 ? "#f43f5e" : "#34d399" }}>
                    {otherInactiveDays === null ? "—" : otherInactiveDays === 0 ? "Today" : `${otherInactiveDays}d ago`}
                  </p>
                  <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                    {otherMessages.length} messages · {otherTasks.length} tasks
                  </p>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ TAB: MY ACTIVITY (private) ════════════════════ */}
        {!loadingData && tab === "my" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{
              background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 14, padding: "12px 18px", fontSize: 13, color: "#a5b4fc",
            }}>
              🔒 This tab shows only your private activity. Your cofounder cannot see this view.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <StatCard label="My Tasks" value={myTasks.length} sub={`${myDone} done`} />
              <StatCard label="I Sent" value={myMessages.length} sub="messages" accent="#7c3aed" />
              <StatCard
                label="My Blocked"
                value={myTasks.filter(t => t.status === "blocked").length}
                accent="#f43f5e"
              />
              <StatCard
                label="Completion"
                value={myTasks.length > 0 ? `${Math.round((myDone / myTasks.length) * 100)}%` : "—"}
                accent="#10b981"
              />
            </div>

            <div>
              <SectionTitle>My Tasks</SectionTitle>
              {myTasks.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: "#475569", textAlign: "center", padding: "20px 0" }}>
                    No tasks assigned to you yet. Head to Tasks to create some.
                  </p>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {myTasks
                    .sort((a, b) => {
                      const order = { blocked: 0, in_progress: 1, todo: 2, done: 3 };
                      return order[a.status] - order[b.status];
                    })
                    .map(t => (
                      <Card key={t.id} style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 16 }}>
                            {t.status === "done" ? "✅" : t.status === "blocked" ? "🚧" : t.status === "in_progress" ? "⚡" : "📋"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{t.title}</p>
                            {t.due_date && (
                              <p style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Due {t.due_date}</p>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Pill color={t.status === "done" ? "emerald" : t.status === "blocked" ? "rose" : t.status === "in_progress" ? "indigo" : "zinc"}>
                              {t.status.replace("_", " ")}
                            </Pill>
                            <Pill color={t.priority === "high" ? "rose" : t.priority === "medium" ? "amber" : "zinc"}>
                              {t.priority}
                            </Pill>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
            </div>

            <div>
              <SectionTitle>My Message History</SectionTitle>
              <Card>
                <p style={{ fontSize: 13, color: "#475569" }}>
                  You've sent <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{myMessages.length}</span> messages in this collaboration.
                  {lastMyMessage && (
                    <> Last message: <span style={{ color: "#a5b4fc" }}>{fmtDate(lastMyMessage)}</span></>
                  )}
                </p>
                {myInactiveDays !== null && myInactiveDays >= 3 && (
                  <div style={{
                    marginTop: 12, background: "rgba(245,158,11,0.08)",
                    borderRadius: 10, padding: "10px 14px",
                  }}>
                    <p style={{ fontSize: 13, color: "#fbbf24" }}>
                      💡 You haven't been active in {myInactiveDays} days. Consider sending an update.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ═══════════════════ TAB: AGREEMENT ════════════════════ */}
        {!loadingData && tab === "agreement" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {!agreement ? (
              <Card>
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 40, marginBottom: 12 }}>📄</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>No Agreement Yet</p>
                  <p style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
                    You and {otherName} haven't created a founder agreement yet.
                  </p>
                  <a href="/workspace/agreement" style={{
                    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                    borderRadius: 12, padding: "10px 20px",
                    color: "#fff", fontWeight: 600, fontSize: 13,
                    textDecoration: "none", display: "inline-block",
                  }}>
                    Create Agreement →
                  </a>
                </div>
              </Card>
            ) : (
              <>
                {/* Agreement header */}
                <Card>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#475569", marginBottom: 6 }}>
                        Founder Agreement
                      </p>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
                        {agreement.agreement_title ?? "Untitled Agreement"}
                      </h3>
                      <p style={{ fontSize: 13, color: "#6366f1", marginTop: 4 }}>
                        {agreement.project_name ?? "Unnamed project"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Pill color={agreement.status === "finalized" ? "emerald" : "amber"}>
                        {agreement.status}
                      </Pill>
                      <p style={{ fontSize: 11, color: "#475569" }}>
                        Updated {fmtDate(agreement.updated_at)}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Key terms */}
                <div>
                  <SectionTitle>Key Terms</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Founder A Role", value: agreement.founder_a_role },
                      { label: "Founder B Role", value: agreement.founder_b_role },
                      { label: "Equity", value: agreement.equity_expectations },
                      { label: "Time Commitment", value: agreement.time_commitment },
                      { label: "Decision Style", value: agreement.decision_style },
                      { label: "Conflict Handling", value: agreement.conflict_handling },
                    ].map(item => (
                      <Card key={item.label} style={{ padding: "14px 18px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", marginBottom: 6 }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: 13, color: item.value ? "#cbd5e1" : "#334155" }}>
                          {item.value ?? "Not defined"}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* AI Summary */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <SectionTitle>AI Summary</SectionTitle>
                    <button
                      onClick={generateAgreementSummary}
                      disabled={aiAgreementLoading}
                      style={{
                        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                        border: "none", borderRadius: 10, padding: "7px 14px",
                        color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer",
                        opacity: aiAgreementLoading ? 0.6 : 1,
                      }}
                    >
                      {aiAgreementLoading ? "Summarizing..." : "✨ Generate AI Summary"}
                    </button>
                  </div>
                  <Card>
                    {!aiAgreementSummary ? (
                      <p style={{ fontSize: 13, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                        Click "Generate AI Summary" to get a plain-language breakdown of your agreement.
                      </p>
                    ) : (
                      <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                        {aiAgreementSummary}
                      </div>
                    )}
                  </Card>
                </div>

                {/* Milestones */}
                {agreement.milestones && (
                  <div>
                    <SectionTitle>Milestones</SectionTitle>
                    <Card>
                      <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                        {agreement.milestones}
                      </p>
                    </Card>
                  </div>
                )}

                <a href="/workspace/agreement" style={{
                  display: "inline-block", fontSize: 13, color: "#6366f1",
                  textDecoration: "none", fontWeight: 600,
                }}>
                  ✏️ Edit agreement →
                </a>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════ TAB: AI INSIGHTS ════════════════════ */}
        {tab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={generateWeeklySummary}
                disabled={aiLoading}
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none", borderRadius: 12, padding: "10px 20px",
                  color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  opacity: aiLoading ? 0.6 : 1,
                }}
              >
                {aiLoading ? "⏳ Generating..." : "✨ Generate Weekly Summary"}
              </button>
            </div>

            {aiLoading && (
              <Card>
                <div style={{ textAlign: "center", padding: "32px 0", color: "#475569" }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>✨</p>
                  <p>Analyzing your collaboration data...</p>
                </div>
              </Card>
            )}

            {!aiLoading && !aiSummary && (
              <Card>
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 40, marginBottom: 12 }}>🤖</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>AI Weekly Insights</p>
                  <p style={{ fontSize: 13, color: "#475569" }}>
                    Generate a summary of this week's collaboration, personalized nudges for each founder, and a collaboration health score.
                  </p>
                </div>
              </Card>
            )}

            {aiSummary && !aiLoading && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>✨</span>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>AI Weekly Summary</p>
                  <Pill color="indigo">Claude AI</Pill>
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                  {aiSummary}
                </div>
              </Card>
            )}

            {/* Static nudge cards based on data */}
            <div>
              <SectionTitle>Automatic Nudges</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tasks.filter(t => t.status === "blocked").length > 0 && (
                  <Card style={{ borderColor: "rgba(244,63,94,0.2)" }}>
                    <p style={{ fontSize: 13, color: "#fb7185", fontWeight: 600 }}>
                      🚧 {tasks.filter(t => t.status === "blocked").length} blocked task(s) need attention
                    </p>
                    <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Review blocked tasks in the Tasks board and unblock them together.
                    </p>
                  </Card>
                )}
                {tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length > 0 && (
                  <Card style={{ borderColor: "rgba(245,158,11,0.2)" }}>
                    <p style={{ fontSize: 13, color: "#fbbf24", fontWeight: 600 }}>
                      ⏰ {tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length} overdue task(s)
                    </p>
                    <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Some tasks have passed their due date. Update them or reschedule.
                    </p>
                  </Card>
                )}
                {!agreement && (
                  <Card style={{ borderColor: "rgba(99,102,241,0.2)" }}>
                    <p style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>
                      📄 No founder agreement yet
                    </p>
                    <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Defining roles, equity and working style early prevents conflict.{" "}
                      <a href="/workspace/agreement" style={{ color: "#6366f1" }}>Create one now →</a>
                    </p>
                  </Card>
                )}
                {messages.length === 0 && (
                  <Card style={{ borderColor: "rgba(16,185,129,0.15)" }}>
                    <p style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>
                      💬 No messages yet
                    </p>
                    <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Start a conversation with {otherName} in Chat.
                    </p>
                  </Card>
                )}
                {tasks.filter(t => t.status !== "done").length === 0 && tasks.length > 0 && (
                  <Card style={{ borderColor: "rgba(16,185,129,0.2)" }}>
                    <p style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>
                      🎉 All tasks completed!
                    </p>
                    <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Great work. Head to the Tasks board to add the next sprint.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}