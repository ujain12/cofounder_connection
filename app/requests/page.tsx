"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../components/AppShell";

type RequestRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  requester?: {
    id: string;
    full_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    stage: string | null;
    hours_per_week: number | null;
  } | null;
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, url, size = 48 }: { name: string | null; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent-soft, rgba(22,53,214,0.08))",
      border: "2px solid var(--accent-border, rgba(22,53,214,0.2))",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.3, fontWeight: 700, color: "var(--accent, #1635d6)",
    }}>
      {initials(name)}
    </div>
  );
}

export default function RequestsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { loadRequests(); }, []); // eslint-disable-line

  async function loadRequests() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Incoming pending requests sent TO me
    const { data: rows } = await supabase
      .from("matches")
      .select("id, user_id, candidate_id, status, created_at")
      .eq("candidate_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const rawRows = (rows as RequestRow[]) ?? [];

    // Load requester profiles
    const requesterIds = rawRows.map(r => r.user_id);
    let profiles: any[] = [];
    if (requesterIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, bio, avatar_url, stage, hours_per_week")
        .in("id", requesterIds);
      profiles = data ?? [];
    }

    setRequests(rawRows.map(r => ({
      ...r,
      requester: profiles.find(p => p.id === r.user_id) ?? null,
    })));
    setLoading(false);
  }

  async function handleAction(matchId: string, action: "accepted" | "declined") {
    setActing(matchId);
    const { error } = await supabase
      .from("matches")
      .update({ status: action })
      .eq("id", matchId);

    if (error) {
      alert(`Failed to ${action}: ` + error.message);
    } else {
      // Remove from list optimistically
      setRequests(prev => prev.filter(r => r.id !== matchId));
    }
    setActing(null);
  }

  return (
    <AppShell
      eyebrow="Incoming"
      title="Requests"
      subtitle="Founders who want to connect with you."
    >
      <div style={{ maxWidth: 720 }}>

        {/* Refresh button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20, marginTop: -8 }}>
          <button onClick={loadRequests}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Refresh
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2].map(i => (
              <div key={i} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow-sm)",
                display: "flex", gap: 16, alignItems: "center",
              }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--border)", flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, background: "var(--border)", borderRadius: 6, width: "30%", marginBottom: 10 }}/>
                  <div style={{ height: 11, background: "var(--bg-deep)", borderRadius: 6, width: "70%" }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && requests.length === 0 && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "64px 32px", textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
            }}>
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
              No pending requests
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 320, marginBottom: 28 }}>
              When someone likes your profile, their request will appear here. Make sure your profile is complete so founders can find you.
            </p>
            <Link href="/profile" style={{
              padding: "10px 22px", background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)", borderRadius: "var(--radius)",
              color: "var(--accent)", fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              Update your profile →
            </Link>
          </div>
        )}

        {/* Request cards */}
        {!loading && requests.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {requests.map(req => (
              <div key={req.id} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 20,
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                transition: "all 0.15s",
                opacity: acting === req.id ? 0.5 : 1,
              }}>
                <Avatar name={req.requester?.full_name ?? null} url={req.requester?.avatar_url} size={50} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                    {req.requester?.full_name ?? "Someone"}
                  </p>

                  {/* Stage + hours badges */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {req.requester?.stage && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "var(--accent)",
                        background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
                        borderRadius: "var(--radius-pill)", padding: "2px 9px",
                      }}>
                        {req.requester.stage}
                      </span>
                    )}
                    {req.requester?.hours_per_week != null && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                        background: "var(--bg-deep, #f4f0e8)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-pill)", padding: "2px 9px",
                      }}>
                        {req.requester.hours_per_week}h/wk
                      </span>
                    )}
                  </div>

                  <p style={{
                    fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                  }}>
                    {req.requester?.bio ?? "No bio provided."}
                  </p>

                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                    {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleAction(req.id, "accepted")}
                    disabled={acting === req.id}
                    style={{
                      padding: "9px 20px",
                      background: "var(--accent)",
                      border: "none",
                      borderRadius: "var(--radius)",
                      color: "#fff",
                      fontSize: 13, fontWeight: 700,
                      cursor: acting === req.id ? "not-allowed" : "pointer",
                      transition: "all 0.12s",
                      minWidth: 90,
                    }}>
                    Accept
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "declined")}
                    disabled={acting === req.id}
                    style={{
                      padding: "9px 20px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      color: "var(--text-muted)",
                      fontSize: 13, fontWeight: 600,
                      cursor: acting === req.id ? "not-allowed" : "pointer",
                      transition: "all 0.12s",
                    }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  );
}
