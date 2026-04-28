"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState, useCallback } from "react";
import AppShell from "../../components/AppShell";

type MatchRow = { id: string; user_id: string; candidate_id: string; status: "pending" | "accepted" | "declined"; created_at: string; };
type ProfileRow = { id: string; full_name: string | null; bio?: string | null; stage?: string | null; };
type AcceptedMatch = { match_id: string; founder_a_id: string; founder_b_id: string; other_id: string; other: ProfileRow | null; };
type TaskRow = { id: string; match_id: string; title: string; status: "todo" | "in_progress" | "blocked" | "done"; priority: "low" | "medium" | "high"; assigned_to: string | null; due_date: string | null; updated_at: string; created_at: string; };
type MessageRow = { id: string; sender_id: string; created_at: string; };
type AgreementRow = { id: string; match_id: string; agreement_title: string | null; project_name: string | null; founder_a_role: string | null; founder_b_role: string | null; equity_expectations: string | null; time_commitment: string | null; milestones: string | null; decision_style: string | null; conflict_handling: string | null; status: "draft" | "finalized"; updated_at: string; };
type Tab = "my" | "both" | "agreement" | "insights";

function fmtDate(ts: string) { try { return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); } catch { return ts; } }
function daysSince(ts: string | null) { if (!ts) return null; return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24)); }
function initials(name: string | null | undefined) { if (!name) return "?"; return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase(); }

const cardStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow-sm)" };

function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.35, border: "2px solid var(--accent-border)", flexShrink: 0 }}>{initials(name)}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 12 }}>{children}</p>;
}

