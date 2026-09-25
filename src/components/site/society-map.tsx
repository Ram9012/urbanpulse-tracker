import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  STATUS_META,
  PRIORITY_META,
  type CivicReport,
  type CategoryId,
} from "@/lib/civic-data";
import { StatusBadge, PriorityBadge } from "./primitives";

const CATEGORY_COLORS: Record<CategoryId, { bg: string; border: string; text: string; dot: string; icon: string }> = {
  electricity: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-500", dot: "bg-amber-500", icon: "⚡" },
  water: { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-500", dot: "bg-cyan-500", icon: "💧" },
  roads: { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-500", dot: "bg-blue-500", icon: "🕳️" },
  waste: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-500", dot: "bg-emerald-500", icon: "🗑️" },
  safety: { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-500", dot: "bg-rose-500", icon: "🚦" },
  parks: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-500", dot: "bg-green-500", icon: "🌳" },
};

interface SocietyMapProps {
  reports: CivicReport[];
  currentUsername?: string;
  className?: string;
  onSelectReport?: (report: CivicReport) => void;
}

export function SocietyMap({
  reports,
  currentUsername = "bipinyadav",
  className = "",
  onSelectReport,
}: SocietyMapProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports[0]?.id || "CIV-95674"
  );
  const [mapMode, setMapMode] = useState<"canvas" | "real">("canvas");
  const [filterScope, setFilterScope] = useState<"all" | "mine" | "critical">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [upvotes, setUpvotes] = useState<Record<string, number>>({});
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const leafletInstanceRef = useRef<any>(null);

  // Filter reports based on scope and category
  const filteredReports = reports.filter((r) => {
    const isMine =
      r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() ||
      r.id === "CIV-95674";

    if (filterScope === "mine" && !isMine) return false;
    if (filterScope === "critical" && r.priority !== "critical" && r.priority !== "high")
      return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;

    return true;
  });

  const selectedReport =
    reports.find((r) => r.id === selectedReportId) || filteredReports[0] || reports[0];

  const handleSelect = (r: CivicReport) => {
    setSelectedReportId(r.id);
    if (onSelectReport) onSelectReport(r);
  };

  const handleUpvote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setUpvotes((prev) => ({
      ...prev,
      [id]: (prev[id] ?? reports.find((x) => x.id === id)?.upvotes ?? 0) + 1,
    }));
  };

  // Real Map Leaflet initialization
  useEffect(() => {
    if (mapMode !== "real" || typeof window === "undefined" || !leafletContainerRef.current) return;

    let isMounted = true;
    import("leaflet").then((L) => {
      if (!isMounted || !leafletContainerRef.current) return;

      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
      }

      const centerLat = selectedReport?.latitude || 13.0072;
      const centerLng = selectedReport?.longitude || 76.1023;

      const map = L.map(leafletContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([centerLat, centerLng], 15);
      leafletInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Render pins on Leaflet
      filteredReports.forEach((r) => {
        const isSelected = r.id === selectedReportId;
        const isMine =
          r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() ||
          r.id === "CIV-95674";
        const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.roads;

        const pinHtml = `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${isSelected ? '<div style="position: absolute; width: 44px; height: 44px; background: rgba(20,110,245,0.25); border-radius: 50%; animation: ping 1.5s infinite;"></div>' : ""}
            <div style="background: ${isMine ? "#146ef5" : "#1e293b"}; color: white; width: 30px; height: 30px; border-radius: 50%; border: 3px solid ${isSelected ? "#38bdf8" : "white"}; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold;">
              ${cat.icon}
            </div>
            ${isMine ? '<div style="position: absolute; -top: 4px; -right: 4px; background: #f59e0b; color: #000; font-size: 9px; font-weight: 900; border-radius: 6px; padding: 1px 3px; line-height: 1;">YOU</div>' : ""}
          </div>
        `;

        const icon = L.divIcon({
          className: "leaflet-custom-marker",
          html: pinHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([r.latitude || 13.0072, r.longitude || 76.1023], { icon }).addTo(map);
        marker.on("click", () => handleSelect(r));
      });
    });

    return () => {
      isMounted = false;
      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
        leafletInstanceRef.current = null;
      }
    };
  }, [mapMode, selectedReportId, filterScope, categoryFilter]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Controls & Society Context */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface border border-border/80 p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-lg">
            📍
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                Society & Neighborhood Civic Map
              </h3>
              <span className="rounded-full bg-teal/10 border border-teal/20 px-2 py-0.5 text-[10px] font-bold text-teal-foreground">
                Ward 12 · Hassan Central
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing problems reported by you & neighbors in your society
            </p>
          </div>
        </div>

        {/* View mode toggle (Canvas vs Real Map) */}
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setMapMode("canvas")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition",
              mapMode === "canvas" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            🗺️ Society Grid
          </button>
          <button
            type="button"
            onClick={() => setMapMode("real")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition",
              mapMode === "real" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            🛰️ Live Street Map
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          <button
            type="button"
            onClick={() => setFilterScope("all")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold transition",
              filterScope === "all" ? "bg-surface text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            🌐 All Society Issues ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterScope("mine")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold transition",
              filterScope === "mine" ? "bg-surface text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            👤 My Issues
          </button>
          <button
            type="button"
            onClick={() => setFilterScope("critical")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold transition",
              filterScope === "critical" ? "bg-surface text-destructive shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            🚨 Critical / High
          </button>
        </div>

        {/* Category Pill selector */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter society problems by category"
          className="h-8 rounded-xl border border-input bg-surface px-3 text-xs font-semibold text-foreground outline-none ml-auto"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Map Box & Clicked Problem Card Layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Map Box */}
        <div className="relative rounded-3xl border border-border/80 bg-surface shadow-md overflow-hidden min-h-[380px] sm:min-h-[440px]">
          {mapMode === "real" ? (
            <div ref={leafletContainerRef} className="size-full min-h-[380px] sm:min-h-[440px]" />
          ) : (
            <div className="relative size-full min-h-[380px] sm:min-h-[440px] bg-slate-950 overflow-hidden">
              {/* Illustrated Society Blueprint Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />

              {/* Road Network Overlays */}
              <svg
                className="absolute inset-0 size-full text-slate-800/80 pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Major Arterial Roads */}
                <path d="M0 45 Q 50 48 100 45" stroke="#334155" strokeWidth="4.5" fill="none" />
                <path d="M0 45 Q 50 48 100 45" stroke="#0284c7" strokeWidth="0.8" strokeDasharray="3 3" fill="none" opacity="0.6" />
                <path d="M45 0 Q 48 50 45 100" stroke="#334155" strokeWidth="4.5" fill="none" />
                <path d="M45 0 Q 48 50 45 100" stroke="#0284c7" strokeWidth="0.8" strokeDasharray="3 3" fill="none" opacity="0.6" />

                {/* Society Cross Lanes */}
                <path d="M15 0 V100" stroke="#1e293b" strokeWidth="2.5" />
                <path d="M75 0 V100" stroke="#1e293b" strokeWidth="2.5" />
                <path d="M0 25 H100" stroke="#1e293b" strokeWidth="2.5" />
                <path d="M0 75 H100" stroke="#1e293b" strokeWidth="2.5" />
                <path d="M15 25 C 30 35 60 20 85 30" stroke="#1e293b" strokeWidth="1.8" fill="none" />
                <path d="M15 75 C 35 65 70 85 90 70" stroke="#1e293b" strokeWidth="1.8" fill="none" />

                {/* Society Landmarks */}
                <rect x="18" y="8" width="14" height="12" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                <rect x="52" y="8" width="18" height="12" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                <rect x="78" y="10" width="14" height="10" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                <rect x="8" y="55" width="18" height="14" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                <rect x="52" y="58" width="16" height="14" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                <circle cx="80" cy="80" r="10" fill="#064e3b" opacity="0.3" stroke="#059669" strokeWidth="1" strokeDasharray="2 2" />
              </svg>

              {/* Society Area Labels */}
              <div className="absolute top-3 left-4 text-[10px] font-bold tracking-wider text-slate-500 uppercase select-none">
                Ward 12 · North Society Block
              </div>
              <div className="absolute bottom-3 left-4 text-[10px] font-bold tracking-wider text-slate-500 uppercase select-none">
                Racecourse Residency · BM Road Axis
              </div>
              <div className="absolute top-3 right-4 text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 border border-cyan-800/40 rounded px-2 py-0.5 select-none">
                13.0072° N, 76.1023° E (Hassan)
              </div>

              {/* Your Location Society Center Marker */}
              <div
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: "45%", top: "45%" }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute size-14 rounded-full bg-cyan-500/20 animate-ping" />
                  <div className="size-5 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white">
                    📍
                  </div>
                  <div className="absolute top-6 whitespace-nowrap rounded-md bg-slate-900/90 border border-cyan-500/40 px-2 py-0.5 text-[9px] font-black tracking-wide text-cyan-300 shadow">
                    YOU ARE HERE
                  </div>
                </div>
              </div>

              {/* Render All Society Problem Points */}
              {filteredReports.map((r, idx) => {
                const isSelected = selectedReport?.id === r.id;
                const isMine =
                  r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() ||
                  r.id === "CIV-95674";
                const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.roads;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelect(r)}
                    aria-label={`Point ${idx + 1}: ${r.title} - ${r.area}`}
                    className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 focus:outline-none transition-transform duration-200 hover:scale-125"
                    style={{ left: `${r.x}%`, top: `${r.y}%` }}
                  >
                    <div className="relative flex items-center justify-center">
                      {/* Active pulse aura when selected */}
                      {isSelected && (
                        <div className="absolute size-12 rounded-full bg-primary/40 animate-ping" />
                      )}

                      {/* Problem Point Badge */}
                      <div
                        className={cn(
                          "relative flex size-8 items-center justify-center rounded-full border-2 transition-all shadow-xl",
                          isMine
                            ? "bg-primary border-white text-white ring-4 ring-primary/40 scale-110"
                            : "bg-slate-900 border-slate-200 text-white hover:border-primary",
                          isSelected && "ring-4 ring-cyan-400 scale-125 z-30"
                        )}
                      >
                        <span className="text-xs">{cat.icon}</span>

                        {/* Point number indicator */}
                        <span
                          className={cn(
                            "absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-black border",
                            isMine
                              ? "bg-amber-400 text-slate-950 border-amber-300"
                              : "bg-slate-800 text-slate-200 border-slate-600"
                          )}
                        >
                          {idx + 1}
                        </span>
                      </div>

                      {/* Tooltip on hover */}
                      <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-lg bg-slate-900/95 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-40">
                        {r.id}: {r.categoryLabel} · {r.distanceMeters || 100}m
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Map Footer Legend */}
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 text-[11px] text-slate-300 shadow">
            <span className="flex items-center gap-1 font-semibold">
              <span className="size-2 rounded-full bg-primary ring-2 ring-white/50" />
              <span>Your Report</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="size-2 rounded-full bg-slate-400" />
              <span>Neighbor Report</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 font-bold">
              {filteredReports.length} problems mapped
            </span>
          </div>
        </div>

        {/* Selected Problem Card (Opens when ANY point is clicked) */}
        <aside className="flex flex-col justify-between rounded-3xl border border-border/80 bg-surface p-5 shadow-md">
          {selectedReport ? (
            <div className="space-y-4">
              {/* Header with Point ID & Reporter */}
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                    {selectedReport.id}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Point {reports.findIndex((x) => x.id === selectedReport.id) + 1} of {reports.length}
                  </span>
                </div>
                <StatusBadge status={selectedReport.status} />
              </div>

              {/* Problem Title & Category */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
                  <span>{CATEGORY_COLORS[selectedReport.category]?.icon}</span>
                  <span>{selectedReport.categoryLabel}</span>
                  <span className="text-muted-foreground">·</span>
                  <PriorityBadge priority={selectedReport.priority} />
                </div>
                <h4 className="font-display text-base font-bold leading-snug text-foreground">
                  {selectedReport.title}
                </h4>
              </div>

              {/* Exact Location & Proximity */}
              <div className="rounded-2xl bg-muted/40 border border-border/60 p-3.5 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-foreground font-medium">
                  <span className="text-sm mt-0.5">📍</span>
                  <div>
                    <span className="font-bold">{selectedReport.societyName || selectedReport.area}</span>
                    <p className="text-muted-foreground text-[11px]">{selectedReport.address || selectedReport.area}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                  <span className="font-bold text-teal flex items-center gap-1">
                    <span>📏</span>
                    <span>{selectedReport.distanceMeters ? `${selectedReport.distanceMeters}m from your society` : "Near your location"}</span>
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {selectedReport.ward}
                  </span>
                </div>
              </div>

              {/* Reporter Info Badge */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {selectedReport.reportedBy?.toLowerCase() === currentUsername.toLowerCase() ? "👤" : "👥"}
                  </span>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      {selectedReport.reportedBy?.toLowerCase() === currentUsername.toLowerCase()
                        ? "Reported by You"
                        : "Reported by Society Neighbor"}
                    </span>
                    <span className="font-bold text-foreground">
                      {selectedReport.reportedBy || "Local Resident"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleUpvote(e, selectedReport.id)}
                  title="Confirm you are also affected by this civic problem"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition active:scale-95"
                >
                  <span>👍 +1</span>
                  <span>{upvotes[selectedReport.id] ?? selectedReport.upvotes ?? 0}</span>
                </button>
              </div>

              {/* Photo Evidence Preview */}
              {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 && (
                <div className="relative rounded-2xl overflow-hidden border border-border aspect-video bg-black/10">
                  <img
                    src={selectedReport.mediaUrls[0]}
                    alt={selectedReport.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                    📷 Site Evidence Photo
                  </div>
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {selectedReport.description}
              </p>

              {/* View Full Timeline Action */}
              <div className="pt-2">
                <Link
                  to="/reports/$id"
                  params={{ id: selectedReport.id }}
                  className="w-full inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition"
                >
                  View Live Status & Timeline →
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm font-semibold">Click on any point on the map to view the problem details.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Quick Problem Selector Strip below map */}
      <div className="rounded-2xl border border-border/80 bg-surface p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold text-foreground">
            Nearby Problems in Your Area ({filteredReports.length})
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any problem card to highlight its point on the map
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {filteredReports.map((r, idx) => {
            const isSelected = selectedReport?.id === r.id;
            const isMine =
              r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() ||
              r.id === "CIV-95674";
            const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.roads;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                    : "border-border/70 bg-surface hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">
                      Point {idx + 1} · {r.id}
                    </span>
                    {isMine && (
                      <span className="rounded bg-amber-400 text-slate-950 px-1 py-0.2 text-[9px] font-black">
                        YOU
                      </span>
                    )}
                  </div>
                  <h5 className="text-xs font-bold text-foreground line-clamp-1">
                    {r.title}
                  </h5>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {r.societyName || r.area}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40">
                  <span className={cn("font-bold flex items-center gap-1", cat.text)}>
                    <span>{cat.icon}</span>
                    <span>{r.categoryLabel.split("&")[0]}</span>
                  </span>
                  <span className="font-semibold text-muted-foreground">
                    {r.distanceMeters ? `${r.distanceMeters}m` : "Nearby"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
