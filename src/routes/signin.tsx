import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { BrandMark } from "@/components/site/primitives";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In to Track Your Civic Reports — CivicPulse" },
      {
        name: "description",
        content:
          "Sign in as a citizen to track your civic reports, or as municipal staff to access the report management portal.",
      },
      { property: "og:title", content: "Sign In to Track Your Civic Reports — CivicPulse" },
      { property: "og:description", content: "Citizen and municipal staff sign-in for CivicPulse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"citizen" | "staff">("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      navigate({ to: role === "staff" ? "/admin" : "/dashboard" });
    }, 700);
  }

  return (
    <SiteLayout>
      <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <BrandMark className="size-12" />
          <h1 className="mt-6 text-3xl font-extrabold md:text-4xl">Sign in to CivicPulse</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Citizens track their reports and notifications. Municipal staff review incoming reports,
            assign responsibility and keep citizens informed.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>• Role-based access: citizen, staff, department manager, field worker, administrator.</li>
            <li>• Sessions are protected and every staff action is written to an audit log.</li>
            <li>• This demo sign-in does not create a real account yet.</li>
          </ul>
        </div>

        <form onSubmit={submit} className="surface-card p-6 md:p-8" noValidate>
          <div role="group" aria-label="Account type" className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(["citizen", "staff"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={
                  "min-h-11 rounded-lg text-sm font-bold transition-colors " +
                  (role === r ? "bg-surface shadow-soft" : "text-muted-foreground hover:text-foreground")
                }
              >
                {r === "citizen" ? "Citizen" : "Municipal staff"}
              </button>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              placeholder="At least 6 characters"
              required
            />
          </label>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-70"
          >
            {loading ? "Signing in…" : role === "staff" ? "Sign in to staff portal" : "Sign in"}
          </button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link to="/report" className="font-bold text-primary hover:underline">
              You can still report an issue
            </Link>
          </p>
        </form>
      </div>
    </SiteLayout>
  );
}
