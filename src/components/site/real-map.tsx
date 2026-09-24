import { useEffect, useRef, useState } from "react";

export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number | undefined;
  address: string;
  ward?: string | undefined;
  city?: string | undefined;
  postcode?: string | undefined;
}

interface RealMapProps {
  initialLat?: number;
  initialLng?: number;
  zoom?: number;
  onLocationChange?: (loc: LocationData) => void;
  className?: string;
}

export function RealMap({
  initialLat = 13.0072, // Default Hassan, Karnataka
  initialLng = 76.1023,
  zoom = 15,
  onLocationChange,
  className = "h-72 w-full rounded-2xl",
}: RealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });
  const [address, setAddress] = useState<string>("Locating address…");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Reverse Geocoding helper using OpenStreetMap Nominatim
  const reverseGeocode = async (lat: number, lng: number, accuracy?: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      if (res.ok) {
        const data = await res.json();
        const display = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.suburb || "";
        const ward = addr.suburb || addr.neighbourhood || addr.city_district || "Local Ward";
        const city = addr.city || addr.town || addr.village || addr.county || "Hassan";
        const postcode = addr.postcode || "";

        const summary = road ? `${road}, ${ward}, ${city}` : display;
        setAddress(summary);

        if (onLocationChange) {
          onLocationChange({
            lat,
            lng,
            accuracy,
            address: summary,
            ward,
            city,
            postcode,
          });
        }
      }
    } catch (err) {
      const fallback = `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;
      setAddress(fallback);
      if (onLocationChange) {
        onLocationChange({ lat, lng, address: fallback });
      }
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean existing instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Fix Leaflet marker icons in React/Vite
      const customIcon = L.divIcon({
        className: "custom-pin",
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 32px; height: 32px; background: rgba(20, 110, 245, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="background: #146ef5; color: white; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px; z-index: 10;">
              📍
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      });

      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom,
        zoomControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const marker = L.marker([currentCoords.lat, currentCoords.lng], {
        draggable: true,
        icon: customIcon,
      }).addTo(map);

      // Marker drag event
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setCurrentCoords({ lat: position.lat, lng: position.lng });
        reverseGeocode(position.lat, position.lng);
      });

      // Map click event
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCurrentCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      setMapLoaded(true);

      // Initial reverse geocode
      reverseGeocode(currentCoords.lat, currentCoords.lng);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Center on real device GPS
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17);
          markerRef.current.setLatLng([latitude, longitude]);
        }
        reverseGeocode(latitude, longitude, accuracy);
        setDetectingGps(false);
      },
      (err) => {
        console.warn("GPS detection error:", err.message);
        alert(`Location permission denied or unavailable: ${err.message}`);
        setDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Search Address / Landmark
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      if (res.ok) {
        const results = await res.json();
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          setCurrentCoords({ lat, lng });

          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 16);
            markerRef.current.setLatLng([lat, lng]);
          }
          reverseGeocode(lat, lng);
        } else {
          alert("Location not found. Try searching with city or landmark name.");
        }
      }
    } catch (err: any) {
      alert(`Search error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search & GPS Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={handleSearchAddress} className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any street, city or landmark (e.g. Bus Stand Road, Hassan)..."
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-input bg-surface"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleDetectGps}
          disabled={detectingGps}
          className="px-3 py-2 rounded-xl bg-teal text-teal-foreground text-xs font-bold shadow hover:bg-teal/90 transition flex items-center gap-1.5"
        >
          <span>🎯</span>
          {detectingGps ? "Detecting GPS…" : "Detect My Live GPS"}
        </button>
      </div>

      {/* Map Container */}
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-inner">
        <div ref={mapContainerRef} className={className} style={{ minHeight: "260px", zIndex: 1 }} />

        {/* Crosshair instruction overlay */}
        <div className="absolute bottom-2 left-2 z-10 bg-background/90 backdrop-blur px-3 py-1 rounded-lg border border-border shadow-sm text-[11px] font-medium text-muted-foreground pointer-events-none">
          Click anywhere or drag marker to set exact location
        </div>
      </div>

      {/* Current Address & Coordinates Display */}
      <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">
            Verified Address
          </span>
          <p className="font-semibold text-foreground text-sm">{address}</p>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">
            GPS Coordinates
          </span>
          <span className="font-mono text-xs font-bold text-primary">
            {currentCoords.lat.toFixed(6)}° N, {currentCoords.lng.toFixed(6)}° E
          </span>
        </div>
      </div>
    </div>
  );
}
