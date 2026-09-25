/**
 * Demonstration data for CivicPulse.
 * Every value here is clearly labelled sample data in the UI — it is not
 * connected to a live municipal system yet.
 */

export const BRAND = {
  name: "CivicPulse",
  tagline: "See a problem. Report it. Track the solution.",
  city: "Hassan, Karnataka",
  email: "support@civicpulse.example",
  phone: "1800 000 1800",
} as const;

export type ReportStatus =
  | "submitted"
  | "verified"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "duplicate";

export const STATUS_META: Record<
  ReportStatus,
  { label: string; tone: "primary" | "teal" | "warning" | "success" | "muted" }
> = {
  submitted: { label: "Submitted", tone: "primary" },
  verified: { label: "Verified", tone: "teal" },
  assigned: { label: "Assigned", tone: "teal" },
  in_progress: { label: "In progress", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  duplicate: { label: "Marked duplicate", tone: "muted" },
};

export type Priority = "low" | "medium" | "high" | "critical";

export const PRIORITY_META: Record<Priority, { label: string }> = {
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
  critical: { label: "Critical" },
};

export type CategoryId =
  | "roads"
  | "electricity"
  | "waste"
  | "water"
  | "safety"
  | "parks";

export type Category = {
  id: CategoryId;
  name: string;
  description: string;
  department: string;
  active: number;
  examples: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "roads",
    name: "Road & pothole",
    description: "Potholes, damaged roads, broken footpaths and open manholes.",
    department: "Public Works — Roads",
    active: 184,
    examples: ["Pothole", "Damaged road", "Broken footpath", "Open manhole"],
  },
  {
    id: "electricity",
    name: "Streetlight & electricity",
    description: "Dark streets, flickering lamps and exposed electrical fittings.",
    department: "Electrical Department",
    active: 96,
    examples: ["Streetlight not working", "Exposed wiring", "Pole damage"],
  },
  {
    id: "waste",
    name: "Garbage & sanitation",
    description: "Uncollected waste, overflowing bins and illegal dumping.",
    department: "Sanitation",
    active: 142,
    examples: ["Garbage accumulation", "Illegal dumping", "Bin overflow"],
  },
  {
    id: "water",
    name: "Water & drainage",
    description: "Leakage, blocked drains, sewage overflow and flooded streets.",
    department: "Water Supply & Sewerage",
    active: 118,
    examples: ["Water leakage", "Blocked drain", "Sewage overflow", "Flooded street"],
  },
  {
    id: "safety",
    name: "Traffic & public safety",
    description: "Signal failures, missing signage and stray animal concerns.",
    department: "Traffic Department",
    active: 61,
    examples: ["Traffic signal fault", "Missing sign", "Stray animals"],
  },
  {
    id: "parks",
    name: "Parks & public spaces",
    description: "Park upkeep, broken benches and damaged public infrastructure.",
    department: "Parks Department",
    active: 37,
    examples: ["Park maintenance", "Broken bench", "Playground damage"],
  },
];

export const ROUTING_RULES: { issue: string; department: string }[] = [
  { issue: "Road damage / pothole", department: "Public Works — Roads" },
  { issue: "Garbage accumulation", department: "Sanitation" },
  { issue: "Streetlight failure", department: "Electrical Department" },
  { issue: "Water leakage", department: "Water Supply" },
  { issue: "Drainage & sewage", department: "Sewerage Department" },
  { issue: "Traffic signal fault", department: "Traffic Department" },
  { issue: "Park maintenance", department: "Parks Department" },
];

export type CivicReport = {
  id: string;
  title: string;
  category: CategoryId;
  categoryLabel: string;
  description: string;
  ward: string;
  area: string;
  status: ReportStatus;
  priority: Priority;
  department: string;
  worker?: string | undefined;
  createdAt: string;
  updatedAt: string;
  aiConfidence: number;
  duplicateProbability: number;
  upvotes: number;
  anonymous: boolean;
  /** Percent coordinates on the illustrated demo map. */
  x: number;
  y: number;
  mediaUrls?: string[] | undefined;
  workerMediaUrls?: string[] | undefined;
  resolutionMediaUrls?: string[] | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  address?: string | undefined;
  resolutionNotes?: string | undefined;
  reportedBy?: string;
  societyName?: string;
  distanceMeters?: number;
};

