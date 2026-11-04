import type { Plugin, ViteDevServer } from "vite";
import {
  analyzeReportDescription,
  analyzeIssueImage,
  analyzeDuplicateReport,
  verifyResolutionEvidence,
  generateWorkloadInsights,
  handleCivicChatbot,
} from "./ai-service";
import {
  getVerificationsForReport,
  getVerificationById,
  recordAdminDecision,
  checkAiServiceHealth,
  submitVerificationJob,
  pollVerificationResult,
  diagnoseVision,
} from "./vision-service";
import {
  initializeStatusEngine,
  getAllReports,
  getReportById,
  getHistoryForReport,
  addReport,
  transitionReportStatus,
  getNotifications,
  resetToCleanState,
  deleteReport,
  getDeletedReportIdsServer,
  upvoteReport,
} from "./status-engine";
import {
  authenticateUser,
  registerUser,
  getAllUsers,
  initializeAuthStore,
  syncUsersFromCookie,
  createSessionToken,
  getSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
} from "./auth-store";
import { checkSupabaseStatus, uploadMediaToSupabase } from "./supabase-client";
import { REPORTS } from "../civic-data";

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly`;
}

// Initialize reports & auth store
initializeStatusEngine(REPORTS);
initializeAuthStore();

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

// Base64 adds ~33% overhead and Vercel's default serverless function body
// limit is 4.5MB, so cap the decoded (raw) file size well under that.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3MB raw (~4MB as base64)

/** Upload a base64-encoded file to Supabase Storage via supabase-client. */
async function handleMediaUploadBody(body: {
  reportId?: string;
  kind?: "evidence" | "resolution";
  fileName?: string;
  contentType?: string;
  dataBase64?: string;
}): Promise<{ status: number; data: any }> {
  const { reportId, kind, fileName, contentType, dataBase64 } = body;
  if (!reportId || !dataBase64) {
    return { status: 400, data: { error: "Missing reportId or dataBase64" } };
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) {
    return { status: 400, data: { error: "Empty file" } };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { status: 413, data: { error: "File too large (max 3MB)" } };
  }
  const extension = (fileName || "").split(".").pop()?.toLowerCase() || "bin";
  const result = await uploadMediaToSupabase(
    reportId,
    { buffer, contentType: contentType || "application/octet-stream", extension },
    kind === "resolution" ? "resolution" : "evidence",
  );
  if (!result) {
    return { status: 502, data: { error: "Upload failed — check Supabase Storage configuration" } };
  }
  return { status: 201, data: { success: true, path: result.path, url: result.url } };
}

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) {
    return null;
  }

  // Cross-container user synchronization via cookie
  syncUsersFromCookie(request.headers.get("cookie"));

  try {
    // 1. AI Analysis of Report
    if (pathname === "/api/ai/analyze" && request.method === "POST") {
      const body = await request.json();
      const { description, categoryName } = body;
      const result = await analyzeReportDescription(description || "", categoryName);
      return Response.json(result, { status: 200 });
    }

    // 1.1 Vision Analysis of Uploaded Evidence Photo
    if (pathname === "/api/ai/analyze-image" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { imageDataUrl, categoryName } = body;
      if (!imageDataUrl) {
        return Response.json({ error: "Missing imageDataUrl" }, { status: 400 });
      }
      const result = await analyzeIssueImage(imageDataUrl, categoryName);
      return Response.json(result, { status: 200 });
    }

    // 2. Duplicate Detection Analysis
    if (pathname === "/api/ai/duplicate-check" && request.method === "POST") {
      const body = await request.json();
      const { newDescription, existingReport } = body;
      const result = await analyzeDuplicateReport(newDescription, existingReport);
      return Response.json(result, { status: 200 });
    }

    // 3. Resolution Evidence Verification
    if (pathname === "/api/ai/verify-resolution" && request.method === "POST") {
      const body = await request.json();
      const { originalReport, resolutionNotes, mediaLabels } = body;
      const result = await verifyResolutionEvidence(originalReport, resolutionNotes, mediaLabels);
      return Response.json(result, { status: 200 });
    }

    // 4. Admin Workload & Anomaly Analytics
    if (pathname === "/api/ai/workload" && request.method === "POST") {
      const body = await request.json();
      const result = await generateWorkloadInsights(body.departmentData || {});
      return Response.json(result, { status: 200 });
    }

    // 4.1 Citizen Dashboard AI Chatbot (Groq Powered)
    if (pathname === "/api/ai/chat" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { messages, citizenContext } = body;
      const result = await handleCivicChatbot(messages || [], citizenContext);
      return Response.json(result, { status: 200 });
    }

    // 4.2 AI Vision Verification APIs
    if (pathname.startsWith("/api/vision/report/") && request.method === "GET") {
      const reportId = pathname.replace("/api/vision/report/", "").trim();
      const verifications = getVerificationsForReport(reportId);
      // Attempt poll if pending
      const latestVerification = verifications[0];
      if (latestVerification && latestVerification.jobStatus === "processing") {
        await pollVerificationResult(latestVerification.id);
      }
      return Response.json(
        { reportId, verifications: getVerificationsForReport(reportId) },
        { status: 200 },
      );
    }

    if (pathname.startsWith("/api/vision/verification/") && request.method === "GET") {
      const vId = pathname.replace("/api/vision/verification/", "").trim();
      const updated = await pollVerificationResult(vId);
      return Response.json({ verification: updated || getVerificationById(vId) }, { status: 200 });
    }

    if (pathname === "/api/vision/admin-decision" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { verificationId, decision, adminUsername, note } = body;
      if (!verificationId || !decision) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const updated = await recordAdminDecision(
        verificationId,
        decision,
        adminUsername || "admin",
        note,
      );
      return Response.json({ success: true, verification: updated }, { status: 200 });
    }

    if (pathname === "/api/vision/run" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!body.reportId || !body.resolutionImageUrl) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const verification = await submitVerificationJob({
        reportId: body.reportId,
        originalImageUrl: body.originalImageUrl || "",
        resolutionImageUrl: body.resolutionImageUrl,
        reportCategory: body.category,
        reportDescription: body.description,
        submittedBy: body.requestedBy,
      });
      return Response.json({ success: true, verification }, { status: 200 });
    }

    if (pathname === "/api/vision/diagnose" && request.method === "GET") {
      return Response.json(await diagnoseVision(), { status: 200 });
    }

    if (pathname === "/api/vision/health" && request.method === "GET") {
      const healthy = await checkAiServiceHealth();
      return Response.json({ status: healthy ? "connected" : "disconnected" }, { status: 200 });
    }

    // 5. Municipal Search (SerpAPI / Zenserp)
    if (pathname.startsWith("/api/search/municipal") && request.method === "GET") {
      const q = url.searchParams.get("q") || "Hassan civic complaints grievance helpline";
      const serpApiKey =
        process.env["SERPAPI_API_KEY"] ||
        "09e538a7b57d3f0ad876a3e25dd5dd1ece56236a57dfadf95b86e5bbf3694b40";

      const serpRes = await fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${serpApiKey}&num=3`,
      );
      const data = await serpRes.json();
      const results = (data.organic_results || []).slice(0, 3).map((r: any) => ({
        title: r.title,
        snippet: r.snippet,
        link: r.link,
      }));
      return Response.json({ query: q, results }, { status: 200 });
    }

    // 6. Reports & Status Engine APIs
    if (pathname === "/api/status/reports" && request.method === "GET") {
      return Response.json(
        {
          reports: await getAllReports(),
          deletedIds: getDeletedReportIdsServer(),
        },
        { status: 200 },
      );
    }

    if (pathname === "/api/reports/deleted" && request.method === "GET") {
      return Response.json({ deletedIds: getDeletedReportIdsServer() }, { status: 200 });
    }

    if (pathname.startsWith("/api/status/report") && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      const report = await getReportById(id);
      if (!report) {
        return Response.json({ error: `Report ${id} not found` }, { status: 404 });
      }
      const history = await getHistoryForReport(id);
      return Response.json({ report, history }, { status: 200 });
    }

    if (pathname === "/api/status/submit" && request.method === "POST") {
      const body = await request.json();
      const newReport = addReport(body.report);
      return Response.json({ success: true, report: newReport }, { status: 201 });
    }

    // Media upload (evidence or resolution proof) to Supabase Storage
    if (pathname === "/api/media/upload" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { status, data } = await handleMediaUploadBody(body);
      return Response.json(data, { status });
    }

    if (pathname === "/api/reports/upvote" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { reportId, userIdentifier } = body;
      if (!reportId) {
        return Response.json({ error: "Missing reportId" }, { status: 400 });
      }
      // Platform-set headers only; the client-controlled leftmost x-forwarded-for entry is ignored.
      const clientIp =
        request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        request.headers.get("cf-connecting-ip") ||
        "unknown-ip";
      const result = await upvoteReport(reportId, userIdentifier || "anonymous", clientIp);
      return Response.json(result, { status: 200 });
    }

    if (pathname === "/api/status/transition" && request.method === "POST") {
      const body = await request.json();
      const transitionResult = await transitionReportStatus(body);
      return Response.json(transitionResult, { status: 200 });
    }

    if (pathname === "/api/notifications" && request.method === "GET") {
      return Response.json({ notifications: getNotifications() }, { status: 200 });
    }

    // 7. Supabase Status Check
    if (pathname === "/api/supabase/status" && request.method === "GET") {
      const status = await checkSupabaseStatus();
      return Response.json(status, { status: 200 });
    }

    // 8. Clean database (admin only — Purge old complaints and reset to single latest complaint)
    if (
      pathname === "/api/admin/clean-database" &&
      (request.method === "POST" || request.method === "GET")
    ) {
      const session = getSessionFromCookieHeader(request.headers.get("cookie"));
      if (!session || session.role !== "admin") {
        return Response.json({ error: "Admin session required" }, { status: 403 });
      }
      const cleanResult = await resetToCleanState();
      return Response.json(cleanResult, { status: 200 });
    }

    // 9. Delete specific report from database & Supabase (admin only)
    if (
      (pathname === "/api/reports/delete" || pathname === "/api/status/delete") &&
      (request.method === "POST" || request.method === "DELETE")
    ) {
      const session = getSessionFromCookieHeader(request.headers.get("cookie"));
      if (!session || session.role !== "admin") {
        return Response.json({ error: "Admin session required" }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const id = body.reportId || body.id || url.searchParams.get("id");
      if (!id) {
        return Response.json({ error: "Missing reportId" }, { status: 400 });
      }
      const deleteResult = await deleteReport(id);
      return Response.json(deleteResult, { status: 200 });
    }

    // 10. Authentication & User Management
    if (pathname === "/api/auth/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { username, password, clientBackupUser } = body;
      const authResult = await authenticateUser(username, password, clientBackupUser);
      const headers = new Headers({ "Content-Type": "application/json" });
      if (authResult.success && authResult.user) {
        const allUsers = getAllUsers();
        headers.append(
          "Set-Cookie",
          `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
        );
        headers.append("Set-Cookie", sessionCookie(createSessionToken(authResult.user)));
      }
      return new Response(JSON.stringify(authResult), {
        status: authResult.success ? 200 : 401,
        headers,
      });
    }

    if (pathname === "/api/auth/register" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { username, password, confirmPassword, displayName } = body;
      const regResult = await registerUser(username, password, confirmPassword, displayName);
      const headers = new Headers({ "Content-Type": "application/json" });
      if (regResult.success && regResult.user) {
        const allUsers = getAllUsers();
        headers.append(
          "Set-Cookie",
          `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
        );
        headers.append("Set-Cookie", sessionCookie(createSessionToken(regResult.user)));
      }
      return new Response(JSON.stringify(regResult), {
        status: regResult.success ? 201 : 400,
        headers,
      });
    }

    if (pathname === "/api/auth/users" && request.method === "GET") {
      const session = getSessionFromCookieHeader(request.headers.get("cookie"));
      if (!session || session.role !== "admin") {
        return Response.json({ error: "Admin session required" }, { status: 403 });
      }
      return Response.json({ users: getAllUsers() }, { status: 200 });
    }

    return null;
  } catch (error: any) {
    console.error("[CivicPulse API Error]:", error);
    return Response.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export function civicPulseApiPlugin(): Plugin {
  return {
    name: "civicpulse-api-server",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";

        if (!url.startsWith("/api/")) {
          return next();
        }

        syncUsersFromCookie(req.headers.cookie);

        try {
          // 1. AI Analysis of Report
          if (url === "/api/ai/analyze" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const { description, categoryName } = body;
            const result = await analyzeReportDescription(description || "", categoryName);
            return sendJson(res, 200, result);
          }

          // 1.1 Vision Analysis of Uploaded Evidence Photo
          if (url === "/api/ai/analyze-image" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { imageDataUrl, categoryName } = body;
            if (!imageDataUrl) {
              return sendJson(res, 400, { error: "Missing imageDataUrl" });
            }
            const result = await analyzeIssueImage(imageDataUrl, categoryName);
            return sendJson(res, 200, result);
          }

          // 2. Duplicate Detection Analysis
          if (url === "/api/ai/duplicate-check" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const { newDescription, existingReport } = body;
            const result = await analyzeDuplicateReport(newDescription, existingReport);
            return sendJson(res, 200, result);
          }

          // 3. Resolution Evidence Verification
          if (url === "/api/ai/verify-resolution" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const { originalReport, resolutionNotes, mediaLabels } = body;
            const result = await verifyResolutionEvidence(
              originalReport,
              resolutionNotes,
              mediaLabels,
            );
            return sendJson(res, 200, result);
          }

          // 4. Admin Workload & Anomaly Analytics
          if (url === "/api/ai/workload" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const result = await generateWorkloadInsights(body.departmentData || {});
            return sendJson(res, 200, result);
          }

          // 4.1 Citizen Dashboard AI Chatbot (Groq Powered)
          if (url === "/api/ai/chat" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { messages, citizenContext } = body;
            const result = await handleCivicChatbot(messages || [], citizenContext);
            return sendJson(res, 200, result);
          }

          // 4.2 AI Vision Verification APIs (Vite middleware)
          if (url.startsWith("/api/vision/report/") && req.method === "GET") {
            const reportId = url.replace("/api/vision/report/", "").split("?")[0]?.trim() || "";
            const verifs = getVerificationsForReport(reportId);
            const latestVerif = verifs[0];
            if (latestVerif && latestVerif.jobStatus === "processing") {
              await pollVerificationResult(latestVerif.id);
            }
            return sendJson(res, 200, {
              reportId,
              verifications: getVerificationsForReport(reportId),
            });
          }

          if (url.startsWith("/api/vision/verification/") && req.method === "GET") {
            const vId = url.replace("/api/vision/verification/", "").split("?")[0]?.trim() || "";
            const updated = await pollVerificationResult(vId);
            return sendJson(res, 200, { verification: updated || getVerificationById(vId) });
          }

          if (url === "/api/vision/admin-decision" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { verificationId, decision, adminUsername, note } = body;
            if (!verificationId || !decision) {
              return sendJson(res, 400, { error: "Missing required fields" });
            }
            const updated = await recordAdminDecision(
              verificationId,
              decision,
              adminUsername || "admin",
              note,
            );
            return sendJson(res, 200, { success: true, verification: updated });
          }

          if (url === "/api/vision/run" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            if (!body.reportId || !body.resolutionImageUrl) {
              return sendJson(res, 400, { error: "Missing required fields" });
            }
            const verification = await submitVerificationJob({
              reportId: body.reportId,
              originalImageUrl: body.originalImageUrl || "",
              resolutionImageUrl: body.resolutionImageUrl,
              reportCategory: body.category,
              reportDescription: body.description,
              submittedBy: body.requestedBy,
            });
            return sendJson(res, 200, { success: true, verification });
          }

          if (url === "/api/vision/diagnose" && req.method === "GET") {
            return sendJson(res, 200, await diagnoseVision());
          }

          if (url === "/api/vision/health" && req.method === "GET") {
            const healthy = await checkAiServiceHealth();
            return sendJson(res, 200, { status: healthy ? "connected" : "disconnected" });
          }

          // 5. Municipal Search (SerpAPI / Zenserp)
          if (url.startsWith("/api/search/municipal") && req.method === "GET") {
            const queryMatch = url.match(/[?&]q=([^&]+)/);
            const q =
              queryMatch && queryMatch[1]
                ? decodeURIComponent(queryMatch[1])
                : "Hassan civic complaints grievance helpline";
            const serpApiKey =
              process.env["SERPAPI_API_KEY"] ||
              "09e538a7b57d3f0ad876a3e25dd5dd1ece56236a57dfadf95b86e5bbf3694b40";

            const serpRes = await fetch(
              `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${serpApiKey}&num=3`,
            );
            const data = await serpRes.json();
            const results = (data.organic_results || []).slice(0, 3).map((r: any) => ({
              title: r.title,
              snippet: r.snippet,
              link: r.link,
            }));
            return sendJson(res, 200, { query: q, results });
          }

          // 6. Reports & Status Engine APIs
          if (url === "/api/status/reports" && req.method === "GET") {
            return sendJson(res, 200, {
              reports: await getAllReports(),
              deletedIds: getDeletedReportIdsServer(),
            });
          }

          if (url === "/api/reports/deleted" && req.method === "GET") {
            return sendJson(res, 200, { deletedIds: getDeletedReportIdsServer() });
          }

          if (url.startsWith("/api/status/report") && req.method === "GET") {
            const idMatch = url.match(/[?&]id=([^&]+)/);
            const id = idMatch && idMatch[1] ? decodeURIComponent(idMatch[1]) : "";
            const report = await getReportById(id);
            if (!report) {
              return sendJson(res, 404, { error: `Report ${id} not found` });
            }
            const history = await getHistoryForReport(id);
            return sendJson(res, 200, { report, history });
          }

          if (url === "/api/status/submit" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const newReport = addReport(body.report);
            return sendJson(res, 201, { success: true, report: newReport });
          }

          // Media upload (evidence or resolution proof) to Supabase Storage
          if (url === "/api/media/upload" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { status, data } = await handleMediaUploadBody(body);
            return sendJson(res, status, data);
          }

          if (url === "/api/reports/upvote" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { reportId, userIdentifier } = body;
            if (!reportId) {
              return sendJson(res, 400, { error: "Missing reportId" });
            }
            const clientIp = req.socket?.remoteAddress || "unknown-ip";
            const result = await upvoteReport(reportId, userIdentifier || "anonymous", clientIp);
            return sendJson(res, 200, result);
          }

          if (url === "/api/status/transition" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const transitionResult = await transitionReportStatus(body);
            return sendJson(res, 200, transitionResult);
          }

          if (url === "/api/notifications" && req.method === "GET") {
            return sendJson(res, 200, { notifications: getNotifications() });
          }

          // 7. Supabase Status Check
          if (url === "/api/supabase/status" && req.method === "GET") {
            const status = await checkSupabaseStatus();
            return sendJson(res, 200, status);
          }

          // 8. Clean database (admin only)
          if (url.startsWith("/api/admin/clean-database")) {
            const session = getSessionFromCookieHeader(req.headers.cookie);
            if (!session || session.role !== "admin") {
              return sendJson(res, 403, { error: "Admin session required" });
            }
            const cleanResult = await resetToCleanState();
            return sendJson(res, 200, cleanResult);
          }

          // 9. Delete specific report from database & Supabase (admin only)
          if (
            (url === "/api/reports/delete" ||
              url.startsWith("/api/reports/delete") ||
              url === "/api/status/delete" ||
              url.startsWith("/api/status/delete")) &&
            (req.method === "POST" || req.method === "DELETE")
          ) {
            const session = getSessionFromCookieHeader(req.headers.cookie);
            if (!session || session.role !== "admin") {
              return sendJson(res, 403, { error: "Admin session required" });
            }
            const body = await parseJsonBody(req).catch(() => ({}));
            const idMatch = url.match(/[?&]id=([^&]+)/);
            const id =
              body.reportId ||
              body.id ||
              (idMatch && idMatch[1] ? decodeURIComponent(idMatch[1]) : "");
            if (!id) {
              return sendJson(res, 400, { error: "Missing reportId" });
            }
            const deleteResult = await deleteReport(id);
            return sendJson(res, 200, deleteResult);
          }

          // 10. Authentication & User Management
          if (url === "/api/auth/login" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { username, password, clientBackupUser } = body;
            const authResult = await authenticateUser(username, password, clientBackupUser);
            if (authResult.success && authResult.user) {
              const allUsers = getAllUsers();
              res.setHeader("Set-Cookie", [
                `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
                sessionCookie(createSessionToken(authResult.user)),
              ]);
            }
            return sendJson(res, authResult.success ? 200 : 401, authResult);
          }

          if (url === "/api/auth/register" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { username, password, confirmPassword, displayName } = body;
            const regResult = await registerUser(username, password, confirmPassword, displayName);
            if (regResult.success && regResult.user) {
              const allUsers = getAllUsers();
              res.setHeader("Set-Cookie", [
                `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
                sessionCookie(createSessionToken(regResult.user)),
              ]);
            }
            return sendJson(res, regResult.success ? 201 : 400, regResult);
          }

          if (url === "/api/auth/users" && req.method === "GET") {
            const session = getSessionFromCookieHeader(req.headers.cookie);
            if (!session || session.role !== "admin") {
              return sendJson(res, 403, { error: "Admin session required" });
            }
            return sendJson(res, 200, { users: getAllUsers() });
          }

          return next();
        } catch (error: any) {
          console.error("[CivicPulse API Error]:", error);
          return sendJson(res, 500, { error: error.message || "Internal server error" });
        }
      });
    },
  };
}
