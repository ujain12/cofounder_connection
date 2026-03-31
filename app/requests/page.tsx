"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";

type ProfileLite = { id: string; full_name: string | null; bio: string | null; avatar_url?: string | null; };

type Incoming = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  liker?: ProfileLite | null;
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function timeAgo(ts: string) {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ""; }
}

export default function RequestsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<Incoming[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setMe(null); setRows([]); setLoading(false); return; }
    setMe(user.id);

    const { data: reqs, error } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("candidate_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const base = (reqs as Incoming[]) ?? [];
    const likerIds = Array.from(new Set(base.map(r => r.user_id)));

    let profiles: ProfileLite[] = [];
    if (likerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,bio,avatar_url")
        .in("id", likerIds);
      profiles = (profs as ProfileLite[]) ?? [];
    }

    setRows(base.map(r => ({ ...r, liker: profiles.find(p => p.id === r.user_id) ?? null })));
    setLoading(false);
  }

  async function accept(matchId: string) {
    if (!me) return;
    setWorkingId(matchId);

    const { error: updErr } = await supabase
      .from("matches").update({ status: "accepted" })
      .eq("id", matchId).eq("candidate_id", me).eq("status", "pending");

    if (updErr) { alert("Accept failed."); setWorkingId(null); return; }

    const { error: chatErr } = await supabase
      .from("chats").upsert({ match_id: matchId }, { onConflict: "match_id" });

    if (chatErr) { alert("Accepted but chat creation failed."); setWorkingId(null); return; }

    router.push(`/chat/${matchId}`);
  }

  async function decline(matchId: string) {
    if (!me) return;
    setWorkingId(matchId);
    const { error } = await supabase
      .from("matches").update({ status: "declined" })
      .eq("id", matchId).eq("candidate_id", me).eq("status", "pending");
    if (error) { alert("Decline failed."); setWorkingId(null); return; }
    await load();
    setWorkingId(null);
  }

  return (
    <AppShell title="Requests">
      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              People who want to connect with you. Accept to start chatting.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "8px 16px",
              color: "#94a3b8", fontSize: 13, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: loading ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "32px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#475569" }}>Loading requests...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && (
          <div style={{
            background: "#111827", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "56px 32px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f2fc" }}>No pending requests</p>
            <p style={{ fontSize: 13, color: "#475569", textAlign: "center", maxWidth: 300 }}>
              When someone likes your profile, their request will appear here.
            </p>
          </div>
        )}

        {/* Request cards */}
        {!loading && rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Count */}
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>
              {rows.length} pending request{rows.length !== 1 ? "s" : ""}
            </p>

            {rows.map(r => (
              <div key={r.id} style={{
                background: "#111827",
                border: "1px solid rgba(99,102,241,0.18)",
                borderRadius: 16, padding: 20,
                display: "flex", alignItems: "flex-start", gap: 16,
                transition: "all 0.15s",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                  background: r.liker?.avatar_url ? "transparent" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "2px solid rgba(99,102,241,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "#fff",
                  overflow: "hidden",
                }}>
                  {r.liker?.avatar_url ? (
                    <img src={r.liker.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials(r.liker?.full_name)
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#f0f2fc" }}>
                      {r.liker?.full_name ?? "Unnamed Founder"}
                    </p>
                    <span style={{
                      fontSize: 10, color: "#475569",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {timeAgo(r.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                  }}>
                    {r.liker?.bio ?? "No bio provided."}
                  </p>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button
                      onClick={() => accept(r.id)}
                      disabled={workingId === r.id}
                      style={{
                        background: workingId === r.id
                          ? "rgba(79,70,229,0.3)"
                          : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                        border: "none", borderRadius: 10,
                        padding: "9px 22px",
                        color: "#fff", fontSize: 13, fontWeight: 700,
                        cursor: workingId === r.id ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        boxShadow: workingId === r.id ? "none" : "0 4px 16px rgba(79,70,229,0.3)",
                        transition: "all 0.15s",
                      }}
                    >
                      {workingId === r.id ? "Accepting..." : "Accept"}
                    </button>
                    <button
                      onClick={() => decline(r.id)}
                      disabled={workingId === r.id}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(244,63,94,0.25)",
                        borderRadius: 10, padding: "9px 22px",
                        color: "#fb7185", fontSize: 13, fontWeight: 600,
                        cursor: workingId === r.id ? "not-allowed" : "pointer",
                        fontFamily: "inherit", opacity: workingId === r.id ? 0.5 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      {workingId === r.id ? "Declining..." : "Decline"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  );
}