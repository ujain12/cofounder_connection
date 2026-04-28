"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  "Startup Founder",
  "Looking for a Cofounder",
  "Investor / Advisor",
  "Technical Cofounder",
  "Business / Operations Cofounder",
  "Product / Design Cofounder",
  "Other",
];

export default function OnboardingPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [whyJoin, setWhyJoin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setFullName(data.user.user_metadata?.full_name || data.user.user_metadata?.name || "");
      }
    });
  }, [supabase]);

  async function handleSubmit() {
    if (!fullName.trim()) { setError("Please enter your full name."); return; }
    if (!role) { setError("Please select your role."); return; }
    if (!whyJoin.trim()) { setError("Please tell us why you want to join."); return; }
    if (!userId) return;

    setSubmitting(true);
    setError("");

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      role,
      company: company.trim(),
      linkedin_url: linkedinUrl.trim(),
      why_join: whyJoin.trim(),
      status: "pending",
      applied_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError("Something went wrong: " + upsertError.message);
      setSubmitting(false);
      return;
    }

    router.push("/pending");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Tell us about yourself
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            We review every application to keep Cofounder Connections a trusted community of serious founders and builders. Your profile will be reviewed within 48 hours.
          </p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32, boxShadow: "var(--shadow)" }}>

          <div style={{ marginBottom: 18 }}>
            <label>Full Name *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" style={{ width: "100%", padding: "11px 14px" }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>What best describes you? *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ROLES.map((r) => (
                <button key={r} onClick={() => setRole(r)}
                  style={{
                    padding: "7px 14px", borderRadius: "var(--radius-pill)",
                    border: `1px solid ${role === r ? "var(--accent-border)" : "var(--border)"}`,
                    background: role === r ? "var(--accent-soft)" : "var(--surface)",
                    color: role === r ? "var(--accent)" : "var(--text-muted)",
                    fontSize: 12, fontWeight: role === r ? 700 : 500,
                  }}
                >{r}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Company or Project (optional)</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your startup or current company" style={{ width: "100%", padding: "11px 14px" }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>LinkedIn Profile (recommended)</label>
            <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" style={{ width: "100%", padding: "11px 14px" }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Why do you want to join? *</label>
            <textarea value={whyJoin} onChange={(e) => setWhyJoin(e.target.value)} placeholder="Tell us what you're building or looking for in a cofounder..." rows={4} style={{ width: "100%", padding: "11px 14px", resize: "vertical" }} />
          </div>

          {error && (
            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: "100%", padding: "13px", borderRadius: "var(--radius)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}