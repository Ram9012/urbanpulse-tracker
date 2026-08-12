import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BrandMark } from "@/components/site/primitives";

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
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-4 font-display text-base font-extrabold">
          <BrandMark className="bg-sidebar-accent" />
          CivicPulse Staff
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
          <Link
            to="/"
            className="mt-4 block rounded-xl border border-sidebar-border px-3 py-2.5 text-sm font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent"
          >
            ← Back to public site
          </Link>
        </nav>
      </aside>
      <main className="flex-1 px-5 py-8 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
