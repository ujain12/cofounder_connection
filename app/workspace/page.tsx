"use client";

import Link from "next/link";
import AppShell from "../components/AppShell";

const cards = [
  {
    href: "/workspace/agreement",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--accent,#1635d6)" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Founder Agreement",
    description: "Define roles, equity, expectations, and working style. Shared editing — both founders can contribute.",
    tag: "Legal",
  },
  {
    href: "/workspace/tasks",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--accent,#1635d6)" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Tasks & Deadlines",
    description: "Shared ticket board. Assign work, track progress, drag across columns, and keep each other accountable.",
    tag: "Execution",
  },
  {
    href: "/workspace/checkins",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--accent,#1635d6)" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Check-ins Dashboard",
    description: "Track collaboration health, AI weekly summaries, task breakdowns, and inactivity nudges for both founders.",
    tag: "Accountability",
  },
];

export default function WorkspacePage() {
  return (
    <AppShell
      eyebrow="Cofounder Tools"
      title="Workspace"
      subtitle="Structure, accountability, and clear communication — beyond just matching."
    >
      <div style={{ maxWidth: 900 }}>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                cursor: "pointer",
                transition: "all 0.18s ease",
                boxShadow: "var(--shadow-sm)",
                height: "100%",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-sm)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              }}
              >
                {/* Accent top bar */}
                <div style={{ height: 3, background: "var(--accent)", opacity: 0.5 }}/>

                <div style={{ padding: 24 }}>
                  {/* Icon + tag */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "var(--radius)",
                      background: "var(--accent-soft)",
                      border: "1px solid var(--accent-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {card.icon}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.1em", color: "var(--accent)",
                      background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
                      borderRadius: "var(--radius-pill)", padding: "3px 10px",
                    }}>
                      {card.tag}
                    </span>
                  </div>

                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                    {card.title}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: 20 }}>
                    {card.description}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Open →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Why it matters */}
        <div style={{
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          display: "flex", alignItems: "flex-start", gap: 20,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius)", flexShrink: 0,
            background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--accent,#1635d6)" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              Why this workspace matters
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75 }}>
              Most cofounder relationships fail not because of bad ideas — but misaligned expectations, unclear roles, and poor communication. This workspace gives both founders a shared operating layer: a place to define commitments, track execution, and stay honest with each other week over week.
            </p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
