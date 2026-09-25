/**
 * CivicPulse — Server Authentication & User Store
 * Supports Unified Login (Admin & Citizen) with Supabase Cloud Sync and Persistent Local Storage.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { saveUserToSupabase, fetchUserFromSupabase } from "./supabase-client";

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

const IS_VERCEL = Boolean(process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]);
const STORAGE_DIR = IS_VERCEL ? path.join("/tmp", "civic-storage") : path.join(process.cwd(), "storage");
const USERS_FILE = path.join(STORAGE_DIR, "civic-users.json");

export function hashPassword(raw: string): string {
  return crypto.createHash("sha256").update(raw.trim()).digest("hex");
}

export function verifyPassword(raw: string, storedHash: string): boolean {
  if (!raw || !storedHash) return false;
  // Support both SHA-256 hash comparison and direct match (for initial default seeds)
  return storedHash === raw || storedHash === hashPassword(raw);
}

// Default system administrator account (guaranteed)
export const DEFAULT_ADMIN: AppUser = {
  id: "USR-ADMIN-01",
  username: "admin",
  passwordHash: "admin123", // Matches raw and hash
  role: "admin",
  displayName: "Municipal Administrator",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// In-memory cache of users
let cachedUsers: AppUser[] = [DEFAULT_ADMIN];
let initialized = false;

function ensureStorage() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([DEFAULT_ADMIN], null, 2), "utf-8");
    }
  } catch (err: any) {
    console.warn("[Auth Store Storage Warning]:", err.message);
  }
}

export function initializeAuthStore(): void {
  if (initialized) return;
  ensureStorage();

  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedUsers = parsed;
      }
    }
  } catch (err: any) {
    console.warn("[Auth Store Load Warning]:", err.message);
    cachedUsers = [DEFAULT_ADMIN];
  }

  // Ensure default admin always exists and credentials match
  const adminIndex = cachedUsers.findIndex((u) => u.username.toLowerCase() === "admin");
  if (adminIndex === -1) {
    cachedUsers.unshift(DEFAULT_ADMIN);
    persistUsersToDisk();
  } else {
    // Keep admin credentials guaranteed to admin / admin123
    cachedUsers[adminIndex] = {
      ...cachedUsers[adminIndex],
      username: "admin",
      passwordHash: "admin123",
      role: "admin",
      displayName: "Municipal Administrator",
    };
  }

  initialized = true;
  console.info(`[Auth Store]: Initialized with ${cachedUsers.length} user(s).`);
}

function persistUsersToDisk() {
  try {
    ensureStorage();
    fs.writeFileSync(USERS_FILE, JSON.stringify(cachedUsers, null, 2), "utf-8");
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
 */
export async function authenticateUser(
  rawUsername: string,
  rawPassword: string,
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

  // Special instant check for Admin: username 'admin' and password 'admin123'
  if (username.toLowerCase() === "admin") {
    if (password === "admin123") {
      return {
        success: true,
        user: toSafeUser(DEFAULT_ADMIN),
      };
    } else {
      return {
        success: false,
        error: "Incorrect password for admin. Use 'admin123'.",
      };
    }
  }

  // Check local cache
  let user = cachedUsers.find((u) => u.username.toLowerCase() === username.toLowerCase());

  // If not found in cache, check Supabase
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
    return { success: false, error: "Passwords do not match. Please verify your confirm password." };
  }

  // 2. Check if username already exists locally
  const existingLocal = cachedUsers.find((u) => u.username.toLowerCase() === username.toLowerCase());
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