export const REPORTS: CivicReport[] = [
  {
    id: "CIV-95674",
    title: "Streetlight failure and dark stretch on Racecourse Road",
    category: "electricity",
    categoryLabel: "Streetlight & electricity",
    description:
      "Streetlight pole lamp failure near Racecourse Road, Rangoli Halla. Street is dark and creating safety hazard for commuters.",
    ward: "Ward 12 - Hassan Central",
    area: "Racecourse Road, Rangoli Halla",
    status: "submitted",
    priority: "critical",
    department: "Electrical Department",
    createdAt: "2026-09-25T01:30:00Z",
    updatedAt: "2026-09-25T01:30:00Z",
    aiConfidence: 0.96,
    duplicateProbability: 0.05,
    upvotes: 4,
    anonymous: false,
    reportedBy: "bipinyadav",
    societyName: "Racecourse Enclave Society",
    distanceMeters: 50,
    x: 44,
    y: 48,
    latitude: 13.0072,
    longitude: 76.1023,
    address: "Racecourse Road, Rangoli Halla, Hassan",
    mediaUrls: ["/media/evidence/streetlight_before.jpg"],
    workerMediaUrls: [],
    resolutionMediaUrls: [],
  },
  {
    id: "CIV-97915",
    title: "High-voltage cable sparking near residential society entrance gate",
    category: "electricity",
    categoryLabel: "Streetlight & electricity",
    description:
      "Overhead power line insulation frayed and producing bright electrical sparks near residential apartment gate. Urgent attention required before rain.",
    ward: "Ward 12 - Hassan Central",
    area: "Racecourse Road 2nd Cross",
    status: "assigned",
    priority: "critical",
    department: "Electrical Department",
    worker: "S. Latha",
    createdAt: "2026-09-25T08:15:00Z",
    updatedAt: "2026-09-25T09:40:00Z",
    aiConfidence: 0.98,
    duplicateProbability: 0.03,
    upvotes: 9,
    anonymous: false,
    reportedBy: "rahul_kumar",
    societyName: "Shanti Nilaya Apartments",
    distanceMeters: 180,
    x: 55,
    y: 38,
    latitude: 13.0081,
    longitude: 76.1035,
    address: "Racecourse Road 2nd Cross, Hassan",
    mediaUrls: ["/media/evidence/streetlight_before.jpg"],
    workerMediaUrls: [],
    resolutionMediaUrls: [],
  },
  {
    id: "CIV-88421",
    title: "Major potable water pipeline burst flooding society entrance lane",
    category: "water",
    categoryLabel: "Water & drainage",
    description:
      "Underground municipal supply pipe burst. Clean drinking water flooding the road and low pressure reported across residential apartments.",
    ward: "Ward 12 - Vidyanagar",
    area: "Vidyanagar 3rd Main, Near Water Tank",
    status: "in_progress",
    priority: "critical",
    department: "Water Supply & Sewerage",
    worker: "A. Firoz",
    createdAt: "2026-09-25T07:20:00Z",
    updatedAt: "2026-09-25T10:15:00Z",
    aiConfidence: 0.95,
    duplicateProbability: 0.02,
    upvotes: 12,
    anonymous: false,
    reportedBy: "priya_patel",
    societyName: "Saraswathi Society Layout",
    distanceMeters: 320,
    x: 30,
    y: 62,
    latitude: 13.0055,
    longitude: 76.1008,
    address: "Vidyanagar 3rd Main, Hassan",
    mediaUrls: ["/media/evidence/pothole_before.jpg"],
    workerMediaUrls: ["/media/evidence/pothole_before.jpg"],
    resolutionMediaUrls: [],
  },
  {
    id: "CIV-76340",
    title: "Dangerous deep pothole near society school bus boarding point",
    category: "roads",
    categoryLabel: "Road & pothole",
    description:
      "Deep crater formed right in front of school bus stop. Multiple two-wheelers skidding, dangerous for school children during morning rush.",
    ward: "Ward 11 - BM Road Extension",
    area: "BM Road Junction, Opposite Canara Bank",
    status: "in_progress",
    priority: "critical",
    department: "Public Works — Roads",
    worker: "R. Manjunath",
    createdAt: "2026-09-24T16:00:00Z",
    updatedAt: "2026-09-25T08:30:00Z",
    aiConfidence: 0.94,
    duplicateProbability: 0.04,
    upvotes: 15,
    anonymous: false,
    reportedBy: "vikram_singh",
    societyName: "Krishna Krupa Society",
    distanceMeters: 460,
    x: 22,
    y: 32,
    latitude: 13.0095,
    longitude: 76.098,
    address: "BM Road Junction, Hassan",
    mediaUrls: ["/media/evidence/pothole_before.jpg"],
    workerMediaUrls: ["/media/evidence/pothole_before.jpg"],
    resolutionMediaUrls: [],
  },
  {
    id: "CIV-65219",
    title: "Overflowing municipal waste bin attracting stray animals",
    category: "waste",
    categoryLabel: "Garbage & sanitation",
    description:
      "Community waste container hasn't been emptied for 48 hours. Garbage spilling onto pavement, creating foul smell and unhygienic conditions.",
    ward: "Ward 12 - Rangoli Halla",
    area: "Rangoli Halla Daily Market Road",
    status: "assigned",
    priority: "high",
    department: "Sanitation",
    worker: "M. Nagaraj",
    createdAt: "2026-09-25T06:10:00Z",
    updatedAt: "2026-09-25T07:45:00Z",
    aiConfidence: 0.91,
    duplicateProbability: 0.06,
    upvotes: 7,
    anonymous: false,
    reportedBy: "ananya_rao",
    societyName: "Rangoli Residency",
    distanceMeters: 580,
    x: 68,
    y: 70,
    latitude: 13.004,
    longitude: 76.105,
    address: "Rangoli Halla Market Road, Hassan",
    mediaUrls: ["/media/evidence/pothole_before.jpg"],
    workerMediaUrls: [],
    resolutionMediaUrls: [],
  },
  {
    id: "CIV-54198",
    title: "Broken concrete stormwater drain slab posing hazard for commuters",
    category: "water",
    categoryLabel: "Water & drainage",
    description:
      "Heavy truck broke the slab over the primary roadside stormwater drain. Pedestrians could fall in, especially in the dark.",
    ward: "Ward 13 - Shankaripuram",
    area: "Shankaripuram 1st Main",
    status: "resolved",
    priority: "medium",
    department: "Water Supply & Sewerage",
    worker: "A. Firoz",
    createdAt: "2026-09-23T11:00:00Z",
    updatedAt: "2026-09-25T09:00:00Z",
    aiConfidence: 0.93,
    duplicateProbability: 0.01,
    upvotes: 11,
    anonymous: false,
    reportedBy: "kiran_gowda",
    societyName: "Sri Rama Enclave",
    distanceMeters: 740,
    x: 78,
    y: 24,
    latitude: 13.011,
    longitude: 76.1065,
    address: "Shankaripuram 1st Main, Hassan",
    mediaUrls: ["/media/evidence/pothole_before.jpg"],
    workerMediaUrls: ["/media/evidence/pothole_before.jpg"],
    resolutionMediaUrls: ["/media/evidence/pothole_after.jpg"],
    resolutionNotes: "Replaced broken RCC precast drain slab with reinforced heavy-duty cover. Graded and sealed edges.",
  },
  {
    id: "CIV-43210",
    title: "Traffic signal timer malfunction causing peak hour gridlock",
    category: "safety",
    categoryLabel: "Traffic & public safety",
    description:
      "Green signal stays on for only 5 seconds while red stays for 120 seconds. Traffic backed up all the way to society entrance road.",
    ward: "Ward 10 - Central Circle",
    area: "Hassan Central Circle, Near CMC Tower",
    status: "verified",
    priority: "medium",
    department: "Traffic Department",
    worker: "K. Prakash",
    createdAt: "2026-09-25T08:50:00Z",
    updatedAt: "2026-09-25T09:30:00Z",
    aiConfidence: 0.97,
    duplicateProbability: 0.02,
    upvotes: 18,
    anonymous: false,
    reportedBy: "arun_shetty",
    societyName: "Town Hall Society Quarters",
    distanceMeters: 890,
    x: 18,
    y: 78,
    latitude: 13.003,
    longitude: 76.095,
    address: "Hassan Central Circle, Hassan",
    mediaUrls: ["/media/evidence/streetlight_before.jpg"],
    workerMediaUrls: [],
    resolutionMediaUrls: [],
  },
  {
    id: "CIV-32105",
    title: "Broken children park swing and rusted gym equipment in community park",
    category: "parks",
    categoryLabel: "Parks & public spaces",
    description:
      "Child playground swing chain snapped and outdoor fitness bench rusted with sharp protruding edges. Hazardous for children.",
    ward: "Ward 12 - Hassan Central",
    area: "Ward 12 Municipal Park, Racecourse Road",
    status: "submitted",
    priority: "low",
    department: "Parks Department",
    createdAt: "2026-09-25T09:10:00Z",
    updatedAt: "2026-09-25T09:10:00Z",
    aiConfidence: 0.9,
    duplicateProbability: 0.05,
    upvotes: 5,
    anonymous: false,
    reportedBy: "meera_joshi",
    societyName: "Green Park Society",
    distanceMeters: 390,
    x: 50,
    y: 56,
    latitude: 13.0062,
    longitude: 76.1042,
    address: "Ward 12 Municipal Park, Racecourse Road, Hassan",
    mediaUrls: ["/media/evidence/streetlight_before.jpg"],
    workerMediaUrls: [],
    resolutionMediaUrls: [],
  },
];