function StatusDot({ status }: { status: string }) {
  const color = { todo: "var(--text-muted)", in_progress: "var(--accent)", blocked: "var(--amber)", done: "var(--green)" }[status] || "var(--text-muted)";
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
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
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Avatar name={label} size={32} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{label}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{total} tasks assigned</p>
        </div>
        <span className="pill" style={{ color: pct === 100 ? "var(--green)" : "var(--accent)" }}>{pct}% done</span>
      </div>
      <div className="progress-track" style={{ marginBottom: 12 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {todo > 0 && <span className="pill">{todo} todo</span>}
        {inProgress > 0 && <span className="pill" style={{ color: "var(--accent)" }}>{inProgress} in progress</span>}
        {blocked > 0 && <span className="pill" style={{ color: "var(--amber)" }}>{blocked} blocked</span>}
        {done > 0 && <span className="pill" style={{ color: "var(--green)" }}>{done} done</span>}
        {total === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No tasks assigned yet</p>}
      </div>
    </div>
  );
}

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
  const [aiAgreementSummary, setAiAgreementSummary] = useState<string | null>(null);
  const [aiAgreementLoading, setAiAgreementLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingMatches(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoadingMatches(false); return; }
      setMe(user.id);
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (prof?.full_name) setMyName(prof.full_name);
      const { data: acc } = await supabase.from("matches").select("id,user_id,candidate_id,status,created_at").eq("status", "accepted");
      const myMatches = ((acc as MatchRow[]) ?? []).filter(m => m.user_id === user.id || m.candidate_id === user.id);
      const otherIds = Array.from(new Set(myMatches.map(m => m.user_id === user.id ? m.candidate_id : m.user_id)));
      let otherProfiles: ProfileRow[] = [];
      if (otherIds.length > 0) { const { data: profs } = await supabase.from("profiles").select("id,full_name,bio,stage").in("id", otherIds); otherProfiles = (profs as ProfileRow[]) ?? []; }
      const hydrated = myMatches.map(m => { const otherId = m.user_id === user.id ? m.candidate_id : m.user_id; return { match_id: m.id, founder_a_id: m.user_id, founder_b_id: m.candidate_id, other_id: otherId, other: otherProfiles.find(p => p.id === otherId) ?? null }; });
      setMatches(hydrated);
      if (hydrated[0]) setSelectedMatchId(hydrated[0].match_id);
      setLoadingMatches(false);
    })();
  }, [supabase]);

  const loadMatchData = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setLoadingData(true); setAiSummary(null); setAiAgreementSummary(null);
    const [tasksRes, agreementRes] = await Promise.all([
      supabase.from("founder_tasks").select("id,match_id,title,status,priority,assigned_to,due_date,updated_at,created_at").eq("match_id", matchId),
      supabase.from("founder_agreements").select("*").eq("match_id", matchId).maybeSingle(),
    ]);
    setTasks((tasksRes.data as TaskRow[]) ?? []); setAgreement((agreementRes.data as AgreementRow) ?? null);
    const { data: chatRow } = await supabase.from("chats").select("id").eq("match_id", matchId).maybeSingle();
    if (chatRow?.id) { const { data: msgs } = await supabase.from("messages").select("id,sender_id,created_at").eq("chat_id", chatRow.id).order("created_at", { ascending: false }).limit(100); setMessages((msgs as MessageRow[]) ?? []); } else { setMessages([]); }
    setLoadingData(false);
  }, [supabase]);

  useEffect(() => { if (selectedMatchId) loadMatchData(selectedMatchId); }, [selectedMatchId, loadMatchData]);

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

  async function generateWeeklySummary() {
    if (!selectedMatch) return;
    setAiLoading(true); setTab("insights");
    const taskSummary = tasks.map(t => `${t.title} [${t.status}] assigned to ${t.assigned_to === me ? myName : otherName}`).join("\n");
    const prompt = `You are an assistant for a cofounder collaboration tool.\n\nMATCH: ${myName} <> ${otherName}\nTASKS (${tasks.length}):\n${taskSummary || "No tasks"}\nMESSAGES: ${myName} sent ${myMessages.length}, ${otherName} sent ${otherMessages.length}\nAGREEMENT: ${agreement?.status ?? "Not created"}\nMY DONE: ${myDone}/${myTasks.length}\nCOFOUNDER DONE: ${otherDone}/${otherTasks.length}\n\nGenerate:\n1. 3-4 sentence weekly summary\n2. One action item per founder\n3. Collaboration score 1-10`;
    try {
      const res = await fetch("/api/checkins-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, type: "weekly_summary" }) });
      const json = await res.json();
      setAiSummary(json.ok ? json.text ?? "" : "Failed to generate summary.");
    } catch { setAiSummary("Network error."); }
    setAiLoading(false);
  }

  async function generateAgreementSummary() {
    if (!agreement) return;
    setAiAgreementLoading(true); setTab("agreement");
    const prompt = `Summarize this founder agreement:\nProject: ${agreement.project_name ?? "Unnamed"}\nRoles: ${agreement.founder_a_role ?? "?"} / ${agreement.founder_b_role ?? "?"}\nEquity: ${agreement.equity_expectations ?? "?"}\nTime: ${agreement.time_commitment ?? "?"}\nDecisions: ${agreement.decision_style ?? "?"}\nConflict: ${agreement.conflict_handling ?? "?"}\nMilestones: ${agreement.milestones ?? "?"}\nStatus: ${agreement.status}\n\nProvide: 1. 2-3 sentence summary 2. Key commitments 3. Gaps`;
    try {
      const res = await fetch("/api/checkins-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, type: "agreement_summary" }) });
      const json = await res.json();
      setAiAgreementSummary(json.ok ? json.text ?? "" : "Failed.");
    } catch { setAiAgreementSummary("Network error."); }
    setAiAgreementLoading(false);
  }

  if (loadingMatches) return <AppShell title="Check-ins"><div style={{ color: "var(--text-muted)", padding: 40 }}>Loading your matches...</div></AppShell>;

  if (matches.length === 0) return (
    <AppShell title="Check-ins">
      <div style={{ ...cardStyle, textAlign: "center", padding: 60, maxWidth: 600, margin: "0 auto" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No accepted matches yet</p>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Check-ins unlock after a founder match is accepted.</p>
      </div>
    </AppShell>
  );

  const tabBtn = (key: Tab, label: string) => (
    <button key={key} onClick={() => setTab(key)}
      style={{ background: tab === key ? "var(--accent)" : "var(--surface)", border: tab === key ? "none" : "1px solid var(--border)", borderRadius: "var(--radius)", padding: "9px 18px", color: tab === key ? "#fff" : "var(--text-muted)", fontWeight: 700, fontSize: 13, boxShadow: tab === key ? "var(--shadow-sm)" : "none" }}>
      {label}
    </button>
  );

  return (
    <AppShell title="Check-ins">
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Collaboration dashboard — only visible to you and your cofounder</p>

        {/* Partner header */}
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Avatar name={myName} size={44} />
            <div style={{ marginLeft: -8 }}><Avatar name={otherName} size={44} /></div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{myName} & {otherName}</p>
            <p style={{ fontSize: 12, color: "var(--accent)", marginTop: 2 }}>{selectedMatch?.other?.stage ?? "Active collaboration"}</p>
          </div>
          {matches.length > 1 && (
            <select value={selectedMatchId} onChange={e => setSelectedMatchId(e.target.value)} style={{ padding: "8px 16px" }}>
              {matches.map(m => <option key={m.match_id} value={m.match_id}>{m.other?.full_name ?? "Unnamed"}</option>)}
            </select>
          )}
          <button onClick={generateWeeklySummary} disabled={aiLoading}
            style={{ background: "var(--accent)", border: "none", borderRadius: "var(--radius)", padding: "10px 18px", color: "#fff", fontWeight: 600, fontSize: 13, opacity: aiLoading ? 0.6 : 1 }}>
            {aiLoading ? "Generating..." : "Weekly Summary"}
          </button>
        </div>

        {/* Inactivity nudges */}
        {myInactiveDays !== null && myInactiveDays >= 5 && (
          <div style={{ background: "var(--amber-soft)", border: "1px solid var(--amber-border)", borderLeft: "3px solid var(--amber)", borderRadius: "var(--radius)", padding: "14px 20px" }}>
            <p style={{ fontWeight: 600, fontSize: 13, color: "var(--amber)" }}>You've been inactive for {myInactiveDays} days</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Send a message or update a task to keep momentum with {otherName}.</p>
          </div>
        )}
        {otherInactiveDays !== null && otherInactiveDays >= 7 && (
          <div style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)", borderLeft: "3px solid #dc2626", borderRadius: "var(--radius)", padding: "14px 20px" }}>
            <p style={{ fontWeight: 600, fontSize: 13, color: "#dc2626" }}>{otherName} has been inactive for {otherInactiveDays} days</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Consider reaching out via chat to check in.</p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabBtn("both", "Both Founders")}
          {tabBtn("my", "My Activity")}
          {tabBtn("agreement", "Agreement")}
          {tabBtn("insights", "Insights")}
        </div>

        {loadingData && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading data...</div>}

        {/* ═══ BOTH FOUNDERS ═══ */}
        {!loadingData && tab === "both" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <div className="stat-card"><p className="stat-label">Total Tasks</p><p className="stat-value" style={{ fontSize: 28 }}>{tasks.length}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>{tasks.filter(t => t.status === "done").length} completed</p></div>
              <div className="stat-card"><p className="stat-label">Messages</p><p className="stat-value" style={{ fontSize: 28 }}>{messages.length}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>in this match</p></div>
              <div className="stat-card"><p className="stat-label">Blocked</p><p className="stat-value" style={{ fontSize: 28, color: "var(--amber)" }}>{tasks.filter(t => t.status === "blocked").length}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>need attention</p></div>
              <div className="stat-card"><p className="stat-label">Agreement</p><p className="stat-value" style={{ fontSize: 28, color: agreement?.status === "finalized" ? "var(--green)" : "var(--amber)" }}>{agreement?.status === "finalized" ? "Done" : "Draft"}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>{agreement ? agreement.project_name ?? "In progress" : "Not started"}</p></div>
            </div>

            <div>
              <SectionLabel>Task Breakdown</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <TaskBar tasks={tasks} userId={me} label={`${myName} (You)`} />
                <TaskBar tasks={tasks} userId={otherId} label={otherName} />
              </div>
            </div>

            <div>
              <SectionLabel>Recent Activity</SectionLabel>
              <div style={cardStyle}>
                {tasks.length === 0 && messages.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No activity yet. Create tasks or send messages to get started.</p>
                ) : [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-sub)" }}>
                    <StatusDot status={t.status} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.title} — {t.status.replace("_", " ")}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.assigned_to === me ? myName : otherName} · {fmtDate(t.updated_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Last Seen Active</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[{ name: `${myName} (You)`, days: myInactiveDays, msgs: myMessages.length, taskCount: myTasks.length }, { name: otherName, days: otherInactiveDays, msgs: otherMessages.length, taskCount: otherTasks.length }].map((person, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Avatar name={person.name} size={32} />
                      <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{person.name}</p>
                    </div>
                    <p style={{ fontSize: 22, fontWeight: 800, color: person.days !== null && person.days >= 5 ? "var(--amber)" : "var(--green)" }}>
                      {person.days === null ? "—" : person.days === 0 ? "Today" : `${person.days}d ago`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{person.msgs} messages · {person.taskCount} tasks</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MY ACTIVITY ═══ */}
        {!loadingData && tab === "my" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius)", padding: "12px 18px", fontSize: 13, color: "var(--accent)" }}>
              This tab shows only your private activity. Your cofounder cannot see this view.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <div className="stat-card"><p className="stat-label">My Tasks</p><p className="stat-value" style={{ fontSize: 28 }}>{myTasks.length}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>{myDone} done</p></div>
              <div className="stat-card"><p className="stat-label">I Sent</p><p className="stat-value" style={{ fontSize: 28 }}>{myMessages.length}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>messages</p></div>
              <div className="stat-card"><p className="stat-label">My Blocked</p><p className="stat-value" style={{ fontSize: 28, color: "#dc2626" }}>{myTasks.filter(t => t.status === "blocked").length}</p></div>
              <div className="stat-card"><p className="stat-label">Completion</p><p className="stat-value" style={{ fontSize: 28, color: "var(--green)" }}>{myTasks.length > 0 ? `${Math.round((myDone / myTasks.length) * 100)}%` : "—"}</p></div>
            </div>

            <div>
              <SectionLabel>My Tasks</SectionLabel>
              {myTasks.length === 0 ? (
                <div style={cardStyle}><p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No tasks assigned to you yet.</p></div>
              ) : myTasks.sort((a, b) => ({ blocked: 0, in_progress: 1, todo: 2, done: 3 }[a.status] - { blocked: 0, in_progress: 1, todo: 2, done: 3 }[b.status])).map(t => (
                <div key={t.id} style={{ ...cardStyle, padding: "14px 18px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StatusDot status={t.status} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.title}</p>
                      {t.due_date && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Due {t.due_date}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="pill" style={{ color: { todo: "var(--text-muted)", in_progress: "var(--accent)", blocked: "var(--amber)", done: "var(--green)" }[t.status] }}>{t.status.replace("_", " ")}</span>
                      <span className="pill" style={{ color: { low: "var(--text-muted)", medium: "var(--accent)", high: "#dc2626" }[t.priority] }}>{t.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ AGREEMENT ═══ */}
        {!loadingData && tab === "agreement" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {!agreement ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: 60 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No agreement yet</p>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>You and {otherName} haven't created a founder agreement yet.</p>
                <a href="/workspace/agreement" style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius)", padding: "10px 20px", fontWeight: 600, fontSize: 13, textDecoration: "none", display: "inline-block" }}>Create Agreement</a>
              </div>
            ) : (
              <>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 6 }}>Founder Agreement</p>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{agreement.agreement_title ?? "Untitled"}</h3>
                      <p style={{ fontSize: 13, color: "var(--accent)", marginTop: 4 }}>{agreement.project_name ?? "Unnamed project"}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={`pill pill-${agreement.status === "finalized" ? "green" : "amber"}`}>{agreement.status}</span>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Updated {fmtDate(agreement.updated_at)}</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  {[["Founder A Role", agreement.founder_a_role], ["Founder B Role", agreement.founder_b_role], ["Equity", agreement.equity_expectations], ["Time Commitment", agreement.time_commitment], ["Decision Style", agreement.decision_style], ["Conflict Handling", agreement.conflict_handling]].map(([label, value]) => (
                    <div key={label} style={{ ...cardStyle, padding: "14px 18px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 6 }}>{label}</p>
                      <p style={{ fontSize: 13, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>{(value as string) ?? "Not defined"}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionLabel>Summary</SectionLabel>
                  <button onClick={generateAgreementSummary} disabled={aiAgreementLoading} style={{ background: "var(--accent)", border: "none", borderRadius: "var(--radius)", padding: "7px 14px", color: "#fff", fontWeight: 600, fontSize: 12, opacity: aiAgreementLoading ? 0.6 : 1 }}>
                    {aiAgreementLoading ? "Summarizing..." : "Generate Summary"}
                  </button>
                </div>
                <div style={cardStyle}>
                  {!aiAgreementSummary ? (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>Click "Generate Summary" to get a plain-language breakdown.</p>
                  ) : <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiAgreementSummary}</div>}
                </div>
                <a href="/workspace/agreement" style={{ fontSize: 13, fontWeight: 600 }}>Edit agreement →</a>
              </>
            )}
          </div>
        )}

        {/* ═══ INSIGHTS ═══ */}
        {tab === "insights" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <button onClick={generateWeeklySummary} disabled={aiLoading} style={{ alignSelf: "flex-start", background: "var(--accent)", border: "none", borderRadius: "var(--radius)", padding: "10px 20px", color: "#fff", fontWeight: 600, fontSize: 13, opacity: aiLoading ? 0.6 : 1 }}>
              {aiLoading ? "Generating..." : "Generate Weekly Summary"}
            </button>
            <div style={cardStyle}>
              {aiLoading ? <p style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>Analyzing your collaboration data...</p>
                : !aiSummary ? (
                  <div style={{ textAlign: "center", padding: 32 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Weekly Insights</p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Generate a summary of this week's collaboration, action items, and a health score.</p>
                  </div>
                ) : <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{aiSummary}</div>}
            </div>

            <SectionLabel>Automatic Nudges</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.filter(t => t.status === "blocked").length > 0 && (
                <div style={{ ...cardStyle, borderLeft: "3px solid var(--amber)" }}>
                  <p style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600 }}>{tasks.filter(t => t.status === "blocked").length} blocked task(s) need attention</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Review blocked tasks and unblock them together.</p>
                </div>
              )}
              {tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length > 0 && (
                <div style={{ ...cardStyle, borderLeft: "3px solid var(--amber)" }}>
                  <p style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600 }}>{tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length} overdue task(s)</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Some tasks have passed their due date.</p>
                </div>
              )}
              {!agreement && (
                <div style={{ ...cardStyle, borderLeft: "3px solid var(--accent)" }}>
                  <p style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>No founder agreement yet</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Defining roles and equity early prevents conflict. <a href="/workspace/agreement">Create one now →</a></p>
                </div>
              )}
              {messages.length === 0 && (
                <div style={{ ...cardStyle, borderLeft: "3px solid var(--green)" }}>
                  <p style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>No messages yet</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Start a conversation with {otherName} in Chat.</p>
                </div>
              )}
              {tasks.filter(t => t.status !== "done").length === 0 && tasks.length > 0 && (
                <div style={{ ...cardStyle, borderLeft: "3px solid var(--green)" }}>
                  <p style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>All tasks completed</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Great work. Head to the Tasks board to add the next sprint.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}