// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//
// This config's own loadEnv() call only exposes VITE_-prefixed vars (to the
// client bundle). Server-only vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ADMIN_SEED_PASSWORD, SESSION_SECRET, ...) are read from plain
// `process.env` by src/lib/server/*.ts at module-load time. This import
// MUST stay first: ES modules evaluate sibling imports in textual order,
// and ./scripts/load-env populates process.env as a side effect before the
// civicPulseApiPlugin import below pulls in supabase-client.ts.
import "./scripts/load-env";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { civicPulseApiPlugin } from "./src/lib/server/api-middleware";

export default defineConfig({
  vite: {
    plugins: [civicPulseApiPlugin()],
    server: {
      watch: {
        // storage/*.json is runtime data the API writes to at request time
        // (users, reports, history) — it must never trigger HMR.
        ignored: ["**/storage/**"],
        // On some filesystems (e.g. network-mounted drives) native fs.watch
        // throws on certain change events regardless of ignore patterns —
        // polling avoids the native watcher entirely.
        usePolling: true,
        interval: 300,
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
});
