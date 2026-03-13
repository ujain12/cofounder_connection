"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { Avatar, Badge, Button, Card, Divider, Input, SectionHeading } from "../components/ui";
import Link from "next/link";

type Candidate = {
  id: string;
  full_name: string | null;
  bio: string | null;
  stage: string | null;
  goals: string | null;
  hours_per_week: number | null;
};

type MatchRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type Connection = {
  match_id: string;
  other_id: string;
  other?: { id: string; full_name: string | null; bio: string | null } | null;
};

export default function MatchesPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [me, setMe]                   = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [candidates, setCandidates]   = useState<Candidate[]>([]);
  const [myActions, setMyActions]     = useState<MatchRow[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [query, setQuery]             = useState("");

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function loadAll() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMe(null); setCandidates([]); setMyActions([]); setConnections([]);
      setLoading(false); return;
    }
    setMe(user.id);

    // outgoing actions
    const { data: actions, error: actErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("user_id", user.id);
    if (actErr) { alert("Failed loading actions"); setLoading(false); return; }
    const actionsRows = (actions as MatchRow[]) ?? [];
    setMyActions(actionsRows);
    const actedIds = new Set(actionsRows.map((r) => r.candidate_id));

    // candidates
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("id,full_name,bio,stage,goals,hours_per_week")
      .neq("id", user.id)
      .limit(80);
    if (profErr) { alert("Failed loading candidates"); setLoading(false); return; }
    setCandidates(
      ((profs as any) ?? [])
        .filter((p: Candidate) => !actedIds.has(p.id))
        .slice(0, 30)
    );

    // accepted connections
    const { data: acc, error: accErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("status", "accepted");
    if (accErr) { alert("Failed loading connections"); setLoading(false); return; }

    const mineAccepted = ((acc as any) ?? []).filter(
      (m: MatchRow) => m.user_id === user.id || m.candidate_id === user.id
    );
    const connectionRows: Connection[] = mineAccepted.map((m: MatchRow) => ({
      match_id: m.id,
      other_id: m.user_id === user.id ? m.candidate_id : m.user_id,
      other: null,
    }));

    const otherIds = Array.from(new Set(connectionRows.map((c) => c.other_id)));
    let otherProfiles: any[] = [];
    if (otherIds.length > 0) {
      const { data: ops } = await supabase
        .from("profiles").select("id,full_name,bio").in("id", otherIds);
      otherProfiles = (ops as any[]) ?? [];
    }

    setConnections(
      connectionRows.map((c) => ({
        ...c,
        other: otherProfiles.find((p) => p.id === c.other_id) ?? null,
      }))
    );
    setLoading(false);
  }

  function alreadyActed(id: string) {
    return myActions.some((r) => r.candidate_id === id);
  }

  async function like(candidateId: string) {
    if (!me || alreadyActed(candidateId)) return;
    const { error } = await supabase
      .from("matches")
      .insert({ user_id: me, candidate_id: candidateId, status: "pending" });
    if (error) return alert("Like failed: " + error.message);
    await loadAll();
  }

  async function decline(candidateId: string) {
    if (!me || alreadyActed(candidateId)) return;
    const { error } = await supabase
      .from("matches")
      .insert({ user_id: me, candidate_id: candidateId, status: "declined" });
    if (error) return alert("Decline failed: " + error.message);
    await loadAll();
  }

  const visible = candidates.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.full_name ?? "").toLowerCase().includes(q) ||
      (c.bio ?? "").toLowerCase().includes(q) ||
      (c.stage ?? "").toLowerCase().includes(q) ||
      (c.goals ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="Find Cofounders">
      <div className="flex flex-col gap-8">

        {/* ── Connections ── */}
        <section>
          <SectionHeading
            title="Your Connections"
            subtitle="Accepted matches — open chat to collaborate"
            right={
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
                {connections.length} connected
              </span>
            }
          />

          {connections.length === 0 ? (
            <Card hover={false}>
              <p className="text-sm text-slate-400">
                No connections yet. Like someone → they accept in Requests → you both appear here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {connections.map((c) => (
                <Card key={c.match_id}>
                  <div className="flex items-start gap-3">
                    <Avatar name={c.other?.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100">
                        {c.other?.full_name ?? "Unnamed"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {c.other?.bio ?? "No bio yet"}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
                        <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
                      </div>
                    </div>
                    <Link
                      href={`/chat/${c.match_id}`}
                      className="flex-shrink-0 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-all"
                    >
                      Chat →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Browse ── */}
        <section>
          <SectionHeading
            title="Browse Founders"
            subtitle="Like someone to send them a connection request"
          />

          {/* Search bar */}
          <div className="relative mb-4">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              ⌕
            </span>
            <Input
              className="pl-8"
              placeholder="Search by name, bio, stage, goals…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Loading skeletons */}
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} hover={false}>
                  <div className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-white/6 flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-white/6 rounded w-1/3" />
                      <div className="h-2.5 bg-white/4 rounded w-2/3" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Card hover={false}>
              <p className="text-sm text-slate-400 text-center py-6">
                No founders found — try a different search or check back later.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((c) => (
                <Card key={c.id}>
                  {/* Header row: avatar + name + bio */}
                  <div className="flex items-start gap-3">
                    <Avatar name={c.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      {/* NAME — always white, never invisible */}
                      <p className="text-sm font-bold leading-snug" style={{ color: "#f1f5f9" }}>
                        {c.full_name || "Unnamed Founder"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: "#94a3b8" }}>
                        {c.bio || "No bio yet."}
                      </p>
                    </div>
                  </div>

                  {/* Tags row */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.stage && <Badge color="indigo">{c.stage}</Badge>}
                    {c.hours_per_week != null && (
                      <Badge color="zinc">{c.hours_per_week} hrs/wk</Badge>
                    )}
                    {c.goals && (
                      <span
                        className="text-[11px] italic truncate max-w-[180px]"
                        style={{ color: "#475569" }}
                      >
                        "{c.goals}"
                      </span>
                    )}
                  </div>

                  {/* Divider + Actions */}
                  <Divider />
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      className="flex-1"
                      onClick={() => like(c.id)}
                    >
                      Connect
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => decline(c.id)}
                    >
                      Pass
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}