export const TIMELINE_STEPS: {
  key: string;
  label: string;
  detail: string;
}[] = [
  { key: "submitted", label: "Report submitted", detail: "Citizen submits media, location and description." },
  { key: "verified", label: "Report verified", detail: "Municipal staff confirm the issue and its category." },
  { key: "department", label: "Department assigned", detail: "The report is routed to the responsible department." },
  { key: "worker", label: "Field worker assigned", detail: "A worker is scheduled with instructions and a target date." },
  { key: "progress", label: "Work in progress", detail: "Progress photos and notes are added from the field." },
  { key: "resolved", label: "Issue resolved", detail: "Completion media is uploaded and the work is closed." },
  { key: "notified", label: "Citizen notified", detail: "You receive the resolution update and can reopen if needed." },
];

export const DEPARTMENTS = [
  { name: "Public Works — Roads", open: 184, resolvedMonth: 212, avgDays: 4.2, workers: 14 },
  { name: "Sanitation", open: 142, resolvedMonth: 268, avgDays: 1.8, workers: 22 },
  { name: "Water Supply", open: 74, resolvedMonth: 96, avgDays: 3.1, workers: 9 },
  { name: "Sewerage Department", open: 44, resolvedMonth: 61, avgDays: 3.9, workers: 7 },
  { name: "Electrical Department", open: 96, resolvedMonth: 154, avgDays: 2.4, workers: 11 },
  { name: "Traffic Department", open: 61, resolvedMonth: 73, avgDays: 2.9, workers: 6 },
  { name: "Parks Department", open: 37, resolvedMonth: 48, avgDays: 5.4, workers: 5 },
];

