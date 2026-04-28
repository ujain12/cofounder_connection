"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_EMAILS = ["utkarshj1107@gmail.com", "ujain@charlotte.edu"];

type Applicant = { id: string; full_name: string; role: string; company: string; linkedin_url: string; why_join: string; status: string; applied_at: string; flag_count: number; is_banned: boolean; };
type Flag = { id: string; flagged_user_id: string; reason: string; severity: string; auto_detected: boolean; reviewed: boolean; action_taken: string; created_at: string; };
type CostData = {
  totalUsers: number; totalRequests: number; totalApiCost: number;
  totalMargin: number; totalRevenue: number; avgCostPerRequest: number; avgCostPerUser: number;
  modelBreakdown: { model: string; requests: number; totalCost: number; avgTokens: number }[];
  userBreakdown: { userId: string; name: string; requests: number; totalCost: number; totalCharged: number }[];
  dailyTrend: { date: string; requests: number; cost: number }[];
  cascadeSavings: number;
  cacheStats: { entries: number; hits: number; savings: number };
  projections: { monthlyAt100Users: number; monthlyAt500Users: number; monthlyAt1000Users: number; storageGBPerMonth: number; supabaseCost: number; vercelCost: number; totalMonthlyAt100: number; totalMonthlyAt500: number; totalMonthlyAt1000: number; };
  scalingBottlenecks: string[];
  costPerformanceTradeoffs: { strategy: string; savings: string; tradeoff: string }[];
};

