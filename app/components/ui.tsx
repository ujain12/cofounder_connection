import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/* ─────────────────────────────────────────────────
   BUTTON  — no inline SVGs, no giant icon blowup
───────────────────────────────────────────────── */
export function Button({
  children,
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "success" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer outline-none border disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";

  const styles: Record<string, string> = {
    default:
      "bg-[var(--accent)] text-white border-transparent shadow-[0_0_16px_rgba(22,53,214,0.3)] hover:shadow-[0_0_24px_rgba(22,53,214,0.5)] hover:-translate-y-px",
    ghost:
      "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
    success:
      "bg-[var(--green-soft)] text-[var(--green)] border-[var(--green-border)] hover:bg-[var(--green-soft)]",
    danger:
      "bg-[rgba(220,38,38,0.06)] text-[#dc2626] border-[rgba(220,38,38,0.2)] hover:bg-[rgba(220,38,38,0.1)]",
  };

  return (
    <button {...props} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   CARD
───────────────────────────────────────────────── */
export function Card({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5",
        "shadow-[var(--shadow-sm)]",
        "overflow-hidden",
        hover
          ? "transition-all duration-200 hover:border-[var(--accent)]/50 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08),0_0_32px_var(--accent-soft)] hover:-translate-y-px"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   INPUT
───────────────────────────────────────────────── */
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-[var(--radius)] border-[var(--border)] bg-[var(--bg)]",
        "px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]",
        "outline-none transition-all duration-200",
        "focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        className,
      ].join(" ")}
    />
  );
}

/* ─────────────────────────────────────────────────
   TEXTAREA
───────────────────────────────────────────────── */
export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-[var(--radius)] border-[var(--border)] bg-[var(--bg)]",
        "px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]",
        "outline-none transition-all duration-200 resize-vertical",
        "focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        className,
      ].join(" ")}
    />
  );
}

/* ─────────────────────────────────────────────────
   BADGE
───────────────────────────────────────────────── */
export function Badge({
  children,
  color = "indigo",
}: {
  children: ReactNode;
  color?: "indigo" | "emerald" | "cyan" | "rose" | "amber" | "zinc";
}) {
  const colors: Record<string, string> = {
    indigo:  "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]",
    emerald: "bg-[var(--green-soft)] text-[var(--green)] border-[var(--green-border)]",
    cyan:    "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]",
    rose:    "bg-[rgba(220,38,38,0.06)] text-[#dc2626] border-[rgba(220,38,38,0.2)]",
    amber:   "bg-[var(--amber-soft)] text-[var(--amber)] border-[var(--amber-border)]",
    zinc:    "bg-[var(--bg-deep)] text-[var(--text-muted)] border-[var(--border)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[color]}`}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────
   AVATAR  — explicit pixel sizes, no SVG blowup
───────────────────────────────────────────────── */
export function Avatar({
  name,
  size = "md",
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // explicit pixel dimensions so Tailwind can't purge them
  const dim: Record<string, { wh: string; fs: string }> = {
    sm: { wh: "w-8 h-8",   fs: "text-xs" },
    md: { wh: "w-10 h-10", fs: "text-sm" },
    lg: { wh: "w-14 h-14", fs: "text-lg" },
    xl: { wh: "w-20 h-20", fs: "text-2xl" },
  };

  const { wh, fs } = dim[size];

  return (
    <div
      className={`flex-shrink-0 rounded-full bg-[var(--accent)] flex items-center justify-center font-bold text-white border-2 border-[var(--accent-border)] ${wh} ${fs}`}
      style={{ minWidth: size === "md" ? 40 : size === "lg" ? 56 : size === "xl" ? 80 : 32 }}
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   LABEL
───────────────────────────────────────────────── */
export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5"
    >
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────
   SECTION HEADING
───────────────────────────────────────────────── */
export function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div>
        <h2 className="text-[15px] font-bold text-slate-100 tracking-tight leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   DIVIDER
───────────────────────────────────────────────── */
export function Divider() {
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent my-4" />
  );
}