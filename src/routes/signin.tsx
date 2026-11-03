import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { BrandMark } from "@/components/site/primitives";
import { loginUser, registerCitizen, useAuth } from "@/lib/auth-client";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In & Account Registration — CivicPulse" },
      {
        name: "description",
        content:
          "Unified login for citizens and municipal staff. Sign in with username and password to track reports or access the municipal administration portal.",
      },
      { property: "og:title", content: "Sign In & Account Registration — CivicPulse" },
      { property: "og:description", content: "Unified login and registration for CivicPulse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UnifiedAuthPage,
});

function UnifiedAuthPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Mode: "signin" | "register"
  const [mode, setMode] = useState<"signin" | "register">("signin");

  // Form inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);

  // Check Supabase status on mount
  useEffect(() => {
    fetch("/api/supabase/status")
      .then((r) => r.json())
      .then((data) => {
        setSupabaseStatus({
          connected: Boolean(data.connected),
          message: data.connected
            ? "Supabase Live Cloud DB Synced"
            : "Supabase Ready (Hybrid Persistence Active)",
        });
      })
      .catch(() => {
        setSupabaseStatus({
          connected: false,
          message: "Local & Cloud Hybrid Auth Ready",
        });
      });

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "register" || params.get("action") === "create") {
        setMode("register");
      }
    }
  }, []);

  // Quick autofill for Admin
  const fillAdmin = () => {
    setMode("signin");
    setUsername("admin");
    setPassword("admin123");
    setError(null);
    setSuccess("Admin credentials filled! Click 'Sign In' to enter the Admin Dashboard.");
  };

  // Form submission handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("Please enter your username.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register") {
      if (cleanUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }
      if (cleanUsername.toLowerCase() === "admin") {
        setError("Username 'admin' is reserved for municipal administration.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify your confirm password.");
        return;
      }

      setLoading(true);
      const res = await registerCitizen(cleanUsername, password, confirmPassword);
      setLoading(false);

      if (res.success && res.user) {
        setSuccess(
          `✓ Account "${cleanUsername}" created! Your credentials are filled below. Click "Sign In to Dashboard" to log in, or continue directly.`,
        );
        setMode("signin");
        setUsername(cleanUsername);
        setPassword(password);
        setConfirmPassword("");
      } else {
        setError(res.error || "Failed to create account. Please try another username.");
      }
      return;
    }

    // Sign In Mode
    setLoading(true);
    const res = await loginUser(cleanUsername, password);
    setLoading(false);

    if (res.success && res.user) {
      if (res.user.role === "admin") {
        setSuccess("✓ Administrator authenticated! Directing to Municipal Admin Dashboard...");
        window.setTimeout(() => {
          navigate({ to: "/admin" });
        }, 800);
      } else {
        setSuccess(`✓ Welcome back, ${res.user.username}! Directing to your Citizen Dashboard...`);
        window.setTimeout(() => {
          navigate({ to: "/dashboard" });
        }, 800);
      }
    } else {
      setError(res.error || "Invalid username or password. Please verify your credentials.");
    }
  }

  return (
    <SiteLayout>
      <div className="container-page min-h-[calc(100vh-140px)] py-12 lg:py-20">
        <div className="mx-auto max-w-5xl grid items-center gap-10 lg:grid-cols-12">
          {/* Left Hero & Guidance Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
              </span>
              Unified Municipal & Citizen Authentication
            </div>

            <div className="space-y-3">
              <BrandMark className="size-12" />
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-foreground">
                One Login for CivicPulse
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Access your personalized dashboard using your single username and password. The
                system automatically routes you to the correct interface based on your credentials.
              </p>
            </div>

            {/* Role routing information card */}
            <div className="space-y-3 rounded-2xl border border-border/70 bg-surface/50 p-4 text-xs backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal/10 font-bold text-teal">
                  👤
                </div>
                <div>
                  <span className="font-bold text-foreground">Citizen Account</span>
                  <p className="text-muted-foreground mt-0.5">
                    Create an account with username & password to submit and track complaints,
                    upvote issues, and get live status alerts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-border/40">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                  🛡️
                </div>
                <div>
                  <span className="font-bold text-foreground">Municipal Administrator</span>
                  <p className="text-muted-foreground mt-0.5">
                    Municipal staff sign in with username{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-primary font-bold">
                      admin
                    </code>{" "}
                    and password{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-primary font-bold">
                      admin123
                    </code>{" "}
                    to access the live administrative queue.
                  </p>
                </div>
              </div>
            </div>

            {/* Supabase status indicator */}
            {supabaseStatus && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3.5 py-2 text-xs text-muted-foreground">
                <span
                  className={
                    "size-2 rounded-full " +
                    (supabaseStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-teal")
                  }
                />
                <span className="font-medium">{supabaseStatus.message}</span>
              </div>
            )}

            {/* If user is already logged in */}
            {isAuthenticated && user && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-foreground">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">
                  Currently signed in as: <span className="underline">{user.username}</span> (
                  {user.role})
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Link
                    to={user.role === "admin" ? "/admin" : "/dashboard"}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Go to {user.role === "admin" ? "Admin Portal" : "My Dashboard"} →
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Form Card */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl md:p-8 backdrop-blur">
              {/* Card top tab toggle */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-2 mb-6 text-sm font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                  }}
                  className={
                    "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold transition-all " +
                    (mode === "signin"
                      ? "bg-background text-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <span className="text-base">🔑</span>
                  <span>Login (User & Admin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setSuccess(null);
                  }}
                  className={
                    "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold transition-all " +
                    (mode === "register"
                      ? "bg-background text-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <span className="text-base">➕</span>
                  <span>Create New Account</span>
                </button>
              </div>

              {/* Form Header */}
              <div className="mb-6">
                <h2 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                  {mode === "signin" ? "One Login for User & Admin" : "Create New User Account"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {mode === "signin"
                    ? "Sign in with your username and password. For Admin, use username 'admin' and password 'admin123' to enter the Admin Dashboard. Users use their created credentials."
                    : "Create a user account with username, password, and confirm password. You can create multiple user accounts to submit and track reports."}
                </p>
              </div>

              {/* Form Element */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                      <span className="text-sm">👤</span>
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder={
                        mode === "signin"
                          ? "Enter username (e.g. admin or your username)"
                          : "Choose a username (e.g. citizen_jane)"
                      }
                      required
                    />
                  </div>
                  {mode === "register" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      At least 3 characters. Letters, numbers, hyphens and underscores.
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                      <span className="text-sm">🔒</span>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder={
                        mode === "signin"
                          ? "Enter your password"
                          : "Create password (min 6 characters)"
                      }
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password (only in Register mode) */}
                {mode === "register" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                        <span className="text-sm">🛡️</span>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Re-enter your password to confirm"
                        required
                      />
                    </div>
                    {password && confirmPassword && (
                      <p
                        className={
                          "mt-1 text-[11px] font-semibold " +
                          (password === confirmPassword
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive")
                        }
                      >
                        {password === confirmPassword
                          ? "✓ Passwords match"
                          : "✗ Passwords do not match"}
                      </p>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive animate-in fade-in"
                  >
                    <span className="text-sm">⚠️</span>
                    <span className="flex-1">{error}</span>
                  </div>
                )}

                {/* Success Banner */}
                {success && (
                  <div
                    role="status"
                    className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-in fade-in"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm">✓</span>
                      <span className="flex-1">{success}</span>
                    </div>
                    {isAuthenticated && user && (
                      <div className="mt-1 flex items-center gap-2">
                        <Link
                          to={user.role === "admin" ? "/admin" : "/dashboard"}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          Go directly to {user.role === "admin" ? "Admin Portal" : "My Dashboard"} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-md transition-all hover:opacity-95 hover:shadow-lg disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      <span>
                        {mode === "signin" ? "Verifying Credentials…" : "Creating Account…"}
                      </span>
                    </>
                  ) : mode === "signin" ? (
                    <>
                      <span>Sign In to Dashboard</span>
                      <span>→</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <span>✓</span>
                    </>
                  )}
                </button>

                {/* Quick Admin Auto-fill Button for Convenience */}
                {mode === "signin" && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={fillAdmin}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <span>⚡ Quick fill Admin:</span>
                      <span className="font-mono font-bold">admin / admin123</span>
                    </button>
                  </div>
                )}

                {/* Mode toggle link */}
                <div className="pt-2 text-center text-xs text-muted-foreground">
                  {mode === "signin" ? (
                    <p>
                      Need an account to track your reports?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("register");
                          setError(null);
                          setSuccess(null);
                        }}
                        className="font-bold text-primary hover:underline"
                      >
                        Create Citizen Account
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signin");
                          setError(null);
                          setSuccess(null);
                        }}
                        className="font-bold text-primary hover:underline"
                      >
                        Sign in here
                      </button>
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
