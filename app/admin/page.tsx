"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ══════════════════════════════════════════════════
// PUT YOUR ADMIN EMAIL(S) HERE — hardcoded, no env needed
// ══════════════════════════════════════════════════
const ADMIN_EMAILS = [
  "utkarshj1107@gmail.com",
  "ujain@charlotte.edu",
];

type Applicant = {
  id: string; full_name: string; role: string; company: string;
  linkedin_url: string; why_join: string; status: string; applied_at: string;
  flag_count: number; is_banned: boolean;
};

type Flag = {
  id: string; flagged_user_id: string; reason: string; severity: string;
  auto_detected: boolean; reviewed: boolean; action_taken: string;
  created_at: string; reporter_id: string;
};

export default function AdminPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [tab, setTab] = useState<"applications" | "flags" | "banned">("applications");

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [appFilter, setAppFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagFilter, setFlagFilter] = useState<"unreviewed" | "all">("unreviewed");

  const [bannedUsers, setBannedUsers] = useState<Applicant[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push("/"); return; }

      const email = userData.user.email?.toLowerCase() || "";
      setCurrentEmail(email);

      if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
        router.push("/home");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    })();
  }, [supabase, router]);

  useEffect(() => {
    if (!isAdmin || tab !== "applications") return;
    (async () => {
      let query = supabase.from("profiles")
        .select("id, full_name, role, company, linkedin_url, why_join, status, applied_at, flag_count, is_banned")
        .order("applied_at", { ascending: false });
      if (appFilter !== "all") query = query.eq("status", appFilter);
      const { data } = await query;
      setApplicants(data || []);
    })();
  }, [isAdmin, tab, appFilter, supabase]);

  useEffect(() => {
    if (!isAdmin || tab !== "flags") return;
    (async () => {
      let query = supabase.from("content_flags")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (flagFilter === "unreviewed") query = query.eq("reviewed", false);
      const { data } = await query;
      setFlags(data || []);
    })();
  }, [isAdmin, tab, flagFilter, supabase]);

  useEffect(() => {
    if (!isAdmin || tab !== "banned") return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, role, company, linkedin_url, why_join, status, applied_at, flag_count, is_banned")
        .eq("is_banned", true);
      setBannedUsers(data || []);
    })();
  }, [isAdmin, tab, supabase]);

  async function handleAppAction(userId: string, action: "approved" | "rejected") {
    setActionLoading(userId);
    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    if (res.ok) {
      setApplicants(prev => prev.map(a => a.id === userId ? { ...a, status: action } : a));
    } else {
      const d = await res.json();
      alert(d.error || "Failed");
    }
    setActionLoading(null);
  }

  async function handleResolveFlag(flagId: string, action: string) {
    setActionLoading(flagId);
    await supabase.from("content_flags").update({
      reviewed: true, action_taken: action, reviewed_at: new Date().toISOString(),
    }).eq("id", flagId);
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

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-muted)" }}>Loading admin...</div>;
  }
  if (!isAdmin) return null;

  const badge = (color: string, text: string) => (
    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", padding: "4px 10px", borderRadius: 6, letterSpacing: "0.04em", background: `${color}18`, color }}>{text}</span>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "32px 40px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Admin Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Logged in as {currentEmail}</p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {([
            { key: "applications" as const, label: "Applications" },
            { key: "flags" as const, label: "Flagged Content" },
            { key: "banned" as const, label: "Banned Users" },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === t.key ? "var(--accent-soft)" : "transparent", color: tab === t.key ? "var(--accent)" : "var(--text-muted)" }}
            >{t.label}</button>
          ))}
        </div>

        {/* ═══ APPLICATIONS ═══ */}
        {tab === "applications" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["pending", "approved", "rejected", "all"] as const).map(f => (
                <button key={f} onClick={() => setAppFilter(f)}
                  style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", border: `1px solid ${appFilter === f ? "var(--accent-border)" : "var(--border)"}`, background: appFilter === f ? "var(--accent-soft)" : "transparent", color: appFilter === f ? "var(--accent)" : "var(--text-muted)" }}
                >{f}</button>
              ))}
            </div>
            {applicants.length === 0 ? (
              <div style={{ background: "#1a1b23", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>No {appFilter === "all" ? "" : appFilter} applications.</p>
              </div>
            ) : applicants.map(a => (
              <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{a.full_name || "No name"}</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{a.role || "No role"}{a.company ? ` · ${a.company}` : ""}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {a.flag_count > 0 && badge("var(--amber)", `${a.flag_count} flags`)}
                    {badge(a.status === "approved" ? "var(--green)" : a.status === "rejected" ? "#dc2626" : "var(--amber)", a.status)}
                  </div>
                </div>
                {a.why_join && <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>{a.why_join}</p>}
                {a.linkedin_url && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>LinkedIn: <a href={a.linkedin_url} target="_blank" style={{ color: "var(--accent)" }}>{a.linkedin_url}</a></p>}
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Applied: {a.applied_at ? new Date(a.applied_at).toLocaleDateString() : "N/A"}</p>
                {a.status === "pending" && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleAppAction(a.id, "approved")} disabled={actionLoading === a.id}
                      style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--green)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: actionLoading === a.id ? 0.5 : 1 }}
                    >{actionLoading === a.id ? "..." : "Approve"}</button>
                    <button onClick={() => handleAppAction(a.id, "rejected")} disabled={actionLoading === a.id}
                      style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >Reject</button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ═══ FLAGS ═══ */}
        {tab === "flags" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["unreviewed", "all"] as const).map(f => (
                <button key={f} onClick={() => setFlagFilter(f)}
                  style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", border: `1px solid ${flagFilter === f ? "rgba(220,38,38,0.2)" : "var(--border)"}`, background: flagFilter === f ? "rgba(220,38,38,0.06)" : "transparent", color: flagFilter === f ? "#dc2626" : "var(--text-muted)" }}
                >{f}</button>
              ))}
            </div>
            {flags.length === 0 ? (
              <div style={{ background: "#1a1b23", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>No flagged content.</p>
              </div>
            ) : flags.map(f => (
              <div key={f.id} style={{ background: "var(--surface)", border: `1px solid ${f.severity === "critical" ? "rgba(220,38,38,0.2)" : "var(--border)"}`, borderRadius: 14, padding: 24, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{f.reason}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>User: {f.flagged_user_id.slice(0, 8)}... · {f.auto_detected ? "Auto-detected" : "User report"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {badge(f.severity === "critical" || f.severity === "high" ? "#dc2626" : "var(--amber)", f.severity)}
                    {f.reviewed && badge("var(--green)", "Reviewed")}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{new Date(f.created_at).toLocaleString()}</p>
                {!f.reviewed && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleResolveFlag(f.id, "warning_sent")}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--amber-border)", background: "var(--amber-soft)", color: "var(--amber)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >Warn</button>
                    <button onClick={() => handleBanFromFlag(f.id, f.flagged_user_id)}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >Ban</button>
                    <button onClick={() => handleResolveFlag(f.id, "dismissed")}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >Dismiss</button>
                  </div>
                )}
                {f.reviewed && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Action: {f.action_taken}</p>}
              </div>
            ))}
          </>
        )}

        {/* ═══ BANNED ═══ */}
        {tab === "banned" && (
          <>
            {bannedUsers.length === 0 ? (
              <div style={{ background: "#1a1b23", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>No banned users.</p>
              </div>
            ) : bannedUsers.map(u => (
              <div key={u.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{u.full_name}</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{u.flag_count} flags</p>
                  </div>
                  <button onClick={() => handleUnban(u.id)} disabled={actionLoading === u.id}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--green-border)", background: "var(--green-soft)", color: "var(--green)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >{actionLoading === u.id ? "..." : "Unban"}</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}