/**
 * CivicPulse — Server Authentication & User Store
 * Supports Unified Login (Admin & Citizen) with Supabase Cloud Sync and Persistent Local Storage.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { saveUserToSupabase, fetchUserFromSupabase } from "./supabase-client";
import { INITIAL_SEEDED_USERS } from "./seed-users";

export type UserRole = "admin" | "citizen";

export type AppUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type SafeUser = {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  createdAt: string;
};

export const SESSION_COOKIE_NAME = "civicpulse_session";

// Falls back to a random per-process secret so sessions still work without
// configuration, but set SESSION_SECRET in the environment for sessions to
// survive a server restart / serverless cold start.
const SESSION_SECRET = process.env["SESSION_SECRET"] || crypto.randomBytes(32).toString("hex");

/** Sign a compact, tamper-evident session token for a user. */
export function createSessionToken(user: SafeUser): string {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, username: user.username, role: user.role }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Verify a session token and return the role/identity it carries, or null. */
export function verifySessionToken(
  token: string | null | undefined,
): { id: string; username: string; role: UserRole } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

/** Parse the session cookie from a raw Cookie header and verify it. */
export function getSessionFromCookieHeader(
  cookieHeader?: string | null,
): { id: string; username: string; role: UserRole } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match || !match[1]) return null;
  return verifySessionToken(decodeURIComponent(match[1]));
}

const IS_VERCEL = Boolean(process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]);
const STORAGE_DIR = IS_VERCEL
  ? path.join("/tmp", "civic-storage")
  : path.join(process.cwd(), "storage");
const USERS_FILE = path.join(STORAGE_DIR, "civic-users.json");
const BUNDLED_USERS_FILE = path.join(process.cwd(), "storage", "civic-users.json");

export function hashPassword(raw: string): string {
  return bcrypt.hashSync(raw.trim(), 10);
}

export function verifyPassword(raw: string, storedHash: string): boolean {
  if (!raw || !storedHash) return false;
  try {
    return bcrypt.compareSync(raw, storedHash);
  } catch {
    // storedHash isn't a valid bcrypt hash (e.g. legacy SHA-256 data) — reject.
    return false;
  }
}

// Default system administrator account, bootstrapped from ADMIN_SEED_PASSWORD.
// Never hardcode a real admin password in source.
const ADMIN_SEED_PASSWORD = process.env["ADMIN_SEED_PASSWORD"];
export const DEFAULT_ADMIN: AppUser = {
  id: "USR-ADMIN-01",
  username: "admin",
  passwordHash: ADMIN_SEED_PASSWORD
    ? hashPassword(ADMIN_SEED_PASSWORD)
    : // No seed password configured: generate a random hash so the account
      // exists but no password will ever match it until ADMIN_SEED_PASSWORD
      // is set and the app restarts.
      hashPassword(crypto.randomUUID()),
  role: "admin",
  displayName: "Municipal Administrator",
  createdAt: "2026-09-25T15:31:06.017Z",
  updatedAt: "2026-09-25T15:31:06.018Z",
};
if (!ADMIN_SEED_PASSWORD) {
  console.warn(
    "[Auth Store]: ADMIN_SEED_PASSWORD is not set — the admin account has no usable password until it is configured.",
  );
}

// In-memory cache of users initialized with all statically bundled users
let cachedUsers: AppUser[] = [...INITIAL_SEEDED_USERS];
let initialized = false;

