import type { Plugin, ViteDevServer } from "vite";
import {
  analyzeReportDescription,
  analyzeDuplicateReport,
  verifyResolutionEvidence,
  generateWorkloadInsights,
  handleCivicChatbot,
} from "./ai-service";
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
} from "./status-engine";
import {
  authenticateUser,
  registerUser,
  getAllUsers,
  initializeAuthStore,
  syncUsersFromCookie,
} from "./auth-store";
import { REPORTS } from "../civic-data";

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

    // 5. Municipal Search (SerpAPI / Zenserp)
    if (pathname.startsWith("/api/search/municipal") && request.method === "GET") {
      const q = url.searchParams.get("q") || "Hassan municipal council civic complaints";
      const serpApiKey = process.env["SERPAPI_API_KEY"] || "09e538a7b57d3f0ad876a3e25dd5dd1ece56236a57dfadf95b86e5bbf3694b40";

      const serpRes = await fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${serpApiKey}&num=3`
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
      return Response.json({ reports: getAllReports() }, { status: 200 });
    }

    if (pathname.startsWith("/api/status/report") && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      const report = getReportById(id);
      if (!report) {
        return Response.json({ error: `Report ${id} not found` }, { status: 404 });
      }
      const history = getHistoryForReport(id);
      return Response.json({ report, history }, { status: 200 });
    }

    if (pathname === "/api/status/submit" && request.method === "POST") {
      const body = await request.json();
      const newReport = addReport(body.report);
      return Response.json({ success: true, report: newReport }, { status: 201 });
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

    // 8. Clean database (Purge old complaints and reset to single latest complaint)
    if (pathname === "/api/admin/clean-database" && (request.method === "POST" || request.method === "GET")) {
      const cleanResult = await resetToCleanState();
      return Response.json(cleanResult, { status: 200 });
    }

    // 9. Delete specific report from database & Supabase
    if ((pathname === "/api/reports/delete" || pathname === "/api/status/delete") && (request.method === "POST" || request.method === "DELETE")) {
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
        headers.set(
          "Set-Cookie",
          `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
        );
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
        headers.set(
          "Set-Cookie",
          `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
        );
      }
      return new Response(JSON.stringify(regResult), {
        status: regResult.success ? 201 : 400,
        headers,
      });
    }

    if (pathname === "/api/auth/users" && request.method === "GET") {
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
            const result = await verifyResolutionEvidence(originalReport, resolutionNotes, mediaLabels);
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

          // 5. Municipal Search (SerpAPI / Zenserp)
          if (url.startsWith("/api/search/municipal") && req.method === "GET") {
            const queryMatch = url.match(/[?&]q=([^&]+)/);
            const q = queryMatch && queryMatch[1] ? decodeURIComponent(queryMatch[1]) : "Hassan municipal council civic complaints";
            const serpApiKey = process.env["SERPAPI_API_KEY"] || "09e538a7b57d3f0ad876a3e25dd5dd1ece56236a57dfadf95b86e5bbf3694b40";

            const serpRes = await fetch(
              `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${serpApiKey}&num=3`
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
            return sendJson(res, 200, { reports: getAllReports() });
          }

          if (url.startsWith("/api/status/report") && req.method === "GET") {
            const idMatch = url.match(/[?&]id=([^&]+)/);
            const id = idMatch && idMatch[1] ? decodeURIComponent(idMatch[1]) : "";
            const report = getReportById(id);
            if (!report) {
              return sendJson(res, 404, { error: `Report ${id} not found` });
            }
            const history = getHistoryForReport(id);
            return sendJson(res, 200, { report, history });
          }

          if (url === "/api/status/submit" && req.method === "POST") {
            const body = await parseJsonBody(req);
            const newReport = addReport(body.report);
            return sendJson(res, 201, { success: true, report: newReport });
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

          // 8. Clean database
          if (url.startsWith("/api/admin/clean-database")) {
            const cleanResult = await resetToCleanState();
            return sendJson(res, 200, cleanResult);
          }

          // 9. Delete specific report from database & Supabase
          if (
            (url === "/api/reports/delete" ||
              url.startsWith("/api/reports/delete") ||
              url === "/api/status/delete" ||
              url.startsWith("/api/status/delete")) &&
            (req.method === "POST" || req.method === "DELETE")
          ) {
            const body = await parseJsonBody(req).catch(() => ({}));
            const idMatch = url.match(/[?&]id=([^&]+)/);
            const id = body.reportId || body.id || (idMatch && idMatch[1] ? decodeURIComponent(idMatch[1]) : "");
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
              res.setHeader(
                "Set-Cookie",
                `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
              );
            }
            return sendJson(res, authResult.success ? 200 : 401, authResult);
          }

          if (url === "/api/auth/register" && req.method === "POST") {
            const body = await parseJsonBody(req).catch(() => ({}));
            const { username, password, confirmPassword, displayName } = body;
            const regResult = await registerUser(username, password, confirmPassword, displayName);
            if (regResult.success && regResult.user) {
              const allUsers = getAllUsers();
              res.setHeader(
                "Set-Cookie",
                `civicpulse_client_users=${encodeURIComponent(JSON.stringify(allUsers))}; Path=/; Max-Age=31536000; SameSite=Lax`,
              );
            }
            return sendJson(res, regResult.success ? 201 : 400, regResult);
          }

          if (url === "/api/auth/users" && req.method === "GET") {
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
