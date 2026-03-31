"use client";

import Link from "next/link";
import AppShell from "../components/AppShell";

const cards = [
  {
    href: "/workspace/agreement",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Founder Agreement",
    description: "Define roles, equity, expectations, and working style. Shared editing — both founders can contribute.",
    accent: "#818cf8",
    tag: "Legal",
  },
  {
    href: "/workspace/tasks",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Tasks & Deadlines",
    description: "Shared ticket board. Assign work, track progress, drag across columns, and keep each other accountable.",
    accent: "#34d399",
    tag: "Execution",
  },
  {
    href: "/workspace/checkins",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Check-ins Dashboard",
    description: "Track collaboration health, AI weekly summaries, task breakdowns, and inactivity nudges for both founders.",
    accent: "#22d3ee",
    tag: "Accountability",
  },
];

export default function WorkspacePage() {
  return (
    <AppShell title="Workspace">
      <div style={{ maxWidth: 900 }}>

        {/* Subtitle */}
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 32, marginTop: -12 }}>
          Structure, accountability, and clear communication — beyond just matching.
        </p>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{ textDecoration: "none" }}
            >
              <div style={{
                background: "#111827",
                border: `1px solid rgba(255,255,255,0.07)`,
                borderRadius: 16,
                padding: 24,
                height: "100%",
                cursor: "pointer",
                transition: "all 0.2s ease",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${card.accent}40`;
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 40px ${card.accent}10`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
              >
                {/* Top accent line */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${card.accent}, transparent)`,
                  opacity: 0.5,
                }} />

                {/* Icon + tag row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: `${card.accent}14`,
                    border: `1px solid ${card.accent}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {card.icon}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: card.accent,
                    background: `${card.accent}12`,
                    border: `1px solid ${card.accent}25`,
                    borderRadius: 20, padding: "3px 10px",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                    {card.tag}
                  </span>
                </div>

                {/* Title */}
                <h2 style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 16, fontWeight: 700,
                  color: "#f0f2fc", marginBottom: 8,
                  letterSpacing: "-0.01em",
                }}>
                  {card.title}
                </h2>

                {/* Description */}
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                  {card.description}
                </p>

                {/* Arrow */}
                <div style={{
                  marginTop: 20, fontSize: 12, fontWeight: 700,
                  color: card.accent, letterSpacing: "0.05em",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  Open →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Why this matters banner */}
        <div style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(124,58,237,0.05))",
          border: "1px solid rgba(99,102,241,0.18)",
          borderRadius: 16, padding: "24px 28px",
          display: "flex", alignItems: "flex-start", gap: 20,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <div>
            <h3 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 15, fontWeight: 700, color: "#f0f2fc", marginBottom: 6,
            }}>
              Why the Workspace matters
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
              Most cofounder relationships fail not because of bad ideas — but misaligned expectations, unclear roles, and poor communication. This workspace gives both founders a shared operating layer: a place to define commitments, track execution, and stay honest with each other week over week.
            </p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}