/**
 * Side-effect-only module: populates process.env from .env and .env.local
 * before any other module reads it.
 *
 * Must be imported (not just called) ahead of any other import in
 * vite.config.ts — ES module `import` declarations are all resolved and
 * their target modules fully evaluated before the importing module's own
 * top-level code runs, but sibling imports are evaluated in textual order,
 * so this file being imported first guarantees process.env is populated
 * before src/lib/server/*.ts (which read it at module-load time) import.
 */
import { config as loadDotenv } from "dotenv";

loadDotenv(); // .env
loadDotenv({ path: ".env.local", override: true }); // .env.local wins over .env