export function syncUsersFromCookie(cookieHeader?: string | null) {
  if (!cookieHeader) return;
  try {
    const match = cookieHeader.match(/civicpulse_client_users=([^;]+)/);
    if (match && match[1]) {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (Array.isArray(parsed)) {
        for (const u of parsed) {
          if (
            u &&
            u.username &&
            !cachedUsers.some((x) => x.username.toLowerCase() === u.username.toLowerCase())
          ) {
            cachedUsers.push({
              id: u.id || `USR-${Date.now().toString(36).toUpperCase()}`,
              username: u.username,
              passwordHash: u.passwordHash || (u.password ? hashPassword(u.password) : ""),
              role: u.role || "citizen",
              displayName: u.displayName || u.username,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {}
}

function ensureStorage() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      let initialSeed = [DEFAULT_ADMIN];
      if (fs.existsSync(BUNDLED_USERS_FILE)) {
        try {
          const raw = fs.readFileSync(BUNDLED_USERS_FILE, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialSeed = parsed;
          }
        } catch {}
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(initialSeed, null, 2), "utf-8");
    }
  } catch (err: any) {
    console.warn("[Auth Store Storage Warning]:", err.message);
  }
}

export function initializeAuthStore(): void {
  ensureStorage();

  try {
    // 1. Load from runtime storage file
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedUsers = parsed;
      }
    }
    // 2. Merge any users from repo bundled storage file
    if (fs.existsSync(BUNDLED_USERS_FILE) && BUNDLED_USERS_FILE !== USERS_FILE) {
      try {
        const bundledData = fs.readFileSync(BUNDLED_USERS_FILE, "utf-8");
        const bundledParsed = JSON.parse(bundledData);
        if (Array.isArray(bundledParsed)) {
          for (const u of bundledParsed) {
            if (!cachedUsers.some((x) => x.username.toLowerCase() === u.username.toLowerCase())) {
              cachedUsers.push(u);
            }
          }
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn("[Auth Store Load Warning]:", err.message);
    cachedUsers = [DEFAULT_ADMIN];
  }

  // Ensure the admin account exists, bootstrapped from ADMIN_SEED_PASSWORD
  const adminIndex = cachedUsers.findIndex((u) => u.username.toLowerCase() === "admin");
  if (adminIndex === -1) {
    cachedUsers.unshift(DEFAULT_ADMIN);
    persistUsersToDisk();
  }

  initialized = true;
  console.info(`[Auth Store]: Initialized with ${cachedUsers.length} user(s).`);
}

function persistUsersToDisk() {
  try {
    ensureStorage();
    fs.writeFileSync(USERS_FILE, JSON.stringify(cachedUsers, null, 2), "utf-8");
    if (
      !IS_VERCEL &&
      BUNDLED_USERS_FILE !== USERS_FILE &&
      fs.existsSync(path.dirname(BUNDLED_USERS_FILE))
    ) {
      try {
        fs.writeFileSync(BUNDLED_USERS_FILE, JSON.stringify(cachedUsers, null, 2), "utf-8");
      } catch {}
    }
  } catch (err: any) {
    console.warn("[Auth Store Persist Warning]:", err.message);
  }
}

export function toSafeUser(user: AppUser): SafeUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.username,
    createdAt: user.createdAt,
  };
}

/**
 * Authenticate either admin or registered user with a single username and password.
 * Supports clientBackupUser to reliably recover user sessions across serverless lambda containers.
 */
export async function authenticateUser(
  rawUsername: string,
  rawPassword: string,
  clientBackupUser?: {
    id?: string;
    username: string;
    password?: string;
    passwordHash?: string;
    role?: UserRole;
    displayName?: string;
  },
): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  initializeAuthStore();

  const username = (rawUsername || "").trim();
  const password = rawPassword || "";

  if (!username) {
    return { success: false, error: "Please enter your username." };
  }
  if (!password) {
    return { success: false, error: "Please enter your password." };
  }

  // 1. Check local cache (includes the bootstrapped admin account)
  let user = cachedUsers.find((u) => u.username.toLowerCase() === username.toLowerCase());

  // 2. If not found in cache, check Supabase
  if (!user) {
    try {
      const remoteUser = await fetchUserFromSupabase(username);
      if (remoteUser) {
        user = remoteUser;
        cachedUsers.push(remoteUser);
        persistUsersToDisk();
      }
    } catch {}
  }

  // 3. If not found in current container, recover from clientBackupUser if provided and valid
  if (
    !user &&
    clientBackupUser &&
    clientBackupUser.username.toLowerCase() === username.toLowerCase()
  ) {
    const rawPass = clientBackupUser.password || password;
    const storedHash = clientBackupUser.passwordHash || hashPassword(rawPass);
    const restoredUser: AppUser = {
      id: clientBackupUser.id || `USR-${Date.now().toString(36).toUpperCase()}`,
      username: clientBackupUser.username,
      passwordHash: storedHash,
      role: clientBackupUser.role || "citizen",
      displayName: clientBackupUser.displayName || clientBackupUser.username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cachedUsers.push(restoredUser);
    persistUsersToDisk();
    user = restoredUser;
  }

  if (!user) {
    return {
      success: false,
      error: `Account with username "${username}" not found. Please create an account first.`,
    };
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return {
      success: false,
      error: "Incorrect password. Please try again.",
    };
  }

  return {
    success: true,
    user: toSafeUser(user),
  };
}

/**
 * Register a new citizen account with username, password, and confirm password.
 */
export async function registerUser(
  rawUsername: string,
  rawPassword: string,
  rawConfirmPassword?: string,
  rawDisplayName?: string,
): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  initializeAuthStore();

  const username = (rawUsername || "").trim();
  const password = rawPassword || "";
  const confirmPassword = rawConfirmPassword !== undefined ? rawConfirmPassword : password;

  // 1. Validation
  if (!username) {
    return { success: false, error: "Username is required." };
  }
  if (username.length < 3) {
    return { success: false, error: "Username must be at least 3 characters." };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return {
      success: false,
      error: "Username can only contain letters, numbers, underscores, and hyphens.",
    };
  }

  if (username.toLowerCase() === "admin") {
    return {
      success: false,
      error: "The username 'admin' is reserved for municipal administration.",
    };
  }

  if (!password) {
    return { success: false, error: "Password is required." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      error: "Passwords do not match. Please verify your confirm password.",
    };
  }

  // 2. Check if username already exists locally
  const existingLocal = cachedUsers.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (existingLocal) {
    return {
      success: false,
      error: `Username "${username}" is already taken. Please choose another username.`,
    };
  }

  // 3. Check if username exists in Supabase
  try {
    const existingRemote = await fetchUserFromSupabase(username);
    if (existingRemote) {
      return {
        success: false,
        error: `Username "${username}" is already registered in the system.`,
      };
    }
  } catch {}

  // 4. Create new user
  const newUser: AppUser = {
    id: `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    username,
    passwordHash: hashPassword(password),
    role: "citizen",
    displayName: (rawDisplayName || "").trim() || username,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  cachedUsers.push(newUser);
  persistUsersToDisk();

  // 5. Asynchronously persist to Supabase
  saveUserToSupabase(newUser).catch((err) => {
    console.warn("[Supabase Async User Sync Notice]:", err.message);
  });

  return {
    success: true,
    user: toSafeUser(newUser),
  };
}

export function getAllUsers(): SafeUser[] {
  initializeAuthStore();
  return cachedUsers.map(toSafeUser);
}
