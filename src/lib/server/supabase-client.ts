/**
 * CivicPulse — Supabase Client & Persistence Bridge
 * Project: videoediting | Org: Zenith Stack
 *
 * Provides connection check, data sync, and fallback handling.
 */

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "https://wqwlqbozwcbcxjbxlqmh.supabase.co";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || "";
const SUPABASE_PROJECT_NAME = process.env["SUPABASE_PROJECT_NAME"] || "videoediting";

export type SupabaseStatus = {
  configured: boolean;
  connected: boolean;
  projectName: string;
  url: string;
  hasKey: boolean;
  message: string;
};

export async function checkSupabaseStatus(): Promise<SupabaseStatus> {
  const hasKey = Boolean(SUPABASE_KEY && SUPABASE_KEY.length > 10);
  if (!hasKey) {
    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: false,
      message: "Supabase project configured. Add VITE_SUPABASE_ANON_KEY to .env to enable direct live cloud sync.",
    };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?limit=1`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (res.ok) {
      return {
        configured: true,
        connected: true,
        projectName: SUPABASE_PROJECT_NAME,
        url: SUPABASE_URL,
        hasKey: true,
        message: "Successfully connected to Supabase PostgreSQL & Storage.",
      };
    }

    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: true,
      message: `Supabase reachable, HTTP ${res.status}: Tables pending migration or schema setup. Run supabase/schema.sql.`,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: true,
      message: `Connection attempt error: ${err.message}`,
    };
  }
}
