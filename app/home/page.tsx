"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../components/AppShell";

type Stats = {
  connections: number;
  pendingSent: number;
  pendingReceived: number;
};

export default function HomePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [name, setName] = useState("");
  const [stats, setStats] = useState<Stats>({ connections: 0, pendingSent: 0, pendingReceived: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setName(profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there");

      const [connectionsRes, sentRes, receivedRes] = await Promise.all([
        supabase.from("matches").select("id", { count: "exact", head: true })
          .or(`user_id.eq.${user.id},candidate_id.eq.${user.id}`).eq("status", "accepted"),
        supabase.from("matches").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("status", "pending"),
        supabase.from("matches").select("id", { count: "exact", head: true })
          .eq("candidate_id", user.id).eq("status", "pending"),
      ]);

      setStats({
        connections:      connectionsRes.count ?? 0,
        pendingSent:      sentRes.count ?? 0,
        pendingReceived:  receivedRes.count ?? 0,
      });
      setLoading(false);
    })();
  }, [supabase]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <AppShell>
        <p style={{ color: "var(--text-muted)", padding: 40 }}>Loading…</p>
      </AppShell>
    );
  }

  const statCards = [
    { label: "Connections",      value: stats.connections     },
    { label: "Pending Requests", value: stats.pendingReceived },
    { label: "Sent Requests",    value: stats.pendingSent     },
  ];

  const actions = [
    { label: "Find Cofounders",  desc: "Browse profiles and use the AI search agent",                                                href: "/matches"  },
    { label: "Review Requests",  desc: stats.pendingReceived > 0 ? `You have ${stats.pendingReceived} pending request${stats.pendingReceived > 1 ? "s" : ""}` : "Check incoming connection requests", href: "/requests" },
    { label: "Edit Profile",     desc: "Update your bio, tags, and photo",                                                          href: "/profile"  },
    { label: "Workspace",        desc: "Collaborate with your cofounders",                                                          href: "/workspace" },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 820 }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
            {greeting()}
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.035em", marginBottom: 10 }}>
            {name}, welcome back.
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65 }}>
            Here's what's happening with your cofounder journey.
          </p>
        </div>

        {/* Stat cards — single accent color */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {statCards.map((s, i) => (
            <div key={i} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "22px",
              boxShadow: "var(--shadow-sm)",
            }}>
              <p style={{ fontSize: 42, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          marginBottom: 20,
          boxShadow: "var(--shadow-sm)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Quick actions</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {actions.map((a, i) => (
              <Link key={i} href={a.href} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "16px 18px",
                  borderRadius: "var(--radius)",
                background: i === 0 ? "var(--accent-soft)" : "var(--bg-deep)",
                  border: `1px solid ${i === 0 ? "var(--accent-border)" : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "all 0.14s",
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text-primary)", marginBottom: 4 }}>
                    {a.label}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