export const FIELD_WORKERS = [
  { name: "R. Manjunath", department: "Public Works — Roads", openTasks: 4, capacity: 6, status: "On site" },
  { name: "S. Latha", department: "Electrical Department", openTasks: 2, capacity: 6, status: "Available" },
  { name: "A. Firoz", department: "Water Supply", openTasks: 5, capacity: 5, status: "At capacity" },
  { name: "K. Prakash", department: "Traffic Department", openTasks: 1, capacity: 5, status: "Available" },
  { name: "M. Nagaraj", department: "Parks Department", openTasks: 3, capacity: 5, status: "On site" },
];

export const WEEKLY_VOLUME = [
  { week: "W27", submitted: 182, resolved: 141 },
  { week: "W28", submitted: 204, resolved: 168 },
  { week: "W29", submitted: 231, resolved: 197 },
  { week: "W30", submitted: 198, resolved: 205 },
  { week: "W31", submitted: 246, resolved: 219 },
  { week: "W32", submitted: 268, resolved: 241 },
];

export const RESOLUTION_TREND = [
  { week: "W27", days: 5.8 },
  { week: "W28", days: 5.2 },
  { week: "W29", days: 4.7 },
  { week: "W30", days: 4.4 },
  { week: "W31", days: 3.9 },
  { week: "W32", days: 3.4 },
];

