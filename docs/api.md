# API Reference

All endpoints live under `/api/*`, are implemented in `src/lib/server/api-middleware.ts`, and speak
JSON. Unknown `/api/*` paths fall through (no explicit 404 JSON).

> ⚠️ **Authentication/authorization: none is enforced server-side.** Every endpoint below —
> including destructive admin ones — can be called by anyone who can reach the server. See
> [security.md](security.md). Errors inside a handler return `500 {"error": "<message>"}`.

## AI

| Method | Path                        | Body                                                                        | Response                                                                                                                 |
| ------ | --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/api/ai/analyze`           | `{ description, categoryName? }`                                            | AI classification/priority/summary + category-mismatch hint (JSON from the LLM)                                          |
| POST   | `/api/ai/duplicate-check`   | `{ newDescription, existingReport: {id,title,description,area,category?} }` | `{ is_duplicate, similarity_score (0-100), explanation, recommended_action: "add_info_to_existing" \| "keep_separate" }` |
| POST   | `/api/ai/verify-resolution` | `{ originalReport, resolutionNotes, mediaLabels? }`                         | Verdict on whether evidence supports the resolution                                                                      |
| POST   | `/api/ai/workload`          | `{ departmentData }`                                                        | Workload / anomaly insights                                                                                              |
| POST   | `/api/ai/chat`              | `{ messages: [{role,content}], citizenContext }`                            | `{ reply, model, … }` — falls back to a rule-based reply when the LLM is unavailable                                     |

Duplicate-check fallback (LLM unreachable): duplicate only if ≥ 2 shared issue keywords
(score 70); 1 shared keyword scores 40, none 20.

## Reports & status

| Method      | Path                                               | Body / query                                                                                                                                                                      | Response                                                                             |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET         | `/api/status/reports`                              | —                                                                                                                                                                                 | `{ reports: CivicReport[], deletedIds: string[] }`                                   |
| GET         | `/api/status/report?id=<id>`                       | `id`                                                                                                                                                                              | `{ report, history }` or `404 {error}`                                               |
| POST        | `/api/status/submit`                               | `{ report: CivicReport }`                                                                                                                                                         | `201 { success, report }` — upserts by id; writes first history entry + notification |
| POST        | `/api/status/transition`                           | `{ reportId, newStatus, changedBy, role: "Staff"\|"Worker"\|"Citizen"\|"System", comment?, department?, worker?, resolutionNotes?, workerMedia?, resolutionMedia?, runAiCheck? }` | `{ success, report, historyEntry, aiVerification?, message }`                        |
| POST        | `/api/reports/upvote`                              | `{ reportId, userIdentifier? }`                                                                                                                                                   | `{ success, report?, alreadyUpvoted?, upvotes }`; `400` if `reportId` missing        |
| GET         | `/api/reports/deleted`                             | —                                                                                                                                                                                 | `{ deletedIds }`                                                                     |
| POST/DELETE | `/api/reports/delete` (alias `/api/status/delete`) | `{ reportId }` or `{ id }` or `?id=`                                                                                                                                              | Delete result incl. `deletedIds`; tombstones the id and removes from Supabase        |
| GET         | `/api/notifications`                               | —                                                                                                                                                                                 | Notification list                                                                    |

Upvote rules: one upvote per claimed username **and** per client IP (platform-set header; socket
address in dev). A repeat returns `success:false, alreadyUpvoted:true` with the current count.

## Auth

| Method | Path                 | Body                                                   | Response                                                                          |
| ------ | -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`    | `{ username, password, clientBackupUser? }`            | `200`/`401` `{ success, user?, message? }`; sets cookie `civicpulse_client_users` |
| POST   | `/api/auth/register` | `{ username, password, confirmPassword, displayName }` | `201`/`400` `{ success, user?, message? }`; sets the same cookie                  |
| GET    | `/api/auth/users`    | —                                                      | `{ users: SafeUser[] }` (public user list)                                        |

There are no sessions or tokens: the client stores the returned user in `localStorage`
(`civicpulse_auth_session`) and the UI guards admin pages client-side only.

## Admin / ops

| Method   | Path                        | Notes                                                                                                        |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET/POST | `/api/admin/clean-database` | **Destructive**: purges reports and resets to a single latest complaint. Reachable via GET, unauthenticated. |
| GET      | `/api/supabase/status`      | `{ configured, connected, projectName, url, hasKey, message }`                                               |
| GET      | `/api/search/municipal?q=`  | Top 3 Google results via SerpAPI: `{ query, results: [{title,snippet,link}] }`                               |

## Types

`CivicReport`, `ReportStatus`, `Priority`, `CategoryId` live in `src/lib/civic-data.ts`;
`StatusHistoryEntry` and `NotificationItem` in `src/lib/server/status-engine.ts`. See
[data-model.md](data-model.md).

## Adding an endpoint

1. Add the handler to `handleApiRequest` (Fetch API) **and** to `civicPulseApiPlugin` (Node dev
   middleware) — both are required until [ADR-0007](adr/0007-custom-api-middleware.md) is revisited.
2. Put business logic in `src/lib/server/*`, not in the handler.
3. Document it here.
