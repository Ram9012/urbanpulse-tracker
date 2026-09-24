import type { Plugin, ViteDevServer } from "vite";
import {
  analyzeReportDescription,
  analyzeDuplicateReport,
  verifyResolutionEvidence,
  generateWorkloadInsights,
} from "./ai-service";
import {
  initializeStatusEngine,
  getAllReports,
  getReportById,
  getHistoryForReport,
  addReport,
  transitionReportStatus,
  getNotifications,
} from "./status-engine";
import { checkSupabaseStatus } from "./supabase-client";
import { REPORTS } from "../civic-data";

// Initialize reports
initializeStatusEngine(REPORTS);

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

export function civicPulseApiPlugin(): Plugin {
  return {
    name: "civicpulse-api-server",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";

        if (!url.startsWith("/api/")) {
          return next();
        }

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

          return next();
        } catch (error: any) {
          console.error("[CivicPulse API Error]:", error);
          return sendJson(res, 500, { error: error.message || "Internal server error" });
        }
      });
    },
  };
}
