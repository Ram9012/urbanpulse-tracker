// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
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
