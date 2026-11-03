import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { Section } from "@/components/site/primitives";
import {
  BRAND,
  CATEGORIES,
  LANGUAGES,
  mockClassify,
  CivicReport,
  REPORTS,
  calculateDistanceMeters,
  getDeletedReportIds,
} from "@/lib/civic-data";
import { RealMap, LocationData } from "@/components/site/real-map";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Civic Issue in Under a Minute — CivicPulse" },
      {
        name: "description",
        content:
          "Add real photos, capture camera images or video, pinpoint exact location on world map, and submit.",
      },
      { property: "og:title", content: "Report a Civic Issue in Under a Minute — CivicPulse" },
      {
        property: "og:description",
        content: "Real camera, photo upload, world interactive map, and Groq AI triage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const STEPS = ["Add media", "Confirm location", "Describe issue", "Review & submit"];

export interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  name: string;
  size?: string;
  timestamp: string;
}

interface AiAnalysisResult {
  summary: string;
  keywords: string[];
  severity_signals: string[];
  priority_recommendation: "critical" | "high" | "medium" | "low";
  priority_reason: string;
  confidence: number;
  category_mismatch?: boolean | undefined;
  detected_category?: string | undefined;
  suggested_description?: string | undefined;
  source?: string | undefined;
  category?: string | undefined;
}

const CATEGORY_TEMPLATES: Record<string, { label: string; text: string }[]> = {
  "Streetlight & electricity": [
    {
      label: "💡 Streetlights Out",
      text: "Six streetlights between the school gate and the water tank have been unlit for four nights. The entire stretch is in complete darkness, creating severe safety risks.",
    },
    {
      label: "💡 Broken Lamp Post",
      text: "A streetlight post has a damaged fixture and flickering bulb near the junction, causing low visibility and accident risk at night.",
    },
    {
      label: "⚡ Exposed Wire Hazard",
      text: "An exposed electrical cable is dangling from the utility pole near the pedestrian sidewalk. Poses high risk of electrical shock.",
    },
  ],
  "Road damage": [
    {
      label: "🚧 Large Pothole",
      text: "A deep pothole has formed on the left lane right before the bus stop. Two-wheelers are swerving into oncoming traffic to avoid it.",
    },
    {
      label: "🚧 Broken Footpath",
      text: "Repaired footpath near the school has collapsed paving slabs, forcing pedestrians to walk on the busy vehicular road.",
    },
  ],
  "Drainage & storm water": [
    {
      label: "🌊 Overflowing Drain",
      text: "Drain overflowing after night rain at the junction, flooding the road with foul water and blocking pedestrian access.",
    },
  ],
  "Garbage & sanitation": [
    {
      label: "🗑️ Garbage Piling Up",
      text: "Waste has not been collected for three days beside the market gate. Spreading onto the footpath and smelling strongly.",
    },
  ],
  "Traffic & public safety": [
    {
      label: "🚦 Traffic Signal Stuck",
      text: "Traffic signal stuck on amber on the main circle, causing severe vehicular gridlock and near-miss collisions.",
    },
  ],
};

interface DuplicateCheckResult {
  is_duplicate: boolean;
  similarity_score: number;
  explanation: string;
  recommended_action: string;
  existingReport?: CivicReport | null;
  distanceMeters?: number;
}