export const NOTIFICATIONS = [
  {
    id: "n1",
    text: "Your report CIV-95674 has been submitted and is pending municipal staff triage.",
    time: "Just now",
    unread: true,
  },
];


export const TESTIMONIALS = [
  {
    quote:
      "Earlier, we had no idea whether our complaint was being handled. Now we can follow every stage from submission to resolution.",
    name: "Anitha R.",
    area: "Vidyanagar",
    rating: 5,
    verified: true,
  },
  {
    quote:
      "I reported a dark stretch near my daughter's school at night. The lights were back within three days and I got an update each time.",
    name: "Suresh K.",
    area: "Ward 4",
    rating: 5,
    verified: true,
  },
  {
    quote:
      "The photo and location steps take seconds. The tracking ID is what makes it feel like someone is actually accountable.",
    name: "Farhan M.",
    area: "Old Market Road",
    rating: 4,
    verified: false,
  },
];

export const LANGUAGES = ["English", "ಕನ್ನಡ (Kannada)", "हिन्दी (Hindi)"];

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getReport(id: string) {
  const deleted = getDeletedReportIds();
  if (deleted.has(id.toLowerCase())) return undefined;
  return REPORTS.find((r) => r.id.toLowerCase() === id.toLowerCase());
}

export const DELETED_REPORTS_KEY = "civicpulse_deleted_reports";

export function getDeletedReportIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_REPORTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map((id: string) => String(id).toLowerCase().trim()) : []);
  } catch {
    return new Set();
  }
}

export function markReportDeleted(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const set = getDeletedReportIds();
    set.add(id.toLowerCase().trim());
    localStorage.setItem(DELETED_REPORTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function filterOutDeletedReports(reports: CivicReport[]): CivicReport[] {
  const deleted = getDeletedReportIds();
  if (deleted.size === 0) return reports;
  return reports.filter((r) => !deleted.has(r.id.toLowerCase().trim()));
}

/** Mock AI classifier — stands in for the NLP/vision service until a key exists. */
export function mockClassify(text: string): {
  category: CategoryId;
  categoryLabel: string;
  department: string;
  priority: Priority;
  confidence: number;
  duplicateProbability: number;
  keywords: string[];
  summary: string;
  reason: string;
} {
  const t = text.toLowerCase();
  const match =
    (/pothole|road|footpath|manhole/.test(t) && "roads") ||
    (/light|lamp|electric|wire|pole/.test(t) && "electricity") ||
    (/garbage|waste|dump|bin|trash/.test(t) && "waste") ||
    (/water|drain|sewage|leak|flood/.test(t) && "water") ||
    (/signal|traffic|stray|dog|sign/.test(t) && "safety") ||
    (/park|bench|garden|playground/.test(t) && "parks") ||
    "roads";
  const category = match as CategoryId;
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const keywords = Array.from(
    new Set(
      t
        .split(/[^a-z]+/)
        .filter((w) => w.length > 4)
        .slice(0, 5),
    ),
  );
  return {
    category,
    categoryLabel: cat.examples[0] ?? cat.name,
    department: cat.department,
    priority: /urgent|danger|accident|flood|overflow|critical/.test(t) ? "high" : "medium",
    confidence: 0.94,
    duplicateProbability: 0.18,
    keywords: keywords.length ? keywords : ["pothole", "bus", "stop"],
    summary: text.trim() ? text.trim().slice(0, 90) : "Large pothole reported near the main bus stop",
    reason:
      "Matched category keywords in the description and two nearby reports in the same ward within the last 7 days.",
  };
}

