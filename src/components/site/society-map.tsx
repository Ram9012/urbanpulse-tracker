import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CATEGORIES, type CivicReport, type CategoryId } from "@/lib/civic-data";
import { StatusBadge, PriorityBadge } from "./primitives";

const CATEGORY_COLORS: Record<
  CategoryId,
  { bg: string; border: string; text: string; dot: string; icon: string; hex: string }
> = {
  electricity: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-500",
    dot: "bg-amber-500",
    icon: "⚡",
    hex: "#f59e0b",
  },
  water: {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/40",
    text: "text-cyan-500",
    dot: "bg-cyan-500",
    icon: "💧",
    hex: "#06b6d4",
  },
  roads: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/40",
    text: "text-blue-500",
    dot: "bg-blue-500",
    icon: "🕳️",
    hex: "#2563eb",
  },
  waste: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-500",
    dot: "bg-emerald-500",
    icon: "🗑️",
    hex: "#10b981",
  },
  safety: {
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    text: "text-rose-500",
    dot: "bg-rose-500",
    icon: "🚦",
    hex: "#e11d48",
  },
  parks: {
    bg: "bg-green-500/15",
    border: "border-green-500/40",
    text: "text-green-500",
    dot: "bg-green-500",
    icon: "🌳",
    hex: "#16a34a",
  },
};

interface SocietyMapProps {
  reports: CivicReport[];
  currentUsername?: string;
  className?: string;
  onSelectReport?: (report: CivicReport) => void;
  onDeleteReport?: (reportId: string) => void;
}

