"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSearchParams } from "next/navigation";

export default function VerifyEmailPage() {
  const supabase = supabaseBrowser();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const errorParam = searchParams.get("error");

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  async function handleResend() {
    if (!email) return;
    setResending(true);
    setResendError("");
    setResent(false);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setResending(false);
    if (error) {
      setResendError(error.message);
    } else {
      setResent(true);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-160px", left: "-160px", width: "600px", height: "600px", borderRadius: "50%", background: "var(--accent-soft)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-160px", right: "-160px", width: "600px", height: "600px", borderRadius: "50%", background: "rgba(22,53,214,0.04)", filter: "blur(120px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "420px", padding: "0 16px", textAlign: "center" }}>
        <div style={{ width: "72px", height: "72px", margin: "0 auto 24px", borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>
          ✉️
        </div>

        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>
          Check your email
        </h1>

        <p style={{ fontSize: "15px", color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.6 }}>
          We sent a verification link to
        </p>

        {email && (
          <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--accent)", margin: "0 0 24px" }}>
            {email}
          </p>
        )}

        <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 32px", lineHeight: 1.6 }}>
          Click the link in your email to verify your account. If you don't see it, check your spam folder.
        </p>

        {errorParam === "invalid_code" && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px", color: "#fca5a5" }}>
            That verification link has expired or is invalid. Request a new one below.
          </div>
        )}

        {resent && (
          <div style={{ background: "var(--green-soft)", border: "1px solid var(--green-border)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px", color: "var(--green)" }}>
            Verification email resent. Check your inbox.
          </div>
        )}

        {resendError && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px", color: "#fca5a5" }}>
            {resendError}
          </div>
        )}

        {email && (
          <button
            onClick={handleResend}
            disabled={resending}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--accent-border)", background: "var(--accent-soft)", color: "var(--accent)", fontSize: "14px", fontWeight: 500, cursor: resending ? "not-allowed" : "pointer", opacity: resending ? 0.6 : 1, marginBottom: "16px", transition: "all 0.2s" }}
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
        )}

        <a href="/" style={{ fontSize: "14px", color: "var(--text-muted)", textDecoration: "none" }}>
          Back to sign in
        </a>
      </div>
    </div>
  );
}