function ReportPage() {
  const [step, setStep] = useState(0);

  // Real Media Upload & Camera State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoStreamRef = useRef<HTMLVideoElement>(null);
  const streamTrackRef = useRef<MediaStream | null>(null);

  // File Input References
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);

  // Real Location & World Map State
  const [locationData, setLocationData] = useState<LocationData>({
    lat: 13.0072,
    lng: 76.1023,
    address: "Bus Stand Road, Ward 12, Hassan",
    ward: "Ward 12",
    city: "Hassan",
  });

  const [description, setDescription] = useState(
    "Six streetlights between the school gate and the water tank have been off for four nights. The stretch is dark and hazardous.",
  );
  const [listening, setListening] = useState(false);
  const [category, setCategory] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const catParam = urlParams.get("category");
        if (catParam) {
          const found = CATEGORIES.find(
            (c) =>
              c.id.toLowerCase() === catParam.toLowerCase() ||
              c.name.toLowerCase() === catParam.toLowerCase(),
          );
          if (found) return found.name;
        }
      } catch {}
    }
    return CATEGORIES[1]!.name; // "Streetlight & electricity"
  });
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<CivicReport | null>(null);

  // Live AI State
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [selectedAction, setSelectedAction] = useState<"new" | "merge">("new");
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoting, setUpvoting] = useState(false);
  const [upvoteSuccessMessage, setUpvoteSuccessMessage] = useState<string | null>(null);
  const [allExistingReports, setAllExistingReports] = useState<CivicReport[]>(REPORTS);

  // Fetch latest active reports from server for accurate live location-based duplicate detection
  useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch("/api/status/reports");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.reports) && data.reports.length > 0) {
            setAllExistingReports(data.reports);
          }
        }
      } catch (err) {
        console.warn("Could not load reports for duplicate check:", err);
      }
    }
    loadReports();
  }, []);

  // Duplicate Check against Nearby Complaints at the same location (e.g. <= 300 meters)
  const checkForDuplicatesAtLocation = async (
    textToAnalyze: string,
    currentLocation: LocationData,
    activeCatName: string,
  ) => {
    if (!textToAnalyze || textToAnalyze.trim().length < 5) return;

    const deleted = getDeletedReportIds();
    // 1. Find reports near the chosen coordinates
    const candidates = allExistingReports
      .filter((r) => !deleted.has(r.id.toLowerCase().trim()) && r.status !== "resolved")
      .map((r) => {
        const dist =
          r.latitude && r.longitude && currentLocation.lat && currentLocation.lng
            ? calculateDistanceMeters(
                currentLocation.lat,
                currentLocation.lng,
                r.latitude,
                r.longitude,
              )
            : 9999;
        return { report: r, dist };
      })
      .filter(({ dist }) => dist <= 500) // Within 500 meters of the same spot
      .sort((a, b) => a.dist - b.dist);

    if (candidates.length === 0) {
      setDuplicateResult(null);
      return;
    }

    // Pick closest candidate in same or similar category, or closest overall
    const catMatch = candidates.find(
      (c) =>
        c.report.categoryLabel.toLowerCase().includes(activeCatName.toLowerCase().slice(0, 4)) ||
        activeCatName.toLowerCase().includes(c.report.category.toLowerCase().slice(0, 4)),
    );
    const bestCandidate = catMatch || candidates[0];

    if (!bestCandidate) {
      setDuplicateResult(null);
      return;
    }

    const { report: candidateReport, dist } = bestCandidate;

    try {
      const dupRes = await fetch("/api/ai/duplicate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDescription: textToAnalyze,
          existingReport: {
            id: candidateReport.id,
            title: candidateReport.title,
            description: candidateReport.description,
            area: candidateReport.area || candidateReport.ward,
            category: candidateReport.categoryLabel,
          },
        }),
      });

      if (dupRes.ok) {
        const dupData = await dupRes.json();
        // Check if similarity is high or close location with identical keywords
        if (dupData.is_duplicate || dupData.similarity_score >= 60 || dist <= 80) {
          setDuplicateResult({
            is_duplicate: true,
            similarity_score: Math.max(dupData.similarity_score || 75, dist <= 50 ? 92 : 75),
            explanation:
              dupData.explanation ||
              `A complaint regarding this issue was already registered at this exact spot (${dist} meters away).`,
            recommended_action: "add_info_to_existing",
            existingReport: candidateReport,
            distanceMeters: dist,
          });

          // Check if current user already upvoted
          const currentUser = "bipinyadav";
          const already = candidateReport.upvotedBy?.includes(currentUser);
          setHasUpvoted(Boolean(already));
        } else {
          setDuplicateResult(null);
        }
      }
    } catch (err) {
      console.warn("Duplicate check error:", err);
      // Fallback local heuristic
      if (dist <= 150) {
        setDuplicateResult({
          is_duplicate: true,
          similarity_score: 85,
          explanation: `A similar complaint already exists within ${dist}m at ${candidateReport.area || "this location"}.`,
          recommended_action: "add_info_to_existing",
          existingReport: candidateReport,
          distanceMeters: dist,
        });
      } else {
        setDuplicateResult(null);
      }
    }
  };

  // Upvote Existing Duplicate Complaint Handler
  const handleUpvoteExisting = async (existingId: string) => {
    if (hasUpvoted || upvoting) return;
    setUpvoting(true);
    setUpvoteSuccessMessage(null);
    try {
      const res = await fetch("/api/reports/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: existingId,
          userIdentifier: "bipinyadav",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.alreadyUpvoted) {
          setHasUpvoted(true);
          setUpvoteSuccessMessage("You have already upvoted this complaint!");
        } else {
          setHasUpvoted(true);
          setUpvoteSuccessMessage(`Upvoted! Total support: ${data.upvotes} citizens.`);
          // Update the candidate report in state immediately
          if (duplicateResult && duplicateResult.existingReport) {
            setDuplicateResult({
              ...duplicateResult,
              existingReport: {
                ...duplicateResult.existingReport,
                upvotes: data.upvotes,
              },
            });
          }
          // Update local storage and dispatch event so map & dashboard reflect instantly
          try {
            const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
            const idx = stored.findIndex((r: any) => r.id === existingId);
            if (idx >= 0) {
              stored[idx].upvotes = data.upvotes;
              localStorage.setItem("civicpulse_client_reports", JSON.stringify(stored));
            }
            window.dispatchEvent(new Event("storage"));
          } catch {}
        }
      }
    } catch (err) {
      console.error("Upvote failed:", err);
    } finally {
      setUpvoting(false);
    }
  };

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const compressImage = (file: File, maxDim = 1024, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", quality));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  // Real Photo Upload Handler with Automatic Compression to persistent Data URLs
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const dataUrl = await compressImage(file, 1024, 0.75);
        const newItem: MediaItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: "image",
          url: dataUrl || URL.createObjectURL(file),
          name: file.name,
          size: formatFileSize(file.size),
          timestamp: new Date().toLocaleTimeString(),
        };
        setMediaItems((prev) => [...prev, newItem]);
      } catch {
        const url = URL.createObjectURL(file);
        const newItem: MediaItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: "image",
          url,
          name: file.name,
          size: formatFileSize(file.size),
          timestamp: new Date().toLocaleTimeString(),
        };
        setMediaItems((prev) => [...prev, newItem]);
      }
    }

    e.target.value = "";
  };

  // Real Video Upload Handler
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const newItem: MediaItem = {
        id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: "video",
        url,
        name: file.name,
        size: formatFileSize(file.size),
        timestamp: new Date().toLocaleTimeString(),
      };
      setMediaItems((prev) => [...prev, newItem]);
    });

    e.target.value = "";
  };

  // Real Camera Viewfinder Controller
  const startCamera = async () => {
    setShowCameraModal(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamTrackRef.current = stream;
      if (videoStreamRef.current) {
        videoStreamRef.current.srcObject = stream;
        videoStreamRef.current.play();
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setCameraError(
        `Camera permission denied or camera unavailable: ${err.message}. You can also use "Upload Photo" directly.`,
      );
    }
  };

  const stopCamera = () => {
    if (streamTrackRef.current) {
      streamTrackRef.current.getTracks().forEach((track) => track.stop());
      streamTrackRef.current = null;
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoStreamRef.current) return;
    const video = videoStreamRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const newItem: MediaItem = {
        id: `camera-snap-${Date.now()}`,
        type: "image",
        url: dataUrl,
        name: `camera_capture_${new Date().toISOString().slice(11, 19).replace(/:/g, "-")}.jpg`,
        size: "High Res Snapshot",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMediaItems((prev) => [...prev, newItem]);
    }
    stopCamera();
  };

  // Remove uploaded media
  const removeMedia = (id: string) => {
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
  };

  // Voice Recognition setup (Web Speech API)
  const toggleListening = () => {
    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "Speech recognition is not supported in this browser. Please type your description.",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onstart = () => setListening(true);
      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e);
        setListening(false);
      };
      recognition.onend = () => setListening(false);

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setError(`Microphone error: ${err.message}`);
      setListening(false);
    }
  };

  // Trigger Live AI Analysis via backend API (Groq Qwen Engine)
  const runAiAnalysis = async (textToAnalyze: string, explicitCategory?: string) => {
    const activeCategory = explicitCategory || category;
    if (!textToAnalyze || textToAnalyze.trim().length < 5) return;
    setAiLoading(true);
    setAiNotice("⚡ Groq Qwen AI analyzing description...");
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: textToAnalyze,
          categoryName: activeCategory,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
        setAiNotice(`✓ Groq AI Analysis updated (${data.source || "Groq Qwen"})`);
        setTimeout(() => setAiNotice(null), 4000);

        // Run location-aware duplicate detection
        await checkForDuplicatesAtLocation(textToAnalyze, locationData, activeCategory);
      }
    } catch (err: any) {
      console.warn("AI analysis network fallback:", err);
      setAiNotice("Analyzed with fallback engine");
      await checkForDuplicatesAtLocation(textToAnalyze, locationData, activeCategory);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const isPotholeText =
      description.toLowerCase().includes("pothole") || description.toLowerCase().includes("road");
    const isLightCat =
      newCat.toLowerCase().includes("light") || newCat.toLowerCase().includes("electr");
    if (!description || (isLightCat && isPotholeText)) {
      const defaultTpl =
        CATEGORY_TEMPLATES[newCat]?.[0]?.text ||
        "Six streetlights between the school gate and the water tank have been unlit for four nights. The entire stretch is dark.";
      setDescription(defaultTpl);
      runAiAnalysis(defaultTpl, newCat);
    } else {
      runAiAnalysis(description, newCat);
    }
  };

  // Run initial AI analysis on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      runAiAnalysis(description, category);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const defaultText =
    category.toLowerCase().includes("light") || category.toLowerCase().includes("electric")
      ? "Six streetlights unlit for four nights causing dark stretch and safety hazard"
      : `${category} issue requiring municipal inspection`;
  const fallbackAi = mockClassify(description || defaultText);
  const activeAi: AiAnalysisResult = {
    summary:
      aiAnalysis?.summary ||
      (category.toLowerCase().includes("light") || category.toLowerCase().includes("electric")
        ? "Streetlight outage causing total darkness and safety hazard along the roadway."
        : fallbackAi.summary),
    keywords: aiAnalysis?.keywords?.length ? aiAnalysis.keywords : fallbackAi.keywords,
    severity_signals: aiAnalysis?.severity_signals?.length
      ? aiAnalysis.severity_signals
      : category.toLowerCase().includes("light") || category.toLowerCase().includes("electric")
        ? ["poor night visibility", "pedestrian safety hazard", "dark street"]
        : ["safety hazard", "infrastructure concern"],
    priority_recommendation: aiAnalysis?.priority_recommendation || fallbackAi.priority,
    priority_reason: aiAnalysis?.priority_reason || fallbackAi.reason,
    confidence: aiAnalysis?.confidence || fallbackAi.confidence,
    category_mismatch: aiAnalysis?.category_mismatch,
    detected_category: aiAnalysis?.detected_category,
    suggested_description: aiAnalysis?.suggested_description,
    source: aiAnalysis?.source || "Groq Qwen AI Engine",
  };

  function next() {
    setError(null);
    if (step === 0 && mediaItems.length === 0) {
      setError(
        "Please upload at least one real photo, video or take a camera capture so staff can verify the issue.",
      );
      return;
    }
    if (step === 1 && !locationData.address) {
      setError("Please confirm your location on the map.");
      return;
    }
    if (step === 2 && description.trim().length < 5 && mediaItems.length === 0) {
      setError("Add a short description (at least 5 characters) or attach a photo.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const generatedId = `CIV-${Math.floor(10000 + Math.random() * 90000)}`;

    const catObj =
      CATEGORIES.find(
        (c) =>
          c.name.toLowerCase() === category.toLowerCase() ||
          c.id === category ||
          c.name === category,
      ) ||
      (activeAi.category ? CATEGORIES.find((c) => c.id === activeAi.category) : null) ||
      CATEGORIES[1]!;

    const reportTitle =
      activeAi.summary && !activeAi.summary.toLowerCase().includes("pothole")
        ? activeAi.summary
        : description.trim().length > 0
          ? description.trim().slice(0, 80)
          : `${catObj.name} issue reported on ${locationData.address.split(",")[0] || "Racecourse Road"}`;

    const newReport: CivicReport = {
      id: generatedId,
      title: reportTitle,
      category: catObj.id,
      categoryLabel: catObj.name,
      description:
        description.trim() || `${catObj.name} issue reported with verified photo evidence.`,
      ward: locationData.ward || "Rangoli Halla",
      area: locationData.address.split(",")[0] || "Racecourse Road",
      status: "submitted",
      priority: activeAi.priority_recommendation || "critical",
      department: catObj.department,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiConfidence: activeAi.confidence || 0.95,
      duplicateProbability: duplicateResult?.is_duplicate
        ? duplicateResult.similarity_score / 100
        : 0.05,
      upvotes: 1,
      anonymous,
      x: 42,
      y: 50,
      mediaUrls:
        mediaItems.length > 0
          ? mediaItems.map((m) => m.url)
          : [
              catObj.id === "electricity"
                ? "/media/evidence/streetlight_before.jpg"
                : "/media/evidence/pothole_before.jpg",
            ],
      latitude: locationData.lat,
      longitude: locationData.lng,
      address: locationData.address,
    };

    // Save locally to persist permanently across browser and admin sessions
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const purged = stored.filter(
          (r: any) =>
            !r.id.startsWith("CIV-104") &&
            r.id !== "CIV-54728" &&
            r.id !== "CIV-42603" &&
            r.id !== newReport.id,
        );
        purged.unshift(newReport);
        localStorage.setItem("civicpulse_client_reports", JSON.stringify(purged));
        window.dispatchEvent(new CustomEvent("civicpulse_report_created", { detail: newReport }));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.warn("Local storage save notice:", e);
      }
    }

    try {
      const res = await fetch("/api/status/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: newReport }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmittedReport(data.report || newReport);
      } else {
        setSubmittedReport(newReport);
      }
    } catch {
      setSubmittedReport(newReport);
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedReport) {
    return (
      <SiteLayout>
        <Section align="center" title="Report submitted">
          <div className="surface-card mx-auto max-w-lg p-8 text-center shadow-lg">
            <span
              aria-hidden="true"
              className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success/15 text-2xl text-success animate-rise-in font-bold"
            >
              ✓
            </span>
            <h2 className="mt-5 font-display text-2xl font-extrabold">
              Report Successfully Submitted
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your tracking ID is{" "}
              <strong className="text-foreground font-mono text-base bg-muted px-2 py-0.5 rounded">
                {submittedReport.id}
              </strong>
              .
            </p>

            <div className="mt-4 rounded-xl bg-mint/40 border border-mint p-4 text-left text-sm text-mint-foreground">
              <p className="font-bold flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-success animate-pulse" />
                Status: SUBMITTED (Stage 1 of 8)
              </p>
              <p className="mt-1 text-xs opacity-90">
                Location: <strong>{locationData.address}</strong> ({locationData.lat.toFixed(5)}°,{" "}
                {locationData.lng.toFixed(5)}°)
              </p>
            </div>

            {/* Uploaded Media Previews */}
            {mediaItems.length > 0 && (
              <div className="mt-4 text-left">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Verified Real Media Attached:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((m) => (
                    <div
                      key={m.id}
                      className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10"
                    >
                      {m.type === "image" ? (
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <video src={m.url} className="w-full h-full object-cover" controls />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/reports/$id"
                params={{ id: submittedReport.id }}
                className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                Track Live Status
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex min-h-12 items-center rounded-2xl border border-border px-6 text-sm font-bold hover:bg-accent"
              >
                Citizen Dashboard
              </Link>
            </div>
          </div>
        </Section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <Section align="left" eyebrow="New Report" title="Report a Civic Issue">
        <ol className="mb-8 flex flex-wrap gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold " +
                (i === step
                  ? "border-primary bg-primary/10 text-primary"
                  : i < step
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border text-muted-foreground")
              }
            >
              <span aria-hidden="true">{i < step ? "✓" : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="surface-card p-6">
            {/* STEP 0: REAL PHOTO / CAMERA / VIDEO UPLOAD */}
            {step === 0 && (
              <div>
                <h2 className="text-lg font-bold">1. Add Real Photo or Video Evidence</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload actual photos from your gallery, capture live with camera, or upload a
                  video.
                </p>

                {/* Hidden File Inputs for Real File Selection */}
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoUpload}
                  accept="video/*"
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={mobileCameraInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {/* Live Camera Button */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="min-h-24 flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/50 bg-primary/5 text-sm font-semibold hover:border-primary hover:bg-primary/10 transition group"
                  >
                    <span className="text-2xl mb-1 group-hover:scale-110 transition">📷</span>
                    <span className="font-bold text-primary">Use Live Camera</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Capture real live snapshot
                    </span>
                  </button>

                  {/* Real Photo Upload Button */}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="min-h-24 flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-background text-sm font-semibold hover:border-primary/50 hover:bg-accent transition group"
                  >
                    <span className="text-2xl mb-1 group-hover:scale-110 transition">🖼️</span>
                    <span className="font-bold">Upload Photos</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      JPEG, PNG, WEBP
                    </span>
                  </button>

                  {/* Real Video Upload Button */}
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="min-h-24 flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-background text-sm font-semibold hover:border-primary/50 hover:bg-accent transition group"
                  >
                    <span className="text-2xl mb-1 group-hover:scale-110 transition">🎥</span>
                    <span className="font-bold">Upload Video</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">MP4, MOV, WEBM</span>
                  </button>
                </div>

                {/* Real Media Preview Gallery */}
                {mediaItems.length > 0 ? (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Attached Files ({mediaItems.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setMediaItems([])}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove All
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {mediaItems.map((m) => (
                        <div
                          key={m.id}
                          className="group relative rounded-xl border border-border overflow-hidden bg-surface shadow-sm hover:shadow transition"
                        >
                          <div className="aspect-square bg-black/10 overflow-hidden relative">
                            {m.type === "image" ? (
                              <img
                                src={m.url}
                                alt={m.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                            ) : (
                              <video src={m.url} className="w-full h-full object-cover" controls />
                            )}
                            <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur">
                              {m.type === "image" ? "Photo" : "Video"}
                            </span>
                          </div>

                          <div className="p-2 text-xs">
                            <p className="font-semibold truncate text-foreground">{m.name}</p>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                              <span>{m.size}</span>
                              <button
                                type="button"
                                onClick={() => removeMedia(m.id)}
                                className="text-destructive font-bold hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                    No files attached yet. Click above to take a photo with your camera or select
                    pictures from your phone/computer.
                  </div>
                )}
              </div>
            )}

            {/* STEP 1: REAL WORLD MAP (LEAFLET / OPENSTREETMAP) */}
            {step === 1 && (
              <div>
                <h2 className="text-lg font-bold">2. Pinpoint Incident on World Map</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the real interactive map to place the issue. Click anywhere, drag the marker,
                  or auto-detect with GPS.
                </p>

                <div className="mt-4">
                  <RealMap
                    initialLat={locationData.lat}
                    initialLng={locationData.lng}
                    onLocationChange={(loc) => {
                      setLocationData(loc);
                      // Trigger duplicate recheck when location changes
                      if (description && description.trim().length >= 5) {
                        checkForDuplicatesAtLocation(description, loc, category);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: DESCRIBE ISSUE (VOICE & TEXT) */}
            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold">3. Describe the Issue (Text or Voice)</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">
                      Category (Standard dropdown)
                    </span>
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Language</span>
                    <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                      {LANGUAGES.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Quick Templates for Category */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">
                    Quick templates:
                  </span>
                  {(
                    CATEGORY_TEMPLATES[category] ??
                    CATEGORY_TEMPLATES["Streetlight & electricity"] ??
                    []
                  ).map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setDescription(tpl.text);
                        runAiAnalysis(tpl.text, category);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-primary hover:text-primary-foreground hover:border-primary text-xs font-semibold transition shadow-sm"
                      title="Click to insert this realistic issue description"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                {/* Category Mismatch Detected Banner */}
                {activeAi.category_mismatch && (
                  <div className="mt-4 rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-4 text-xs shadow-sm animate-fade-in">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">
                            Groq AI Mismatch Detected
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-foreground font-bold text-[10px]">
                            Qwen AI
                          </span>
                        </div>
                        <p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">
                          You selected category{" "}
                          <strong className="text-foreground">"{category}"</strong>, but your
                          description describes{" "}
                          <strong className="text-foreground">
                            "{activeAi.detected_category || "Road damage"}"
                          </strong>
                          .
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const repl =
                                activeAi.suggested_description ||
                                CATEGORY_TEMPLATES[category]?.[0]?.text ||
                                "Six streetlights between the school gate and water tank have been unlit for four nights. The stretch is dark and hazardous.";
                              setDescription(repl);
                              runAiAnalysis(repl, category);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition shadow-sm text-xs"
                          >
                            ✨ Replace with {category} Description
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const targetCat = activeAi.detected_category || "Road damage";
                              const matched = CATEGORIES.find(
                                (c) =>
                                  c.name.toLowerCase().includes(targetCat.toLowerCase()) ||
                                  targetCat.toLowerCase().includes(c.id),
                              );
                              const newCatName = matched ? matched.name : targetCat;
                              setCategory(newCatName);
                              runAiAnalysis(description, newCatName);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-border bg-background font-bold hover:bg-accent transition text-xs"
                          >
                            🔄 Switch Category to {activeAi.detected_category || "Road damage"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <label className="mt-4 block">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Description</span>
                      {aiNotice && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal/15 text-teal animate-pulse">
                          {aiNotice}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => runAiAnalysis(description, category)}
                      disabled={aiLoading}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition"
                      title="Re-analyze description with Groq Qwen AI"
                    >
                      <span className={aiLoading ? "animate-spin" : ""}>⚡</span>
                      {aiLoading ? "AI Analyzing with Groq…" : "Re-analyze with Groq"}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => runAiAnalysis(description, category)}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none leading-relaxed"
                    placeholder="Tell us what needs attention, hazard signals, and landmarks."
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
                      listening
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "border border-border hover:bg-accent"
                    }`}
                  >
                    <span aria-hidden="true">{listening ? "🔴" : "🎙"}</span>
                    {listening ? "Recording… Click to finish" : "Record voice note"}
                  </button>

                  <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="size-4 rounded accent-primary"
                    />
                    Report anonymously
                  </label>
                </div>

                {/* Duplicate Analysis Alert & Upvote Action */}
                {duplicateResult &&
                  duplicateResult.is_duplicate &&
                  duplicateResult.existingReport && (
                    <div className="mt-5 rounded-2xl border-2 border-warning/60 bg-warning/10 p-4 text-sm animate-in fade-in duration-200">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl select-none">⚠️</span>
                        <div className="flex-1 space-y-2">
                          <div>
                            <p className="font-extrabold text-base text-warning-foreground">
                              This complaint has already been reported!
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              A similar grievance was identified at this location (
                              {duplicateResult.distanceMeters ?? "near"}m away,{" "}
                              {duplicateResult.similarity_score}% match).
                            </p>
                          </div>

                          {/* Existing Complaint Details Card */}
                          <div className="rounded-xl border border-warning/30 bg-background/95 p-3.5 shadow-sm space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-warning/20 text-warning-foreground">
                                  {duplicateResult.existingReport.id}
                                </span>
                                <h4 className="font-bold text-foreground text-sm mt-1">
                                  {duplicateResult.existingReport.title}
                                </h4>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[11px] font-semibold text-muted-foreground block">
                                  {duplicateResult.existingReport.area ||
                                    duplicateResult.existingReport.ward}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-0.5">
                                  👍 {duplicateResult.existingReport.upvotes || 1} upvotes
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {duplicateResult.existingReport.description}
                            </p>

                            {duplicateResult.existingReport.mediaUrls &&
                              duplicateResult.existingReport.mediaUrls.length > 0 && (
                                <div className="flex items-center gap-2 pt-1">
                                  <img
                                    src={duplicateResult.existingReport.mediaUrls[0]}
                                    alt="Existing report proof"
                                    className="size-12 rounded-lg object-cover border border-border"
                                  />
                                  <span className="text-[11px] text-muted-foreground">
                                    Previously attached photo evidence on site.
                                  </span>
                                </div>
                              )}

                            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/50">
                              <strong>AI Analysis:</strong> {duplicateResult.explanation}
                            </div>
                          </div>

                          {/* Feedback message for Upvoting */}
                          {upvoteSuccessMessage && (
                            <div className="p-2.5 rounded-xl bg-success/15 border border-success/30 text-xs font-bold text-success flex items-center gap-1.5 animate-in fade-in">
                              <span>✓</span>
                              <span>{upvoteSuccessMessage}</span>
                            </div>
                          )}

                          {/* User Actions: Upvote Existing vs Submit New */}
                          <div className="pt-1 flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpvoteExisting(duplicateResult.existingReport!.id)
                              }
                              disabled={hasUpvoted || upvoting}
                              className={`min-h-10 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition active:scale-95 ${
                                hasUpvoted
                                  ? "bg-success text-success-foreground cursor-default"
                                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                              }`}
                            >
                              <span>👍</span>
                              <span>
                                {upvoting
                                  ? "Registering Upvote…"
                                  : hasUpvoted
                                    ? `Upvoted (${duplicateResult.existingReport.upvotes || 1})`
                                    : `Upvote Complaint (${duplicateResult.existingReport.upvotes || 1})`}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAction("new");
                                setDuplicateResult(null);
                              }}
                              className="min-h-10 px-3.5 rounded-xl text-xs font-semibold border border-input bg-background hover:bg-muted transition"
                            >
                              Submit as different new issue
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* STEP 3: REVIEW & SUBMIT */}
            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold">4. Review and Submit</h2>

                {/* Media Preview in Review */}
                {mediaItems.length > 0 && (
                  <div className="mt-4 mb-4">
                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-2">
                      Verified Real Media ({mediaItems.length})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {mediaItems.map((m) => (
                        <div
                          key={m.id}
                          className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10"
                        >
                          {m.type === "image" ? (
                            <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <video src={m.url} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    [
                      "Verified Location",
                      `${locationData.address} (${locationData.lat.toFixed(5)}° N, ${locationData.lng.toFixed(5)}° E)`,
                    ],
                    ["Selected Category", category],
                    ["AI Issue Summary", activeAi.summary],
                    [
                      "Recommended Priority",
                      `${activeAi.priority_recommendation.toUpperCase()} — ${activeAi.priority_reason}`,
                    ],
                    ["Handling Department", "Public Works — Roads"],
                    [
                      "Citizen Visibility",
                      anonymous ? "Anonymous (Identity Protected)" : "Verified Citizen",
                    ],
                    [
                      "Duplicate Policy",
                      selectedAction === "merge"
                        ? "Merge with existing CIV-10482"
                        : "Submit as distinct report",
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-border p-3 bg-muted/20">
                      <dt className="text-xs font-bold text-muted-foreground uppercase">{k}</dt>
                      <dd className="mt-1 font-semibold text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="min-h-12 rounded-2xl border border-border px-5 text-sm font-bold hover:bg-accent"
                >
                  Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="min-h-12 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="min-h-12 rounded-2xl bg-warm px-6 text-sm font-bold text-warm-foreground shadow hover:bg-warm/90 disabled:opacity-70"
                >
                  {submitting ? "Submitting to Supabase Queue…" : "Confirm & Submit Report"}
                </button>
              )}
            </div>
          </div>

          {/* AI Decision Support Panel */}
          <aside className="surface-card h-fit bg-navy p-6 text-navy-foreground shadow-lg rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-teal">
                  Groq AI Advisory Layer
                </p>
                <span className="px-1.5 py-0.5 rounded bg-teal/20 text-teal text-[10px] font-bold">
                  Qwen 27B
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-teal animate-pulse" />
                <span className="text-[10px] text-teal font-semibold">Live AI</span>
              </div>
            </div>

            <h3 className="mt-3 text-base font-bold">
              {category} · {Math.round(activeAi.confidence * 100)}% Confidence
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              {activeAi.category_mismatch && (
                <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 p-3 text-[11px] text-amber-200">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    <span>⚠️</span> Category Mismatch Detected
                  </span>
                  <p className="mt-1 opacity-90 leading-tight">
                    Issue text appears to describe <strong>{activeAi.detected_category}</strong>{" "}
                    rather than {category}.
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-navy-foreground/10 p-3">
                <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">
                  AI Issue Summary
                </span>
                <p className="mt-1 text-white font-medium">{activeAi.summary}</p>
              </div>

              <div className="rounded-xl bg-navy-foreground/10 p-3">
                <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">
                  Priority Recommendation
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded font-bold uppercase bg-warm text-warm-foreground text-[10px]">
                    {activeAi.priority_recommendation}
                  </span>
                  <span className="text-white/80">{activeAi.priority_reason}</span>
                </div>
              </div>

              {activeAi.severity_signals && activeAi.severity_signals.length > 0 && (
                <div className="rounded-xl bg-navy-foreground/10 p-3">
                  <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">
                    Detected Severity Signals
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {activeAi.severity_signals.map((sig) => (
                      <span
                        key={sig}
                        className="px-2 py-0.5 rounded-full bg-navy-foreground/15 text-white text-[10px]"
                      >
                        ⚠️ {sig}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-navy-foreground/10 p-3">
                <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">
                  Extracted Keywords
                </span>
                <p className="mt-1 text-white/80">{activeAi.keywords.join(", ")}</p>
              </div>
            </div>

            <p className="mt-4 text-[11px] opacity-75 border-t border-navy-foreground/15 pt-3">
              <strong>Architecture Note:</strong> AI predictions are advisory suggestions. The
              municipal department, priority, and workflow decisions are finalized by staff.
            </p>
          </aside>
        </div>

        {/* Live Camera Viewfinder Modal */}
        {showCameraModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="surface-card max-w-lg w-full p-6 shadow-2xl rounded-2xl animate-rise-in">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>📷</span> Live Camera Viewfinder
                </h3>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="size-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-accent text-xs"
                >
                  ✕
                </button>
              </div>

              {cameraError ? (
                <div className="mt-4 p-4 rounded-xl bg-destructive/10 text-destructive text-xs space-y-3">
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      mobileCameraInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                  >
                    Open Native Camera / File Chooser
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-border">
                    <video
                      ref={videoStreamRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="text-white/60 text-xs font-semibold">
                        Center issue in frame
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg hover:scale-105 transition flex items-center gap-2"
                    >
                      <span className="size-4 rounded-full bg-white"></span>
                      Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-3 rounded-full border border-border text-sm font-semibold hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>
    </SiteLayout>
  );
}
