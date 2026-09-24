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
  worker?: string;
  createdAt: string;
  updatedAt: string;
  aiConfidence: number;
  duplicateProbability: number;
  upvotes: number;
  anonymous: boolean;
  /** Percent coordinates on the illustrated demo map. */
  x: number;
  y: number;
  mediaUrls?: string[];
  workerMediaUrls?: string[];
  resolutionMediaUrls?: string[];
  latitude?: number;
  longitude?: number;
  address?: string;
  resolutionNotes?: string;
};

export const REPORTS: CivicReport[] = [
  {
    id: "CIV-10482",
    title: "Large pothole near the main bus stop",
    category: "roads",
    categoryLabel: "Road damage",
    description:
      "A deep pothole has formed on the left lane right before the bus stop. Two-wheelers are swerving into traffic to avoid it.",
    ward: "Ward 12",
    area: "Bus Stand Road",
    status: "in_progress",
    priority: "high",
    department: "Public Works — Roads",
    worker: "R. Manjunath",
    createdAt: "2026-08-09T09:12:00Z",
    updatedAt: "2026-08-11T06:40:00Z",
    aiConfidence: 0.94,
    duplicateProbability: 0.18,
    upvotes: 34,
    anonymous: false,
    x: 28,
    y: 42,
  },
  {
    id: "CIV-10479",
    title: "Streetlights out on the entire lane",
    category: "electricity",
    categoryLabel: "Streetlight failure",
    description:
      "Six streetlights between the school gate and the water tank have been off for four nights. The stretch is completely dark.",
    ward: "Ward 4",
    area: "Vidyanagar 3rd Cross",
    status: "assigned",
    priority: "medium",
    department: "Electrical Department",
    worker: "S. Latha",
    createdAt: "2026-08-08T18:02:00Z",
    updatedAt: "2026-08-10T11:20:00Z",
    aiConfidence: 0.91,
    duplicateProbability: 0.06,
    upvotes: 21,
    anonymous: true,
    x: 62,
    y: 27,
  },
  {
    id: "CIV-10475",
    title: "Garbage piling up beside the market gate",
    category: "waste",
    categoryLabel: "Garbage accumulation",
    description:
      "Waste has not been collected for three days. It is spreading onto the footpath and smells strongly in the afternoon.",
    ward: "Ward 7",
    area: "Old Market Road",
    status: "verified",
    priority: "high",
    department: "Sanitation",
    createdAt: "2026-08-11T05:45:00Z",
    updatedAt: "2026-08-11T08:05:00Z",
    aiConfidence: 0.88,
    duplicateProbability: 0.42,
    upvotes: 48,
    anonymous: false,
    x: 45,
    y: 66,
  },
  {
    id: "CIV-10468",
    title: "Drain overflowing after the night rain",
    category: "water",
    categoryLabel: "Drainage overflow",
    description:
      "The roadside drain is blocked and water is standing across the junction. Shops on the corner are affected.",
    ward: "Ward 9",
    area: "Katihalli Junction",
    status: "submitted",
    priority: "critical",
    department: "Sewerage Department",
    createdAt: "2026-08-12T02:15:00Z",
    updatedAt: "2026-08-12T02:15:00Z",
    aiConfidence: 0.79,
    duplicateProbability: 0.11,
    upvotes: 12,
    anonymous: false,
    x: 74,
    y: 58,
  },
  {
    id: "CIV-10441",
    title: "Repaired footpath near the government school",
    category: "roads",
    categoryLabel: "Broken footpath",
    description:
      "Cracked slabs outside the school entrance were replaced and the surface has been levelled.",
    ward: "Ward 12",
    area: "School Road",
    status: "resolved",
    priority: "medium",
    department: "Public Works — Roads",
    worker: "R. Manjunath",
    createdAt: "2026-07-28T07:30:00Z",
    updatedAt: "2026-08-04T13:10:00Z",
    aiConfidence: 0.96,
    duplicateProbability: 0.04,
    upvotes: 57,
    anonymous: false,
    x: 18,
    y: 72,
  },
  {
    id: "CIV-10437",
    title: "Traffic signal stuck on amber",
    category: "safety",
    categoryLabel: "Traffic signal fault",
    description:
      "The signal at the circle keeps blinking amber during peak hours and vehicles are crossing unpredictably.",
    ward: "Ward 2",
    area: "NR Circle",
    status: "resolved",
    priority: "high",
    department: "Traffic Department",
    worker: "K. Prakash",
    createdAt: "2026-07-30T16:00:00Z",
    updatedAt: "2026-08-02T09:25:00Z",
    aiConfidence: 0.93,
    duplicateProbability: 0.09,
    upvotes: 29,
    anonymous: true,
    x: 55,
    y: 18,
  },
  {
    id: "CIV-10430",
    title: "Park lights and broken benches",
    category: "parks",
    categoryLabel: "Park maintenance",
    description:
      "Two benches near the walking track are broken and the garden lights stay off in the evening.",
    ward: "Ward 5",
    area: "Gandhi Park",
    status: "assigned",
    priority: "low",
    department: "Parks Department",
    worker: "M. Nagaraj",
    createdAt: "2026-08-05T12:40:00Z",
    updatedAt: "2026-08-09T10:00:00Z",
    aiConfidence: 0.84,
    duplicateProbability: 0.07,
    upvotes: 15,
    anonymous: false,
    x: 34,
    y: 24,
  },
  {
    id: "CIV-10422",
    title: "Water leaking from the main pipeline",
    category: "water",
    categoryLabel: "Water leakage",
    description:
      "Continuous leakage at the pipeline joint is wasting water and softening the road shoulder.",
    ward: "Ward 9",
    area: "Pension Mohalla",
    status: "in_progress",
    priority: "high",
    department: "Water Supply",
    worker: "A. Firoz",
    createdAt: "2026-08-06T04:20:00Z",
    updatedAt: "2026-08-11T15:30:00Z",
    aiConfidence: 0.9,
    duplicateProbability: 0.23,
    upvotes: 26,
    anonymous: false,
    x: 82,
    y: 38,
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
    text: "Your report CIV-10482 is now in progress with the Roads Department.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: "n2",
    text: "Sanitation verified CIV-10475 and scheduled a collection round.",
    time: "Yesterday",
    unread: true,
  },
  {
    id: "n3",
    text: "CIV-10441 was marked resolved. Before-and-after photos are available.",
    time: "8 Aug",
    unread: false,
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
  return REPORTS.find((r) => r.id.toLowerCase() === id.toLowerCase());
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
