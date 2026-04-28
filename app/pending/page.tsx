"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");
  const [isBanned, setIsBanned] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkStatus(); }, []);

  async function checkStatus() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("status, is_banned").eq("id", userData.user.id).maybeSingle();
    if (profile?.status === "approved" && !profile?.is_banned) { router.push("/home"); return; }
    if (profile) { setStatus(profile.status || "pending"); setIsBanned(profile.is_banned || false); }
    setLoading(false);
  }

  async function handleRefresh() { setChecking(true); await checkStatus(); setTimeout(() => setChecking(false), 1000); }
  async function handleSignOut() { await supabase.auth.signOut(); window.location.href = "/"; }

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-muted)" }}>Loading...</div>;

  const iconBox = (color: string, borderColor: string) => ({
    width: 64, height: 64, borderRadius: 16,
    background: color, border: `1px solid ${borderColor}`,
    display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    margin: "0 auto 24px",
  });

  const btn = (primary: boolean) => ({
    padding: "12px 32px", borderRadius: "var(--radius)",
    border: primary ? "none" : "1px solid var(--border)",
    background: primary ? "var(--accent-soft)" : "var(--surface)",
    color: primary ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 14, fontWeight: 600,
  });

  // ═══ BANNED ═══
  if (isBanned) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
        <div style={{ maxWidth: 500, textAlign: "center" }}>
          <div style={iconBox("rgba(220,38,38,0.06)", "rgba(220,38,38,0.15)")}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={1.8}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" /></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.02em" }}>Account Suspended</h1>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px 28px", marginBottom: 28, textAlign: "left", boxShadow: "var(--shadow-sm)" }}>
            <p style={{ fontSize: 15, color: "var(--text-primary)", lineHeight: 1.7, marginBottom: 12 }}>
              Your account has been permanently suspended for violating the Cofounder Connections community guidelines.
            </p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              This action was taken because your behavior was flagged as harmful, inappropriate, or in violation of our terms of use. This decision is final and your account will not be reinstated.
            </p>
          </div>
          <button onClick={handleSignOut} style={btn(false)}>Sign Out</button>
        </div>
      </div>
    );
  }

  // ═══ REJECTED ═══
  if (status === "rejected") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={iconBox("var(--amber-soft)", "var(--amber-border)")}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--amber)" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12, letterSpacing: "-0.02em" }}>Application Not Approved</h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 12 }}>
            Thank you for your interest in Cofounder Connections. Unfortunately, your application was not approved at this time.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 28 }}>
            This could be because your profile didn't meet our current criteria. You're welcome to reapply in the future with a more detailed application.
          </p>
          <button onClick={handleSignOut} style={btn(false)}>Sign Out</button>
        </div>
      </div>
    );
  }

  // ═══ PENDING ═══
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={iconBox("var(--accent-soft)", "var(--accent-border)")}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12, letterSpacing: "-0.02em" }}>Application Under Review</h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 12 }}>
          Thanks for applying to Cofounder Connections! We review every application to maintain a trusted community of serious founders and builders.
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32 }}>
          Your profile will be reviewed and accepted within 48 hours after a thorough review. You can check back anytime by clicking the button below.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={handleRefresh} disabled={checking} style={{ ...btn(true), opacity: checking ? 0.6 : 1 }}>
            {checking ? "Checking..." : "Check Status"}
          </button>
          <button onClick={handleSignOut} style={btn(false)}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}