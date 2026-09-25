import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { BrandMark } from "@/components/site/primitives";
import { useAuth } from "@/lib/auth-client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Municipal Staff Portal — CivicPulse" },
      {
        name: "description",
        content:
          "Review incoming civic reports, assign responsibility, track field work and monitor department performance.",
      },
      { property: "og:title", content: "Municipal Staff Portal — CivicPulse" },
      { property: "og:description", content: "Report intake, routing, assignment and analytics for municipal teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLayout,
});

const MENU = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/reports", label: "Live Reports" },
  { to: "/admin/map", label: "Map View" },
] as const;

function AdminLayout() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground lg:w-64 lg:shrink-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 px-5 py-4 font-display text-base font-extrabold">
            <BrandMark className="bg-sidebar-accent" />
            CivicPulse Staff
          </div>

          {/* Current Auth Status Pill */}
          <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-2.5 text-xs">
            {isAdmin ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">🛡️</span>
                  <div className="truncate">
                    <p className="font-bold truncate text-sidebar-foreground">Admin: {user?.username}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold">● Full Municipal Access</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate({ to: "/signin" });
                  }}
                  className="rounded-lg bg-sidebar-border px-2 py-1 text-[11px] font-bold hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0"
                  title="Sign out of Admin"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <span>⚠️</span>
                  <span>{user ? `Signed in as ${user.username} (Citizen)` : "Not Signed In"}</span>
                </div>
                <p className="text-[11px] text-sidebar-foreground/70">
                  Full admin privileges require username <code className="font-bold text-sidebar-foreground">admin</code>.
                </p>
                <Link
                  to="/signin"
                  className="mt-1 block rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-center py-1 font-bold text-xs hover:opacity-90"
                >
                  Sign In as Admin →
                </Link>
              </div>
            )}
          </div>

          <nav aria-label="Staff navigation" className="px-3 pb-5">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {MENU.map((m) => (
                <li key={m.to}>
                  <Link
                    to={m.to}
                    activeOptions={{ exact: m.to === "/admin" }}
                    activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
                    className="block rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    {m.label}
                  </Link>
                </li>
              ))}
              {["Departments", "Field Workers", "Assignments", "Analytics", "Notifications", "Settings", "Audit Logs"].map(
                (label) => (
                  <li key={label}>
                    <span className="block rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-sidebar-foreground/45">
                      {label}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <Link
            to="/"
            className="block rounded-xl border border-sidebar-border px-3 py-2.5 text-center text-sm font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors"
          >
            ← Back to public site
          </Link>
        </div>
      </aside>

      <main className="flex-1 px-5 py-8 lg:px-8">
        {/* If user is citizen and viewing admin, show quick notice banner */}
        {isAuthenticated && !isAdmin && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                <span className="text-base">ℹ️</span>
                <span>
                  You are currently logged in as citizen <strong>{user?.username}</strong>. You are previewing municipal operations. Sign in with <strong>admin / admin123</strong> for municipal administrative actions.
                </span>
              </div>
              <Link
                to="/signin"
                className="rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 transition-colors"
              >
                Switch to Admin Login
              </Link>
            </div>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
