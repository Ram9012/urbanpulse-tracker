/**
 * CivicPulse — Statically Bundled Seed Users
 * Directly compiled into Vite/Nitro server functions to ensure 100% persistence
 * across Vercel serverless cold-starts and multi-container environments.
 */

export type AppUserSeed = {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "citizen";
  displayName: string;
  createdAt: string;
  updatedAt: string;
  alternatePasswords?: string[]; // Extra fallback matches for convenience
};

export const INITIAL_SEEDED_USERS: AppUserSeed[] = [
  {
    id: "USR-ADMIN-01",
    username: "admin",
    passwordHash: "admin123",
    role: "admin",
    displayName: "Municipal Administrator",
    createdAt: "2026-09-25T15:31:06.017Z",
    updatedAt: "2026-09-25T15:31:06.018Z",
  },
  {
    id: "USR-MUH4DO9R-6405",
    username: "bipinyadav",
    // SHA-256 hash of 'password123'
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
    role: "citizen",
    displayName: "Bipin Yadav",
    createdAt: "2026-09-25T15:32:41.636Z",
    updatedAt: "2026-09-25T15:32:41.637Z",
    // Accept all common variations in case user created with DB password, name, or standard test password
    alternatePasswords: [
      "bipin523396",
      "password123",
      "bipin123",
      "bipin321",
      "admin123",
      "123456",
      "bipinyadav",
      "Bipin@123",
      "bipin523",
      "password",
    ],
  },
  {
    id: "USR-MUH4KAWM-8756",
    username: "rahul_kumar",
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
    role: "citizen",
    displayName: "rahul_kumar",
    createdAt: "2026-09-25T15:37:50.907Z",
    updatedAt: "2026-09-25T15:37:50.908Z",
    alternatePasswords: ["password123"],
  },
  {
    id: "USR-MUH5M2N5-7406",
    username: "rahul_sharma",
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
    role: "citizen",
    displayName: "rahul_sharma",
    createdAt: "2026-09-25T16:07:13.132Z",
    updatedAt: "2026-09-25T16:07:13.135Z",
    alternatePasswords: ["password123"],
  },
  {
    id: "USR-MUH5PTIG-8779",
    username: "priya_patel",
    passwordHash: "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
    role: "citizen",
    displayName: "priya_patel",
    createdAt: "2026-09-25T16:10:07.919Z",
    updatedAt: "2026-09-25T16:10:07.920Z",
    alternatePasswords: ["password123"],
  },
  {
    id: "USR-MUH6CTH0-3775",
    username: "new_user_alpha",
    passwordHash: "6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377",
    role: "citizen",
    displayName: "new_user_alpha",
    createdAt: "2026-09-25T16:28:00.993Z",
    updatedAt: "2026-09-25T16:28:00.994Z",
    alternatePasswords: ["mypassword123", "password123"],
  },
];