export function SocietyMap({
  reports,
  currentUsername = "bipinyadav",
  className = "",
  onSelectReport,
  onDeleteReport,
}: SocietyMapProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports[0]?.id || "CIV-95674",
  );
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");
  const [filterScope, setFilterScope] = useState<"all" | "mine" | "critical">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [upvotes, setUpvotes] = useState<Record<string, number>>({});
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const leafletInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  // Filter reports based on scope and category
  const filteredReports = reports.filter((r) => {
    const isMine =
      r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() || r.id === "CIV-95674";

    if (filterScope === "mine" && !isMine) return false;
    if (filterScope === "critical" && r.priority !== "critical" && r.priority !== "high")
      return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;

    return true;
  });

  const selectedReport =
    reports.find((r) => r.id === selectedReportId) || filteredReports[0] || reports[0];

  // Auto-recover selection if current report is deleted or filtered out
  useEffect(() => {
    setIsConfirmingDelete(false);
    if (selectedReportId && !reports.some((r) => r.id === selectedReportId)) {
      setSelectedReportId(filteredReports[0]?.id || reports[0]?.id || null);
    }
  }, [reports, filteredReports, selectedReportId]);

  const handleSelect = (r: CivicReport) => {
    setIsConfirmingDelete(false);
    setSelectedReportId(r.id);
    if (onSelectReport) onSelectReport(r);

    // Pan map to report location smoothly
    if (leafletInstanceRef.current && r.latitude && r.longitude) {
      leafletInstanceRef.current.flyTo([r.latitude, r.longitude], 16, {
        duration: 0.8,
      });
    }
  };

  const handleUpvote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setUpvotes((prev) => ({
      ...prev,
      [id]: (prev[id] ?? reports.find((x) => x.id === id)?.upvotes ?? 0) + 1,
    }));
  };

  // Locate User's live GPS coordinates
  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGps(coords);
        setLocating(false);
        if (leafletInstanceRef.current) {
          leafletInstanceRef.current.flyTo([coords.lat, coords.lng], 16, { duration: 1 });
        }
      },
      () => {
        // Fallback: Hassan CMC central location
        const coords = { lat: 13.0072, lng: 76.1023 };
        setUserGps(coords);
        setLocating(false);
        if (leafletInstanceRef.current) {
          leafletInstanceRef.current.flyTo([coords.lat, coords.lng], 16, { duration: 1 });
        }
      },
      { timeout: 8000 },
    );
  };

  // Recenter map on Hassan Society Center
  const handleCenterSociety = () => {
    if (leafletInstanceRef.current) {
      leafletInstanceRef.current.flyTo([13.0072, 76.1023], 15, { duration: 0.8 });
    }
  };

  // Initialize Real Leaflet Map ONCE
  useEffect(() => {
    if (typeof window === "undefined" || !leafletContainerRef.current) return;

    let isMounted = true;
    import("leaflet").then((L) => {
      if (!isMounted || !leafletContainerRef.current) return;

      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
        leafletInstanceRef.current = null;
      }

      const initialLat = selectedReport?.latitude || 13.0072;
      const initialLng = selectedReport?.longitude || 76.1023;

      const map = L.map(leafletContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([initialLat, initialLng], 15);
      leafletInstanceRef.current = map;

      const tileUrl =
        mapLayer === "satellite"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

      const attribution =
        mapLayer === "satellite"
          ? '&copy; <a href="https://www.esri.com/">Esri</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      const tileLayer = L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(map);
      tileLayerRef.current = tileLayer;

      const markersGroup = L.featureGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      // Invalidate size to ensure proper rendering without grey tiles
      setTimeout(() => {
        if (leafletInstanceRef.current) {
          leafletInstanceRef.current.invalidateSize();
        }
      }, 250);
    });

    return () => {
      isMounted = false;
      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
        leafletInstanceRef.current = null;
      }
    };
  }, []);

  // Update map tile layer when mapLayer changes
  useEffect(() => {
    if (!leafletInstanceRef.current) return;
    import("leaflet").then((L) => {
      if (!leafletInstanceRef.current) return;
      if (tileLayerRef.current) {
        leafletInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const tileUrl =
        mapLayer === "satellite"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

      const attribution =
        mapLayer === "satellite"
          ? '&copy; <a href="https://www.esri.com/">Esri</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(
        leafletInstanceRef.current,
      );
    });
  }, [mapLayer]);

  // Update markers on the map dynamically without destroying the canvas
  useEffect(() => {
    if (!leafletInstanceRef.current || !markersGroupRef.current) return;
    import("leaflet").then((L) => {
      if (!leafletInstanceRef.current || !markersGroupRef.current) return;
      markersGroupRef.current.clearLayers();

      filteredReports.forEach((r, idx) => {
        const isSelected = r.id === selectedReportId;
        const isMine =
          r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() || r.id === "CIV-95674";
        const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.roads;

        const pinHtml = `
          <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${
              isSelected
                ? '<div style="position: absolute; width: 50px; height: 50px; background: rgba(20,110,245,0.35); border-radius: 50%; animation: ping 1.5s infinite;"></div>'
                : ""
            }
            <div style="background: ${isMine ? "#146ef5" : "#0f172a"}; color: white; width: 34px; height: 34px; border-radius: 50%; border: 3px solid ${
              isSelected ? "#38bdf8" : isMine ? "#f59e0b" : "white"
            }; box-shadow: 0 4px 14px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: bold; transform: ${
              isSelected ? "scale(1.2)" : "scale(1)"
            }; transition: transform 0.2s;">
              ${cat.icon}
            </div>
            <div style="position: absolute; bottom: -3px; right: -3px; background: ${
              isMine ? "#f59e0b" : "#334155"
            }; color: ${isMine ? "#000" : "#fff"}; font-size: 9px; font-weight: 900; border-radius: 6px; padding: 1px 4px; border: 1px solid white; line-height: 1;">
              ${isMine ? "YOU" : idx + 1}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: "leaflet-society-marker",
          html: pinHtml,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const marker = L.marker([r.latitude || 13.0072, r.longitude || 76.1023], { icon });

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px;">
            <div style="font-weight: 800; color: #146ef5; font-size: 11px; margin-bottom: 2px;">${r.id} · Point ${idx + 1}</div>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">${r.title}</div>
            <div style="color: #64748b; font-size: 11px;">📍 ${r.societyName || r.area}</div>
            <div style="color: #0d9488; font-weight: 700; font-size: 11px; margin-top: 2px;">📏 ${r.distanceMeters || 100}m away</div>
            <div style="color: #64748b; font-size: 10px; margin-top: 2px;">👤 ${isMine ? "Reported by You" : `Reported by: ${r.reportedBy || "Neighbor"}`}</div>
          </div>
        `;
        marker.bindPopup(popupContent);

        marker.on("click", () => {
          handleSelect(r);
        });

        markersGroupRef.current.addLayer(marker);
      });

      if (userGps) {
        const userIcon = L.divIcon({
          className: "leaflet-user-gps-marker",
          html: `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 44px; height: 44px; background: rgba(6,182,212,0.3); border-radius: 50%; animation: ping 2s infinite;"></div>
              <div style="background: #06b6d4; color: white; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px;">
                📍
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const userMarker = L.marker([userGps.lat, userGps.lng], { icon: userIcon });
        userMarker.bindPopup("<b>Your Society Location</b><br/>You are here.");
        markersGroupRef.current.addLayer(userMarker);
      }
    });
  }, [filteredReports, selectedReportId, userGps]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Header & Map Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface border border-border/80 p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-lg">
            🗺️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                Real Hassan Society & Neighborhood Map
              </h3>
              <span className="rounded-full bg-teal/10 border border-teal/20 px-2 py-0.5 text-[10px] font-bold text-teal-foreground">
                Live OpenStreetMap · Ward 12
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Real geographic coordinates of civic issues reported by you & neighbors in your
              society
            </p>
          </div>
        </div>

        {/* Real Map Layer Controls & Locate Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            title="Locate my GPS position"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition active:scale-95 disabled:opacity-50"
          >
            <span>📍</span>
            <span>{locating ? "Locating..." : "Locate Me"}</span>
          </button>

          <button
            type="button"
            onClick={handleCenterSociety}
            title="Center on Hassan Society"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Center Society</span>
          </button>

          {/* Layer switcher: Street vs Satellite */}
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMapLayer("streets")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition",
                mapLayer === "streets"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🗺️ Streets
            </button>
            <button
              type="button"
              onClick={() => setMapLayer("satellite")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition",
                mapLayer === "satellite"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🛰️ Satellite
            </button>
          </div>
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
              filterScope === "all"
                ? "bg-surface text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            🌐 All Society Issues ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterScope("mine")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold transition",
              filterScope === "mine"
                ? "bg-surface text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            👤 My Issues
          </button>
          <button
            type="button"
            onClick={() => setFilterScope("critical")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold transition",
              filterScope === "critical"
                ? "bg-surface text-destructive shadow-xs"
                : "text-muted-foreground hover:text-foreground",
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

      {/* Main Real Map Container & Selected Problem Card */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Real OpenStreetMap Container */}
        <div className="relative rounded-3xl border border-border/80 bg-surface shadow-md overflow-hidden min-h-[440px] sm:min-h-[500px]">
          <div
            ref={leafletContainerRef}
            className="size-full min-h-[440px] sm:min-h-[500px] z-10"
            style={{ width: "100%", height: "100%" }}
          />

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-3 right-3 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-surface/90 backdrop-blur-md border border-border/80 px-3 py-1.5 text-[11px] text-foreground shadow-md">
            <span className="flex items-center gap-1 font-bold text-primary">
              <span className="size-2.5 rounded-full bg-primary ring-2 ring-white" />
              <span>Your Report (YOU)</span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="flex items-center gap-1 font-semibold text-muted-foreground">
              <span className="size-2.5 rounded-full bg-slate-800 ring-1 ring-white" />
              <span>Neighbor Report</span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-teal font-bold">{filteredReports.length} real points mapped</span>
          </div>

          {/* Center Coordinates HUD */}
          <div className="absolute top-3 right-3 z-20 hidden sm:flex items-center gap-1.5 rounded-lg bg-surface/90 backdrop-blur-md border border-border/70 px-2.5 py-1 text-[10px] font-mono font-semibold text-foreground shadow-sm">
            <span>📍 Hassan Center: 13.0072° N, 76.1023° E</span>
          </div>
        </div>

        {/* Selected Problem Card (Opens & updates on clicking ANY pin) */}
        <aside className="flex flex-col justify-between rounded-3xl border border-border/80 bg-surface p-5 shadow-md">
          {selectedReport ? (
            <div className="space-y-4">
              {/* Header with Point ID & Status */}
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                    {selectedReport.id}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Point {reports.findIndex((x) => x.id === selectedReport.id) + 1} of{" "}
                    {reports.length}
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
                    <span className="font-bold">
                      {selectedReport.societyName || selectedReport.area}
                    </span>
                    <p className="text-muted-foreground text-[11px]">
                      {selectedReport.address || selectedReport.area}
                    </p>
                    {selectedReport.latitude && selectedReport.longitude && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        GPS: {selectedReport.latitude.toFixed(4)}° N,{" "}
                        {selectedReport.longitude.toFixed(4)}° E
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                  <span className="font-bold text-teal flex items-center gap-1">
                    <span>📏</span>
                    <span>
                      {selectedReport.distanceMeters
                        ? `${selectedReport.distanceMeters}m from your society`
                        : "Near your society"}
                    </span>
                  </span>
                  <span className="text-muted-foreground font-semibold">{selectedReport.ward}</span>
                </div>
              </div>

              {/* Reporter Info Badge */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {selectedReport.reportedBy?.toLowerCase() === currentUsername.toLowerCase()
                      ? "👤"
                      : "👥"}
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

              {/* Actions: View Timeline and Delete */}
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to="/reports/$id"
                  params={{ id: selectedReport.id }}
                  className="w-full inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition text-center"
                >
                  View Live Status & Timeline →
                </Link>
                {onDeleteReport &&
                  (isConfirmingDelete ? (
                    <div className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                        <span>⚠️</span>
                        <span>Permanently delete {selectedReport.id}?</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        This cannot be undone. This problem will be permanently erased from the map,
                        database, and Supabase.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsConfirmingDelete(false);
                            onDeleteReport(selectedReport.id);
                          }}
                          className="flex-1 inline-flex min-h-8 items-center justify-center rounded-lg bg-destructive px-3 text-xs font-bold text-white shadow hover:brightness-110 transition active:scale-95"
                        >
                          Yes, Delete Permanently
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDelete(false)}
                          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="w-full inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-destructive/35 bg-destructive/10 px-3 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition active:scale-95 shadow-xs"
                      title="Permanently delete this report from municipal records and Supabase"
                    >
                      <span>🗑️</span>
                      <span>Delete This Report Permanently</span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm font-semibold">
                Click on any point on the real map to view problem details.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Nearby Problems Grid below the real map */}
      <div className="rounded-2xl border border-border/80 bg-surface p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold text-foreground">
            Problems Mapped in Your Area ({filteredReports.length})
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any problem card to fly the real map directly to that point
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {filteredReports.map((r, idx) => {
            const isSelected = selectedReport?.id === r.id;
            const isMine =
              r.reportedBy?.toLowerCase() === currentUsername.toLowerCase() || r.id === "CIV-95674";
            const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.roads;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20 scale-[1.01]"
                    : "border-border/70 bg-surface hover:border-primary/40 hover:bg-muted/30",
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
                  <h5 className="text-xs font-bold text-foreground line-clamp-1">{r.title}</h5>
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
