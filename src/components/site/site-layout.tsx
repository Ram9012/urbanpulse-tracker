import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BRAND, LANGUAGES } from "@/lib/civic-data";
import { BrandMark } from "./primitives";
import { useAuth } from "@/lib/auth-client";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/explore", label: "Explore Reports" },
  { to: "/impact", label: "Impact" },
  { to: "/help", label: "Help Center" },
] as const;

function AnnouncementBar() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="bg-navy text-navy-foreground">
      <div className="container-page flex items-center gap-3 py-2 text-xs sm:text-sm">
        <span
          className="relative flex size-2 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <span className="absolute size-2 rounded-full bg-teal animate-civic-pulse" />
          <span className="size-2 rounded-full bg-teal" />
        </span>
        <p className="min-w-0 flex-1 truncate">
          Now serving smarter civic reporting for cleaner, safer communities.{" "}
          <Link to="/how-it-works" className="font-semibold underline underline-offset-4">
            See how it works
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss announcement"
          className="rounded-md p-1 transition-colors hover:bg-navy-foreground/15"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-border bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70"
          : "border-transparent bg-surface",
      )}
    >
      <nav
        aria-label="Main navigation"
        className={cn(
          "container-page flex items-center gap-4 transition-all duration-300",
          scrolled ? "h-14" : "h-16 md:h-[72px]",
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-extrabold">
          <BrandMark />
          <span>{BRAND.name}</span>
        </Link>

        <ul className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "bg-accent text-accent-foreground" }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-accent"
              >
                <span>{user.role === "admin" ? "🛡️" : "👤"}</span>
                <span>{user.username}</span>
                <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary uppercase">
                  {user.role}
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-border/80 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Sign out of CivicPulse"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              to="/signin"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent sm:inline-flex"
            >
              Sign In
            </Link>
          )}

          <Link
            to="/report"
            className="inline-flex min-h-11 items-center rounded-xl bg-warm px-4 text-sm font-bold text-warm-foreground shadow-soft transition-all hover:shadow-lift hover:brightness-105"
          >
            Report an Issue
          </Link>
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-border lg:hidden"
          >
            <span aria-hidden="true">{menu ? "✕" : "☰"}</span>
          </button>
        </div>
      </nav>

      {menu && (
        <div className="border-t border-border bg-surface lg:hidden">
          <ul className="container-page grid gap-1 py-3">
            {[
              ...NAV,
              ...(isAuthenticated && user
                ? [
                    {
                      to: user.role === "admin" ? "/admin" : "/dashboard",
                      label:
                        user.role === "admin"
                          ? "🛡️ Admin Portal"
                          : `👤 My Dashboard (${user.username})`,
                    },
                  ]
                : [{ to: "/signin", label: "Sign In" }]),
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMenu(false)}
                  className="block rounded-xl px-3 py-3 text-base font-semibold transition-colors hover:bg-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {isAuthenticated && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMenu(false);
                  }}
                  className="w-full text-left rounded-xl px-3 py-3 text-base font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Sign Out
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const groups = [
    {
      title: "Product",
      links: [
        { to: "/how-it-works", label: "How it works" },
        { to: "/explore", label: "Explore reports" },
        { to: "/impact", label: "Community impact" },
      ],
    },
    {
      title: "For citizens",
      links: [
        { to: "/report", label: "Report an issue" },
        { to: "/dashboard", label: "My dashboard" },
        { to: "/help", label: "Help center" },
      ],
    },
    {
      title: "For municipal staff",
      links: [
        { to: "/admin", label: "Municipal dashboard" },
        { to: "/admin/reports", label: "Report management" },
        { to: "/admin/map", label: "Map view" },
      ],
    },
    {
      title: "Policies",
      links: [
        { to: "/help", label: "Privacy policy" },
        { to: "/help", label: "Terms of service" },
        { to: "/help", label: "Accessibility" },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border bg-navy text-navy-foreground">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="flex items-center gap-2.5 font-display text-lg font-extrabold">
            <BrandMark className="bg-navy-foreground/10" />
            {BRAND.name}
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-navy-foreground/70">
            A civic reporting platform that connects residents with the municipal teams responsible
            for their streets, water, waste and public spaces.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-navy-foreground/70">
            <li>{BRAND.email}</li>
            <li>Helpline {BRAND.phone}</li>
            <li>{BRAND.city}</li>
          </ul>
          <div className="mt-4 flex gap-2">
            {["X", "in", "f", "▶"].map((s) => (
              <a
                key={s}
                href="/help"
                aria-label={`CivicPulse on ${s}`}
                className="inline-flex size-10 items-center justify-center rounded-xl bg-navy-foreground/10 text-sm font-bold transition-colors hover:bg-navy-foreground/20"
              >
                <span aria-hidden="true">{s}</span>
              </a>
            ))}
          </div>
        </div>

        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="text-sm font-bold">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm text-navy-foreground/70 transition-colors hover:text-navy-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-navy-foreground/10">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-5 text-xs text-navy-foreground/60 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. Sample civic platform for demonstration.
          </p>
          <label className="flex items-center gap-2">
            <span>Language</span>
            <select
              className="min-h-11 rounded-lg border border-navy-foreground/20 bg-transparent px-2 py-1 text-navy-foreground"
              defaultValue={LANGUAGES[0]}
            >
              {LANGUAGES.map((l) => (
                <option key={l} className="text-foreground">
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Link
        to="/report"
        className="fixed inset-x-4 bottom-4 z-40 inline-flex min-h-12 items-center justify-center rounded-2xl bg-warm text-sm font-bold text-warm-foreground shadow-lift sm:hidden"
      >
        Report an Issue
      </Link>
      <Footer />
    </div>
  );
}
