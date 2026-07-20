import Link from "@/components/navigation/link";
import type { ReactNode } from "react";

export const panelClass =
  "panel rounded-xl border border-white/10 bg-[#101820]/90 shadow-[0_18px_50px_rgba(0,0,0,.22)]";

export const controlClass =
  "field min-h-10 rounded-md border border-white/10 bg-[#0a1118] px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10";

export const buttonClass =
  "button inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[.045] px-3.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/[.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60";

export const primaryButtonClass = `${buttonClass} button-primary border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15`;

export function DemoBanner({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={`demo-banner flex items-start gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[.07] ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      role="note"
      aria-label="Demonstration data notice"
    >
      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.65)]" />
      <div>
        <strong className="block text-[11px] font-bold uppercase tracking-[.18em] text-amber-200">
          Demonstration data — not real-world intelligence.
        </strong>
        {!compact && (
          <p className="mt-1 text-xs leading-5 text-amber-100/65">
            All events, reports, scores, and assessments shown in this workspace are fictional and intended for product evaluation.
          </p>
        )}
      </div>
    </aside>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="eyebrow mb-2 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-300/70">{eyebrow}</p>
        <h1 className="page-title text-2xl font-semibold tracking-[-.025em] text-slate-50 sm:text-3xl">{title}</h1>
        <p className="page-subtitle mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-header flex items-start justify-between gap-4 border-b border-white/[.07] px-4 py-3.5 sm:px-5">
      <div>
        {eyebrow && <p className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">{eyebrow}</p>}
        <h2 className="panel-title mt-0.5 text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "cyan" | "green" | "amber" | "red" | "violet";
}) {
  const tones = {
    neutral: "border-slate-400/20 bg-slate-400/10 text-slate-300",
    cyan: "border-cyan-300/20 bg-cyan-300/[.08] text-cyan-200",
    green: "border-emerald-300/20 bg-emerald-300/[.08] text-emerald-200",
    amber: "border-amber-300/20 bg-amber-300/[.08] text-amber-200",
    red: "border-red-300/20 bg-red-300/[.08] text-red-200",
    violet: "border-violet-300/20 bg-violet-300/[.08] text-violet-200",
  };
  return (
    <span className={`badge inline-flex items-center rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function SeverityMark({ severity, label = true }: { severity: number; label?: boolean }) {
  const tone = severity >= 5 ? "bg-red-400" : severity === 4 ? "bg-orange-400" : severity === 3 ? "bg-amber-300" : "bg-cyan-300";
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-300">
      <span className={`h-2 w-2 rounded-full ${tone} shadow-[0_0_12px_currentColor]`} />
      {label && `Severity ${severity}`}
    </span>
  );
}

export function ConfidenceMeter({ score, compact = false }: { score: number; compact?: boolean }) {
  const tone = score >= 90 ? "bg-emerald-400" : score >= 70 ? "bg-cyan-300" : score >= 50 ? "bg-amber-300" : "bg-orange-400";
  return (
    <div className={`confidence-meter ${compact ? "min-w-24" : "w-full"}`} aria-label={`Automated confidence ${score}%`}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">
        <span>{compact ? "Confidence" : "Automated confidence"}</span>
        <span className="text-slate-200">{score}%</span>
      </div>
      <div className="progress-bar h-1 overflow-hidden rounded-full bg-white/[.07]">
        <div className={`progress-fill h-full rounded-full ${tone}`} style={{ width: `${Math.min(99, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}

export function MetricCard({ label, value, detail, tone = "cyan" }: { label: string; value: string | number; detail?: string; tone?: "cyan" | "green" | "amber" | "red" }) {
  const tones = { cyan: "text-cyan-200", green: "text-emerald-200", amber: "text-amber-200", red: "text-red-200" };
  return (
    <div className={`${panelClass} metric-card p-4`}>
      <p className="text-[9px] font-bold uppercase tracking-[.17em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export function RouteLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60" href={href}>
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

export function Definition({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-200">{children}</dd>
    </div>
  );
}

export function formatDate(value: string, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC", timeZoneName: "short" } : {}),
  }).format(date);
}

export function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
