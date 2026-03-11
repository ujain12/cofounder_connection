"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

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
  goals?: string | null;
  hours_per_week?: number | null;
};

type AcceptedMatchOption = {
  match_id: string;
  founder_a_id: string;
  founder_b_id: string;
  other_id: string;
  other: ProfileRow | null;
};

type AgreementRow = {
  id: string;
  match_id: string;
  founder_a_id: string;
  founder_b_id: string;
  agreement_title: string | null;
  project_name: string | null;
  startup_stage: string | null;
  founder_a_role: string | null;
  founder_b_role: string | null;
  shared_responsibilities: string | null;
  equity_expectations: string | null;
  vesting_expectations: string | null;
  cash_contribution: string | null;
  time_commitment: string | null;
  availability_expectation: string | null;
  decision_style: string | null;
  conflict_handling: string | null;
  meeting_cadence: string | null;
  communication_preference: string | null;
  milestones: string | null;
  notes: string | null;
  status: "draft" | "finalized";
  created_by: string | null;
  updated_by: string | null;
  last_edited_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type AgreementForm = {
  agreement_title: string;
  project_name: string;
  startup_stage: string;
  founder_a_role: string;
  founder_b_role: string;
  shared_responsibilities: string;
  equity_expectations: string;
  vesting_expectations: string;
  cash_contribution: string;
  time_commitment: string;
  availability_expectation: string;
  decision_style: string;
  conflict_handling: string;
  meeting_cadence: string;
  communication_preference: string;
  milestones: string;
  notes: string;
  status: "draft" | "finalized";
};

const emptyForm: AgreementForm = {
  agreement_title: "",
  project_name: "",
  startup_stage: "",
  founder_a_role: "",
  founder_b_role: "",
  shared_responsibilities: "",
  equity_expectations: "",
  vesting_expectations: "",
  cash_contribution: "",
  time_commitment: "",
  availability_expectation: "",
  decision_style: "",
  conflict_handling: "",
  meeting_cadence: "",
  communication_preference: "",
  milestones: "",
  notes: "",
  status: "draft",
};

export default function AgreementPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const autosaveRef = useRef<NodeJS.Timeout | null>(null);
  const hydratingRef = useRef(false);

  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState("Founder");
  const [matches, setMatches] = useState<AcceptedMatchOption[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [agreementId, setAgreementId] = useState<string | null>(null);

  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingAgreement, setLoadingAgreement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosaveLabel, setAutosaveLabel] = useState("Up to date");
  const [pendingRemoteRefresh, setPendingRemoteRefresh] = useState(false);

  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastEditedByName, setLastEditedByName] = useState<string | null>(null);

  const [form, setForm] = useState<AgreementForm>(emptyForm);

  useEffect(() => {
    loadAcceptedMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      hydratingRef.current = true;
      setAgreementId(null);
      setForm(emptyForm);
      setLastSavedAt(null);
      setLastEditedByName(null);
      setPendingRemoteRefresh(false);
      setDirty(false);
      setAutosaveLabel("Up to date");
      queueMicrotask(() => {
        hydratingRef.current = false;
      });
      return;
    }

    loadAgreement(selectedMatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;

    const channel = supabase
      .channel(`agreement-sync-${selectedMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "founder_agreements",
          filter: `match_id=eq.${selectedMatchId}`,
        },
        (payload) => {
          const row = payload.new as AgreementRow | undefined;
          const changedByMe = row?.updated_by && row.updated_by === me;

          if (changedByMe) return;

          if (dirty) {
            setPendingRemoteRefresh(true);
            setAutosaveLabel("Remote changes available");
            return;
          }

          loadAgreement(selectedMatchId, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatchId, supabase, me, dirty]);

  useEffect(() => {
    if (!selectedMatchId) return;
    if (hydratingRef.current) return;
    if (!dirty) return;

    setAutosaveLabel("Saving changes...");

    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
    }

    autosaveRef.current = setTimeout(() => {
      saveAgreement(form.status, true);
    }, 1200);

    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty, selectedMatchId]);

  async function loadAcceptedMatches() {
    setLoadingMatches(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setLoadingMatches(false);
      return;
    }

    const userId = userData.user.id;
    setMe(userId);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (myProfile?.full_name) {
      setMyName(myProfile.full_name);
    }

    const { data: acc, error: accErr } = await supabase
      .from("matches")
      .select("id,user_id,candidate_id,status,created_at")
      .eq("status", "accepted");

    if (accErr) {
      console.error(accErr);
      alert("Failed to load accepted matches.");
      setLoadingMatches(false);
      return;
    }

    const accepted = ((acc as MatchRow[]) ?? []).filter(
      (m) => m.user_id === userId || m.candidate_id === userId
    );

    const otherIds = Array.from(
      new Set(
        accepted.map((m) => (m.user_id === userId ? m.candidate_id : m.user_id))
      )
    );

    let otherProfiles: ProfileRow[] = [];
    if (otherIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,bio,stage,goals,hours_per_week")
        .in("id", otherIds);

      if (profErr) {
        console.error(profErr);
      } else {
        otherProfiles = (profs as ProfileRow[]) ?? [];
      }
    }

    const hydrated: AcceptedMatchOption[] = accepted.map((m) => {
      const otherId = m.user_id === userId ? m.candidate_id : m.user_id;

      return {
        match_id: m.id,
        founder_a_id: m.user_id,
        founder_b_id: m.candidate_id,
        other_id: otherId,
        other: otherProfiles.find((p) => p.id === otherId) ?? null,
      };
    });

    setMatches(hydrated);
    setSelectedMatchId(hydrated[0]?.match_id || "");
    setLoadingMatches(false);
  }

  async function loadAgreement(matchId: string, silent = false) {
    if (!silent) setLoadingAgreement(true);

    const { data, error } = await supabase
      .from("founder_agreements")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle();

    if (error) {
      console.error(error);
      if (!silent) alert("Failed to load agreement.");
      if (!silent) setLoadingAgreement(false);
      return;
    }

    hydratingRef.current = true;

    if (!data) {
      setAgreementId(null);
      setForm(emptyForm);
      setLastSavedAt(null);
      setLastEditedByName(null);
      setPendingRemoteRefresh(false);
      setDirty(false);
      setAutosaveLabel("Up to date");
      queueMicrotask(() => {
        hydratingRef.current = false;
      });
      if (!silent) setLoadingAgreement(false);
      return;
    }

    const row = data as AgreementRow;

    setAgreementId(row.id);
    setForm({
      agreement_title: row.agreement_title ?? "",
      project_name: row.project_name ?? "",
      startup_stage: row.startup_stage ?? "",
      founder_a_role: row.founder_a_role ?? "",
      founder_b_role: row.founder_b_role ?? "",
      shared_responsibilities: row.shared_responsibilities ?? "",
      equity_expectations: row.equity_expectations ?? "",
      vesting_expectations: row.vesting_expectations ?? "",
      cash_contribution: row.cash_contribution ?? "",
      time_commitment: row.time_commitment ?? "",
      availability_expectation: row.availability_expectation ?? "",
      decision_style: row.decision_style ?? "",
      conflict_handling: row.conflict_handling ?? "",
      meeting_cadence: row.meeting_cadence ?? "",
      communication_preference: row.communication_preference ?? "",
      milestones: row.milestones ?? "",
      notes: row.notes ?? "",
      status: row.status ?? "draft",
    });
    setLastSavedAt(row.updated_at);
    setLastEditedByName(row.last_edited_by_name ?? null);
    setPendingRemoteRefresh(false);
    setDirty(false);
    setAutosaveLabel("Up to date");

    queueMicrotask(() => {
      hydratingRef.current = false;
    });

    if (!silent) setLoadingAgreement(false);
  }

  async function saveAgreement(
    nextStatus?: "draft" | "finalized",
    silent = false
  ) {
    if (!me) return;

    const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);
    if (!selectedMatch) return;

    if (!silent) setSaving(true);

    const payload = {
      match_id: selectedMatch.match_id,
      founder_a_id: selectedMatch.founder_a_id,
      founder_b_id: selectedMatch.founder_b_id,
      agreement_title: form.agreement_title,
      project_name: form.project_name,
      startup_stage: form.startup_stage,
      founder_a_role: form.founder_a_role,
      founder_b_role: form.founder_b_role,
      shared_responsibilities: form.shared_responsibilities,
      equity_expectations: form.equity_expectations,
      vesting_expectations: form.vesting_expectations,
      cash_contribution: form.cash_contribution,
      time_commitment: form.time_commitment,
      availability_expectation: form.availability_expectation,
      decision_style: form.decision_style,
      conflict_handling: form.conflict_handling,
      meeting_cadence: form.meeting_cadence,
      communication_preference: form.communication_preference,
      milestones: form.milestones,
      notes: form.notes,
      status: nextStatus ?? form.status,
      created_by: agreementId ? undefined : me,
      updated_by: me,
      last_edited_by_name: myName,
    };

    const { data, error } = await supabase
      .from("founder_agreements")
      .upsert(payload, { onConflict: "match_id" })
      .select()
      .single();

    if (!silent) setSaving(false);

    if (error) {
      console.error(error);
      setAutosaveLabel("Save failed");
      if (!silent) {
        alert("Failed to save agreement: " + error.message);
      }
      return;
    }

    const row = data as AgreementRow;
    setAgreementId(row.id);
    setForm((prev) => ({ ...prev, status: row.status }));
    setLastSavedAt(row.updated_at);
    setLastEditedByName(row.last_edited_by_name ?? null);
    setDirty(false);
    setPendingRemoteRefresh(false);
    setAutosaveLabel(
      nextStatus === "finalized" ? "Agreement finalized" : "All changes saved"
    );

    if (!silent && nextStatus === "finalized") {
      alert("Agreement finalized.");
    }
  }

  function updateField<K extends keyof AgreementForm>(
    key: K,
    value: AgreementForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setAutosaveLabel("Unsaved changes");
  }

  function downloadAgreement() {
    const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);
    const partnerName = selectedMatch?.other?.full_name ?? "Matched-Founder";
    const title = form.agreement_title || "Founder-Agreement";
    const project = form.project_name || "Untitled-Project";

    const content = `
# Founder Agreement

## Agreement Info
Agreement Title: ${form.agreement_title}
Project Name: ${form.project_name}
Startup Stage: ${form.startup_stage}
Status: ${form.status}
Matched Founder: ${partnerName}

## Roles & Responsibilities
Founder A Role: ${form.founder_a_role}
Founder B Role: ${form.founder_b_role}

Shared Responsibilities:
${form.shared_responsibilities}

## Equity & Commitment
Equity Expectations:
${form.equity_expectations}

Vesting Expectations:
${form.vesting_expectations}

Cash Contribution:
${form.cash_contribution}

Time Commitment:
${form.time_commitment}

Availability Expectation:
${form.availability_expectation}

## Decision-Making & Conflict
Decision-Making Style:
${form.decision_style}

Conflict Handling:
${form.conflict_handling}

## Working Rhythm
Meeting Cadence:
${form.meeting_cadence}

Communication Preference:
${form.communication_preference}

Milestones:
${form.milestones}

## Additional Notes
${form.notes}

Last Edited By: ${lastEditedByName ?? "-"}
Last Saved At: ${lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "-"}
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(project)}-${sanitizeFileName(title)}-${sanitizeFileName(
      partnerName
    )}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const hasMatch = matches.length > 0;
  const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-gray-400">Workspace / Agreement</p>
            <h1 className="text-4xl font-bold">Founder Agreement</h1>
            <p className="text-gray-400 mt-2 max-w-3xl">
              Workspace is always available. Agreement unlocks after a match is accepted.
              This version supports shared editing with live saved updates.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-zinc-900 px-4 py-3 min-w-[260px]">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Agreement status
            </p>
            <p className="text-lg font-semibold capitalize">{form.status}</p>
            <p className="text-xs text-gray-500 mt-1">{autosaveLabel}</p>
            {lastEditedByName ? (
              <p className="text-xs text-gray-500 mt-1">
                Last edited by: {lastEditedByName}
              </p>
            ) : null}
            {lastSavedAt ? (
              <p className="text-xs text-gray-500 mt-1">
                Last saved: {new Date(lastSavedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>

        {loadingMatches ? (
          <div className="rounded-3xl border border-gray-800 bg-zinc-900 p-8">
            Loading accepted matches...
          </div>
        ) : !hasMatch ? (
          <div className="rounded-3xl border border-dashed border-gray-700 bg-zinc-900/60 p-10 text-center">
            <h2 className="text-2xl font-semibold mb-3">No accepted founder match yet</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              The Workspace stays available, but Agreement becomes active after a founder
              match is accepted.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-blue-900 bg-blue-950/40 px-4 py-3 text-sm text-blue-200">
              This agreement is shared between both matched founders. Saved changes from
              either founder will appear here automatically.
            </div>

            {pendingRemoteRefresh ? (
              <div className="mb-6 rounded-2xl border border-yellow-900 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-200 flex items-center justify-between gap-4">
                <span>
                  Your matched founder saved new changes while you had local edits open.
                </span>
                <button
                  type="button"
                  onClick={() => selectedMatchId && loadAgreement(selectedMatchId, true)}
                  className="rounded-xl border border-yellow-700 px-4 py-2 text-yellow-100 hover:bg-yellow-900/30"
                >
                  Load latest version
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 rounded-3xl border border-gray-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold mb-4">Match Selection</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Matched Founder">
                    <select
                      value={selectedMatchId}
                      onChange={(e) => setSelectedMatchId(e.target.value)}
                      className="w-full rounded-2xl bg-black border border-gray-700 px-4 py-3 outline-none"
                    >
                      {matches.map((match) => (
                        <option key={match.match_id} value={match.match_id}>
                          {match.other?.full_name ?? "Unnamed founder"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Agreement Status">
                    <select
                      value={form.status}
                      onChange={(e) =>
                        updateField("status", e.target.value as "draft" | "finalized")
                      }
                      className="w-full rounded-2xl bg-black border border-gray-700 px-4 py-3 outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="finalized">Finalized</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold mb-4">Matched Founder</h2>
                <div className="space-y-3 text-sm">
                  <Info label="Name" value={selectedMatch?.other?.full_name ?? "Unnamed founder"} />
                  <Info label="Bio" value={selectedMatch?.other?.bio ?? "-"} />
                  <Info label="Stage" value={selectedMatch?.other?.stage ?? "-"} />
                </div>
              </div>
            </div>

            {loadingAgreement ? (
              <div className="rounded-3xl border border-gray-800 bg-zinc-900 p-8">
                Loading agreement...
              </div>
            ) : (
              <div className="space-y-6">
                <Section title="Agreement Basics" subtitle="Define the foundation of the partnership.">
                  <Grid2>
                    <Input
                      label="Agreement Title"
                      value={form.agreement_title}
                      onChange={(v) => updateField("agreement_title", v)}
                      placeholder="Cofounder Working Agreement v1"
                    />
                    <Input
                      label="Project / Startup Name"
                      value={form.project_name}
                      onChange={(v) => updateField("project_name", v)}
                      placeholder="Cofounder Connection"
                    />
                    <Input
                      label="Startup Stage"
                      value={form.startup_stage}
                      onChange={(v) => updateField("startup_stage", v)}
                      placeholder="Idea / MVP / Early Revenue"
                    />
                  </Grid2>
                </Section>

                <Section title="Roles & Responsibilities" subtitle="Make ownership clear early.">
                  <Grid2>
                    <Input
                      label="Founder A Role"
                      value={form.founder_a_role}
                      onChange={(v) => updateField("founder_a_role", v)}
                      placeholder="Product / Business"
                    />
                    <Input
                      label="Founder B Role"
                      value={form.founder_b_role}
                      onChange={(v) => updateField("founder_b_role", v)}
                      placeholder="Tech / Engineering"
                    />
                  </Grid2>

                  <div className="mt-4">
                    <TextArea
                      label="Shared Responsibilities"
                      value={form.shared_responsibilities}
                      onChange={(v) => updateField("shared_responsibilities", v)}
                      placeholder="Fundraising, hiring, investor updates, roadmap..."
                      rows={4}
                    />
                  </div>
                </Section>

                <Section title="Equity & Commitment" subtitle="Set expectations before assumptions become conflict.">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <TextArea
                      label="Equity Expectations"
                      value={form.equity_expectations}
                      onChange={(v) => updateField("equity_expectations", v)}
                      placeholder="Expected split and reasoning"
                      rows={4}
                    />
                    <TextArea
                      label="Vesting Expectations"
                      value={form.vesting_expectations}
                      onChange={(v) => updateField("vesting_expectations", v)}
                      placeholder="4 years, 1 year cliff, etc."
                      rows={4}
                    />
                    <TextArea
                      label="Cash Contribution"
                      value={form.cash_contribution}
                      onChange={(v) => updateField("cash_contribution", v)}
                      placeholder="Who is contributing money and when?"
                      rows={4}
                    />
                  </div>

                  <Grid2 className="mt-4">
                    <Input
                      label="Time Commitment"
                      value={form.time_commitment}
                      onChange={(v) => updateField("time_commitment", v)}
                      placeholder="20 hours/week"
                    />
                    <Input
                      label="Availability Expectation"
                      value={form.availability_expectation}
                      onChange={(v) => updateField("availability_expectation", v)}
                      placeholder="Respond within 24 hours"
                    />
                  </Grid2>
                </Section>

                <Section title="Decision-Making & Conflict" subtitle="Define how you handle hard moments.">
                  <Grid2>
                    <TextArea
                      label="Decision-Making Style"
                      value={form.decision_style}
                      onChange={(v) => updateField("decision_style", v)}
                      placeholder="Consensus, domain ownership, tie-break rules..."
                      rows={4}
                    />
                    <TextArea
                      label="Conflict Handling"
                      value={form.conflict_handling}
                      onChange={(v) => updateField("conflict_handling", v)}
                      placeholder="How disagreements should be addressed"
                      rows={4}
                    />
                  </Grid2>
                </Section>

                <Section title="Working Rhythm" subtitle="Set the cadence that keeps both founders aligned.">
                  <Grid2>
                    <Input
                      label="Meeting Cadence"
                      value={form.meeting_cadence}
                      onChange={(v) => updateField("meeting_cadence", v)}
                      placeholder="Weekly / Bi-weekly"
                    />
                    <Input
                      label="Communication Preference"
                      value={form.communication_preference}
                      onChange={(v) => updateField("communication_preference", v)}
                      placeholder="Slack / WhatsApp / In-app chat"
                    />
                  </Grid2>

                  <div className="mt-4">
                    <TextArea
                      label="Milestones / Commitment Notes"
                      value={form.milestones}
                      onChange={(v) => updateField("milestones", v)}
                      placeholder="Next 30/60/90 day expectations"
                      rows={4}
                    />
                  </div>
                </Section>

                <Section title="Additional Notes" subtitle="Anything important that does not fit elsewhere.">
                  <TextArea
                    label="Notes"
                    value={form.notes}
                    onChange={(v) => updateField("notes", v)}
                    placeholder="Assumptions, risks, special terms..."
                    rows={5}
                  />
                </Section>

                <div className="sticky bottom-4 z-10">
                  <div className="rounded-3xl border border-gray-800 bg-zinc-950/95 backdrop-blur p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">Shared agreement is live</p>
                      <p className="text-sm text-gray-400">
                        Autosave is enabled. Both founders can edit. Latest saved version wins.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => selectedMatchId && loadAgreement(selectedMatchId, true)}
                        className="rounded-2xl border border-gray-700 px-5 py-3 text-white hover:bg-zinc-900 transition"
                      >
                        Refresh
                      </button>

                      <button
                        type="button"
                        onClick={downloadAgreement}
                        className="rounded-2xl border border-gray-700 px-5 py-3 text-white hover:bg-zinc-900 transition"
                      >
                        Download
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveAgreement("draft")}
                        className="rounded-2xl border border-gray-700 px-5 py-3 text-white hover:bg-zinc-900 transition disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Draft"}
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveAgreement("finalized")}
                        className="rounded-2xl bg-white text-black px-5 py-3 font-semibold hover:opacity-90 transition disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Finalize Agreement"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-800 bg-zinc-900 p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-gray-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Grid2({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">{label}</label>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-black border border-gray-700 px-4 py-3 outline-none"
      />
    </Field>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl bg-black border border-gray-700 px-4 py-3 outline-none resize-none"
      />
    </Field>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}