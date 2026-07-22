"use client";

import {
  Activity,
  Bell,
  BookOpenText,
  Bot,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Command,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  Globe2,
  History,
  Inbox,
  LogIn,
  LogOut,
  ListChecks,
  Map,
  Menu,
  Network,
  Orbit,
  PanelsTopLeft,
  RadioTower,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { usePathname, useRouter } from "@/lib/client/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { demoEvents, demoSources } from "@/packages/shared/demo-data";
import { BrandMark } from "./brand-mark";
import { useAuth } from "@/components/auth/auth-provider";
import { browserDemoDataEnabled } from "@/lib/config/demo-mode";

const navigation = [
  { href: "/", label: "Global Operations", icon: Activity },
  { href: "/dashboard", label: "Command Center", icon: Gauge },
  { href: "/map", label: "Global Map", icon: Map },
  { href: "/orbit", label: "Orbital Watch", icon: Orbit },
  { href: "/events", label: "Events", icon: Globe2 },
  { href: "/relationships", label: "Relationships", icon: Network },
  { href: "/consequences", label: "Consequences", icon: GitBranch, count: 9 },
  { href: "/conflicts", label: "Conflict Profiles", icon: ShieldCheck },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/alerts", label: "Alerts", icon: Bell, count: 4 },
  { href: "/live-feeds", label: "Live Feeds", icon: Camera },
  { href: "/wall", label: "Monitoring Wall", icon: PanelsTopLeft },
  { href: "/briefs", label: "Intelligence Briefs", icon: BookOpenText },
  { href: "/watchlists", label: "Watchlists", icon: Star },
  { href: "/sources", label: "Sources", icon: RadioTower },
  { href: "/ingestion", label: "Ingestion Queue", icon: Inbox },
  { href: "/review", label: "Review Queue", icon: ListChecks, count: 7 },
  { href: "/aether", label: "Aether", icon: Bot },
  { href: "/system", label: "System Status", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

type SearchResult = {
  href: string;
  label: string;
  meta: string;
  kind: "event" | "source";
};

function formatClock(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const auth = useAuth();

  useEffect(() => {
    document.documentElement.dataset.argusHydrated = "true";
    const stored = window.localStorage.getItem("argus-nav-collapsed");
    const initialFrame = window.requestAnimationFrame(() => {
      if (stored) setCollapsed(stored === "true");
      setNow(new Date());
    });
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(timer);
      delete document.documentElement.dataset.argusHydrated;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    if (!browserDemoDataEnabled) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const eventResults = demoEvents
      .filter((event) =>
        [event.title, event.region, event.countryName, event.category, ...event.tags]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .slice(0, 5)
      .map((event) => ({
        href: `/events/${event.slug}`,
        label: event.title,
        meta: `${event.region ?? "Global"} · ${event.automatedConfidence}% confidence`,
        kind: "event" as const,
      }));
    const sourceResults = demoSources
      .filter((source) => source.name.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map((source) => ({
        href: "/sources",
        label: source.name,
        meta: `${source.type.toUpperCase()} · reliability ${source.reliabilityScore}%`,
        kind: "source" as const,
      }));
    return [...eventResults, ...sourceResults];
  }, [query]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("argus-nav-collapsed", String(next));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (results[0]) {
      router.push(results[0].href);
      setSearchOpen(false);
      setQuery("");
    }
  }

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className={`app-shell ${collapsed ? "nav-collapsed" : ""}`}>
      <button
        className="mobile-menu-button"
        type="button"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>

      <aside className={`side-nav ${mobileOpen ? "mobile-open" : ""}`} aria-label="Primary navigation">
        <div className="side-nav-header">
          <Link href="/" className="brand-link" aria-label="ARGUS command center">
            <BrandMark compact={collapsed} />
          </Link>
          <button
            className="mobile-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="classification-mark">OPEN SOURCE // PERSONAL</div>

        <nav className="nav-links">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>{item.label}</span>
                {item.count && browserDemoDataEnabled ? <span className="nav-count">{item.count}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="nav-collector-card">
          <span className="status-dot online" />
          {!collapsed && (
            <span>
              <strong>Collection mesh</strong>
              <small>{browserDemoDataEnabled ? "15 / 15 demo sources online" : "Live sources only"}</small>
            </span>
          )}
        </div>

        <button className="collapse-button" type="button" onClick={toggleCollapsed}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span>{collapsed ? "Expand" : "Collapse navigation"}</span>
        </button>
      </aside>

      {mobileOpen ? <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}

      <header className="top-command-bar">
        <button className="global-search-trigger" type="button" onClick={() => setSearchOpen(true)}>
          <Search size={17} aria-hidden="true" />
          <span>Search events, sources, entities...</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className="command-bar-clocks" aria-label="Current time">
          <div>
            <span>UTC</span>
            <strong>{now ? formatClock(now, "UTC") : "--:--:--"}</strong>
          </div>
          <div className="local-clock">
            <span>{localTimeZone.split("/").pop()?.replace("_", " ") ?? "LOCAL"}</span>
            <strong>{now ? formatClock(now) : "--:--:--"}</strong>
          </div>
        </div>

        <div className="top-status" title="All core systems nominal">
          <span className="status-dot online" />
          <span>Operational</span>
        </div>

        <Link href="/aether" className="aether-access">
          <Bot size={17} />
          <span>Aether</span>
        </Link>

        <button className="icon-button notification-button" type="button" aria-label={browserDemoDataEnabled ? "Notifications: 4 unread" : "Notifications: none unread"}>
          <Bell size={18} />
          {browserDemoDataEnabled ? <span>4</span> : null}
        </button>
        <button className="profile-button" type="button" aria-label="Open analyst profile" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
          {auth.principal?.avatarUrl ? <img src={auth.principal.avatarUrl} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" /> : <CircleUserRound size={20} />}
          <span>{auth.principal?.displayName ?? (auth.status === "loading" ? "Identity" : "Sign in")}</span>
        </button>
        {profileOpen ? <div className="absolute right-3 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-white/10 bg-[#0b141d] p-4 shadow-2xl shadow-black/50"><div className="flex items-start gap-3">{auth.principal?.avatarUrl ? <img src={auth.principal.avatarUrl} alt="" className="h-10 w-10 rounded-full border border-white/10" referrerPolicy="no-referrer" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[.03]"><CircleUserRound size={21} /></span>}<div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{auth.principal?.displayName ?? "ARGUS identity"}</p><p className="mt-1 text-[10px] text-slate-500">{auth.principal ? `@${auth.principal.login}` : "GitHub OAuth + PKCE"}</p></div></div>{auth.principal ? <><div className="mt-4 flex flex-wrap gap-1.5">{auth.principal.roles.map((role) => <span key={role} className="rounded border border-cyan-300/15 bg-cyan-300/[.05] px-2 py-1 text-[9px] uppercase tracking-[.08em] text-cyan-200">{role}</span>)}</div><p className="mt-3 text-[10px] leading-5 text-slate-500">Protected actions are checked by the Worker against these D1 roles. Interface visibility is not authorization.</p><button type="button" className="button mt-4 w-full justify-center" onClick={() => { setProfileOpen(false); void auth.signOut(); }}><LogOut size={13} /> Sign out</button></> : <><p className="mt-3 text-[10px] leading-5 text-slate-500">Sign in to receive a stable analyst ID and use role-authorized review tools. {browserDemoDataEnabled ? "Public demonstration views remain available." : "Demonstration views are disabled."}</p><button type="button" className="button button-primary mt-4 w-full justify-center" disabled={auth.status === "loading"} onClick={() => void auth.signIn()}><LogIn size={13} /> Sign in with GitHub</button></>}{auth.error ? <p className="mt-3 rounded border border-red-300/15 bg-red-300/[.04] p-2 text-[10px] leading-4 text-red-200" role="alert">{auth.error}</p> : null}</div> : null}
      </header>

      <main className="app-content">{children}</main>

      {searchOpen ? (
        <div className="command-palette-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <form onSubmit={submitSearch} className="command-search-form">
              <Search size={20} aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ARGUS intelligence..."
                aria-label="Search ARGUS"
              />
              <kbd>ESC</kbd>
            </form>
            <div className="command-results">
              {query && results.length === 0 ? (
                <div className="command-empty">
                  <FileSearch size={22} />
                  <span>No intelligence records match “{query}”</span>
                </div>
              ) : null}
              {!query ? (
                <div className="command-hints">
                  <span><Command size={15} /> Quick navigation</span>
                  {navigation.slice(0, 6).map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)}>
                      <item.icon size={16} /> {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              {results.map((result) => (
                <Link
                  key={`${result.kind}-${result.label}`}
                  href={result.href}
                  className="command-result"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                >
                  {result.kind === "event" ? <Globe2 size={17} /> : <FileText size={17} />}
                  <span>
                    <strong>{result.label}</strong>
                    <small>{result.meta}</small>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
            <footer className="command-footer">
              <span><kbd>↵</kbd> Open</span>
              <span><kbd>↑↓</kbd> Navigate</span>
          <span>{browserDemoDataEnabled ? "Demonstration dataset" : "Public-information workspace"}</span>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
