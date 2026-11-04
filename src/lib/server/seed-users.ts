/**
 * CivicPulse — Statically Bundled Seed Users
 *
 * Demo citizen accounts for local/dev testing only. Every seed user here
 * shares the same bcrypt-hashed demo password ("CivicDemo!2026") — there is
 * no backdoor, no alternate-password list, and no admin account: the admin
 * account is bootstrapped at startup from ADMIN_SEED_PASSWORD
 * (see auth-store.ts), never committed to source.
 */

import bcrypt from "bcryptjs";

export type AppUserSeed = {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "citizen";
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

const DEMO_PASSWORD_HASH = bcrypt.hashSync("CivicDemo!2026", 10);

export const INITIAL_SEEDED_USERS: AppUserSeed[] = [
  {
    id: "USR-MUH4DO9R-6405",
    username: "bipinyadav",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "citizen",
    displayName: "Bipin Yadav",
    createdAt: "2026-09-25T15:32:41.636Z",
    updatedAt: "2026-09-25T15:32:41.637Z",
  },
  {
    id: "USR-MUH4KAWM-8756",
    username: "rahul_kumar",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "citizen",
    displayName: "rahul_kumar",
    createdAt: "2026-09-25T15:37:50.907Z",
    updatedAt: "2026-09-25T15:37:50.908Z",
  },
  {
    id: "USR-MUH5M2N5-7406",
    username: "rahul_sharma",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "citizen",
    displayName: "rahul_sharma",
    createdAt: "2026-09-25T16:07:13.132Z",
    updatedAt: "2026-09-25T16:07:13.135Z",
  },
  {
    id: "USR-MUH5PTIG-8779",
    username: "priya_patel",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "citizen",
    displayName: "priya_patel",
    createdAt: "2026-09-25T16:10:07.919Z",
    updatedAt: "2026-09-25T16:10:07.920Z",
  },
];