export default function AdminPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [tab, setTab] = useState<"applications" | "flags" | "banned" | "costs">("applications");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [appFilter, setAppFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagFilter, setFlagFilter] = useState<"unreviewed" | "all">("unreviewed");
  const [bannedUsers, setBannedUsers] = useState<Applicant[]>([]);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push("/"); return; }
      const email = userData.user.email?.toLowerCase() || "";
      setCurrentEmail(email);
      if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) { router.push("/home"); return; }
      setIsAdmin(true); setLoading(false);
    })();
  }, [supabase, router]);

  useEffect(() => {
    if (!isAdmin || tab !== "applications") return;
    (async () => {
      let q = supabase.from("profiles").select("id, full_name, role, company, linkedin_url, why_join, status, applied_at, flag_count, is_banned").order("applied_at", { ascending: false });
      if (appFilter !== "all") q = q.eq("status", appFilter);
      const { data } = await q; setApplicants(data || []);
    })();
  }, [isAdmin, tab, appFilter, supabase]);

  useEffect(() => {
    if (!isAdmin || tab !== "flags") return;
    (async () => {
      let q = supabase.from("content_flags").select("*").order("created_at", { ascending: false }).limit(50);
      if (flagFilter === "unreviewed") q = q.eq("reviewed", false);
      const { data } = await q; setFlags(data || []);
    })();
  }, [isAdmin, tab, flagFilter, supabase]);

  useEffect(() => {
    if (!isAdmin || tab !== "banned") return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role, company, linkedin_url, why_join, status, applied_at, flag_count, is_banned").eq("is_banned", true);
      setBannedUsers(data || []);
    })();
  }, [isAdmin, tab, supabase]);

  useEffect(() => {
    if (!isAdmin || tab !== "costs") return;
    (async () => {
      setCostLoading(true);
      const res = await fetch("/api/admin/costs");
      if (res.ok) setCostData(await res.json());
      setCostLoading(false);
    })();
  }, [isAdmin, tab]);

  async function handleAppAction(userId: string, action: "approved" | "rejected") {
    setActionLoading(userId);
    const res = await fetch("/api/admin/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action }) });
    if (res.ok) setApplicants(prev => prev.map(a => a.id === userId ? { ...a, status: action } : a));
    setActionLoading(null);
  }

  async function handleResolveFlag(flagId: string, action: string) {
    setActionLoading(flagId);
    await supabase.from("content_flags").update({ reviewed: true, action_taken: action, reviewed_at: new Date().toISOString() }).eq("id", flagId);
    setFlags(prev => prev.map(f => f.id === flagId ? { ...f, reviewed: true, action_taken: action } : f));
    setActionLoading(null);
  }

  async function handleBanFromFlag(flagId: string, userId: string) {
    await handleResolveFlag(flagId, "user_banned");
    await supabase.from("profiles").update({ is_banned: true, banned_reason: "Banned by admin", status: "rejected" }).eq("id", userId);
  }

  async function handleUnban(userId: string) {
    setActionLoading(userId);
    await supabase.from("profiles").update({ is_banned: false, banned_reason: null, flag_count: 0, status: "approved" }).eq("id", userId);
    setBannedUsers(prev => prev.filter(u => u.id !== userId));
    setActionLoading(null);
  }

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-muted)" }}>Loading admin...</div>;
  if (!isAdmin) return null;

  const pill = (color: string, bg: string, border: string, text: string) => (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "3px 10px", borderRadius: "var(--radius-pill)", letterSpacing: "0.04em", background: bg, color, border: `1px solid ${border}` }}>{text}</span>
  );

  const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 12, boxShadow: "var(--shadow-sm)" };
  const filterBtn = (active: boolean) => ({
    padding: "7px 16px", borderRadius: "var(--radius-pill)", fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
    background: active ? "var(--accent-soft)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--text-muted)",
    textTransform: "capitalize" as const,
  });

  const statBox = (label: string, value: string | number, color: string = "var(--accent)") => (
    <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "14px 18px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 48px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>Admin</p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.03em" }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>Logged in as {currentEmail}</p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-deep)", borderRadius: "var(--radius)", padding: 4, border: "1px solid var(--border)" }}>
          {([
            { key: "applications" as const, label: "Applications" },
            { key: "flags" as const, label: "Flagged Content" },
            { key: "banned" as const, label: "Banned Users" },
            { key: "costs" as const, label: "Cost Analytics" },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, background: tab === t.key ? "var(--surface)" : "transparent", color: tab === t.key ? "var(--accent)" : "var(--text-muted)", boxShadow: tab === t.key ? "var(--shadow-sm)" : "none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ APPLICATIONS ═══ */}
        {tab === "applications" && (<>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <button key={f} onClick={() => setAppFilter(f)} style={filterBtn(appFilter === f)}>{f}</button>
            ))}
          </div>
          {applicants.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}><p style={{ color: "var(--text-muted)" }}>No {appFilter === "all" ? "" : appFilter} applications.</p></div>
          ) : applicants.map(a => (
            <div key={a.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{a.full_name || "No name"}</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{a.role || "No role"}{a.company ? ` at ${a.company}` : ""}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {a.flag_count > 0 && pill("var(--amber)", "var(--amber-soft)", "var(--amber-border)", `${a.flag_count} flags`)}
                  {pill(
                    a.status === "approved" ? "var(--green)" : a.status === "rejected" ? "#dc2626" : "var(--amber)",
                    a.status === "approved" ? "var(--green-soft)" : a.status === "rejected" ? "rgba(220,38,38,0.06)" : "var(--amber-soft)",
                    a.status === "approved" ? "var(--green-border)" : a.status === "rejected" ? "rgba(220,38,38,0.2)" : "var(--amber-border)",
                    a.status
                  )}
                </div>
              </div>
              {a.why_join && <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>{a.why_join}</p>}
              {a.linkedin_url && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>LinkedIn: <a href={a.linkedin_url} target="_blank">{a.linkedin_url}</a></p>}
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Applied: {a.applied_at ? new Date(a.applied_at).toLocaleDateString() : "N/A"}</p>
              {a.status === "pending" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleAppAction(a.id, "approved")} disabled={actionLoading === a.id}
                    style={{ padding: "9px 20px", borderRadius: "var(--radius)", border: "none", background: "var(--green)", color: "#fff", fontSize: 13, fontWeight: 700, opacity: actionLoading === a.id ? 0.5 : 1 }}>
                    {actionLoading === a.id ? "..." : "Approve"}</button>
                  <button onClick={() => handleAppAction(a.id, "rejected")} disabled={actionLoading === a.id}
                    style={{ padding: "9px 20px", borderRadius: "var(--radius)", border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 13, fontWeight: 700 }}>
                    Reject</button>
                </div>
              )}
            </div>
          ))}
        </>)}

        {/* ═══ FLAGS ═══ */}
        {tab === "flags" && (<>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["unreviewed", "all"] as const).map(f => (
              <button key={f} onClick={() => setFlagFilter(f)} style={filterBtn(flagFilter === f)}>{f}</button>
            ))}
          </div>
          {flags.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}><p style={{ color: "var(--text-muted)" }}>No flagged content.</p></div>
          ) : flags.map(f => (
            <div key={f.id} style={{ ...cardStyle, borderColor: f.severity === "critical" ? "rgba(220,38,38,0.3)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{f.reason}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>User: {f.flagged_user_id.slice(0, 8)}... · {f.auto_detected ? "Auto-detected" : "User report"}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {pill(f.severity === "critical" || f.severity === "high" ? "#dc2626" : "var(--amber)", f.severity === "critical" || f.severity === "high" ? "rgba(220,38,38,0.06)" : "var(--amber-soft)", f.severity === "critical" || f.severity === "high" ? "rgba(220,38,38,0.2)" : "var(--amber-border)", f.severity)}
                  {f.reviewed && pill("var(--green)", "var(--green-soft)", "var(--green-border)", "Reviewed")}
                </div>
              </div>
              {!f.reviewed && (
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={() => handleResolveFlag(f.id, "warning_sent")} style={{ padding: "8px 16px", borderRadius: "var(--radius)", border: "1px solid var(--amber-border)", background: "var(--amber-soft)", color: "var(--amber)", fontSize: 12, fontWeight: 700 }}>Warn</button>
                  <button onClick={() => handleBanFromFlag(f.id, f.flagged_user_id)} style={{ padding: "8px 16px", borderRadius: "var(--radius)", border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>Ban</button>
                  <button onClick={() => handleResolveFlag(f.id, "dismissed")} style={{ padding: "8px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </>)}

        {/* ═══ BANNED ═══ */}
        {tab === "banned" && (<>
          {bannedUsers.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}><p style={{ color: "var(--text-muted)" }}>No banned users.</p></div>
          ) : bannedUsers.map(u => (
            <div key={u.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{u.full_name}</h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{u.flag_count} flags</p>
                </div>
                <button onClick={() => handleUnban(u.id)} disabled={actionLoading === u.id}
                  style={{ padding: "8px 16px", borderRadius: "var(--radius)", border: "1px solid var(--green-border)", background: "var(--green-soft)", color: "var(--green)", fontSize: 12, fontWeight: 700 }}>
                  {actionLoading === u.id ? "..." : "Unban"}</button>
              </div>
            </div>
          ))}
        </>)}

        {/* ═══ COST ANALYTICS ═══ */}
        {tab === "costs" && (<>
          <button onClick={async () => { setCostLoading(true); await fetch("/api/admin/seed-costs", { method: "POST" }); const res = await fetch("/api/admin/costs"); if (res.ok) setCostData(await res.json()); setCostLoading(false); }}
              style={{ marginBottom: 16, padding: "10px 20px", borderRadius: "var(--radius)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              Generate Demo Data
            </button>
          {costLoading ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}><p style={{ color: "var(--text-muted)" }}>Loading cost analytics...</p></div>
          ) : !costData ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}><p style={{ color: "var(--text-muted)" }}>No cost data available yet. AI features must be used first.</p></div>
          ) : (<>

            {/* Overview stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {statBox("Total Requests", costData.totalRequests)}
              {statBox("Total API Cost", `$${costData.totalApiCost.toFixed(4)}`)}
              {statBox("Your Margin", `$${costData.totalMargin.toFixed(4)}`, "var(--green)")}
              {statBox("Avg / Request", `$${costData.avgCostPerRequest.toFixed(5)}`)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              {statBox("Active Users", costData.totalUsers)}
              {statBox("Avg Cost / User", `$${costData.avgCostPerUser.toFixed(4)}`)}
              {statBox("Cache Savings", `$${costData.cacheStats.savings.toFixed(4)}`, "var(--green)")}
            </div>

            {/* Model Breakdown */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Model Breakdown</h3>
              {costData.modelBreakdown.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No model usage data yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Model", "Requests", "Total Cost", "Avg Tokens"].map(h => (
                        <th key={h} style={{ textAlign: h === "Model" ? "left" : "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {costData.modelBreakdown.map(m => (
                      <tr key={m.model} style={{ borderBottom: "1px solid var(--border-sub)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{m.model}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", textAlign: "right" }}>{m.requests}</td>
                        <td style={{ padding: "10px 12px", color: "var(--accent)", textAlign: "right", fontWeight: 600 }}>${m.totalCost.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", textAlign: "right" }}>{m.avgTokens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Per-User Breakdown */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Per-User Cost Tracking</h3>
              {costData.userBreakdown.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No per-user data yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["User", "Requests", "API Cost", "Charged"].map(h => (
                        <th key={h} style={{ textAlign: h === "User" ? "left" : "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {costData.userBreakdown.map(u => (
                      <tr key={u.userId} style={{ borderBottom: "1px solid var(--border-sub)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", textAlign: "right" }}>{u.requests}</td>
                        <td style={{ padding: "10px 12px", color: "var(--amber)", textAlign: "right" }}>${u.totalCost.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", color: "var(--green)", textAlign: "right", fontWeight: 600 }}>${u.totalCharged.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Projected Costs */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Projected Monthly Costs</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Scale", "AI API Cost", "Supabase", "Vercel", "Total"].map(h => (
                      <th key={h} style={{ textAlign: h === "Scale" ? "left" : "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { scale: "100 users", ai: costData.projections.monthlyAt100Users, supa: costData.projections.supabaseCost, vercel: costData.projections.vercelCost, total: costData.projections.totalMonthlyAt100 },
                    { scale: "500 users", ai: costData.projections.monthlyAt500Users, supa: 25, vercel: 20, total: costData.projections.totalMonthlyAt500 },
                    { scale: "1,000 users", ai: costData.projections.monthlyAt1000Users, supa: 25, vercel: 20, total: costData.projections.totalMonthlyAt1000 },
                  ].map(row => (
                    <tr key={row.scale} style={{ borderBottom: "1px solid var(--border-sub)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{row.scale}</td>
                      <td style={{ padding: "10px 12px", color: "var(--accent)", textAlign: "right" }}>${row.ai.toFixed(2)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", textAlign: "right" }}>${row.supa}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", textAlign: "right" }}>${row.vercel}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-primary)", textAlign: "right", fontWeight: 700 }}>${row.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
                Estimated storage: {costData.projections.storageGBPerMonth} GB/month
              </p>
            </div>

            {/* Cost-Performance Trade-offs */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Cost-Performance Trade-offs</h3>
              {costData.costPerformanceTradeoffs.map((t, i) => (
                <div key={i} style={{ padding: "14px 0", borderBottom: i < costData.costPerformanceTradeoffs.length - 1 ? "1px solid var(--border-sub)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.strategy}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-soft)", border: "1px solid var(--green-border)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>{t.savings}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{t.tradeoff}</p>
                </div>
              ))}
            </div>

            {/* Scaling Bottlenecks */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Scaling Bottlenecks</h3>
              {costData.scalingBottlenecks.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < costData.scalingBottlenecks.length - 1 ? "1px solid var(--border-sub)" : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber)", marginTop: 5, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{b}</p>
                </div>
              ))}
            </div>

            {/* Optimization Strategies Active */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Active Optimization Strategies</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { title: "Response Caching", desc: `${costData.cacheStats.entries} cached entries, ${costData.cacheStats.hits} cache hits`, status: "Active", color: "var(--green)" },
                  { title: "Model Cascade (FrugalGPT)", desc: "Cheap model first, escalate on quality failure", status: "Active", color: "var(--green)" },
                  { title: "Token Limit Caps", desc: "Max 1200 tokens per response to prevent runaway costs", status: "Active", color: "var(--green)" },
                  { title: "10% Revenue Margin", desc: `$${costData.totalMargin.toFixed(4)} earned from ${costData.totalRequests} requests`, status: "Active", color: "var(--green)" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{s.title}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: "var(--green-soft)", border: "1px solid var(--green-border)", borderRadius: "var(--radius-pill)", padding: "2px 8px" }}>{s.status}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </>)}
        </>)}
      </div>
    </div>
  );
}
