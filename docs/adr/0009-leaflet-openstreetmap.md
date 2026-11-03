# ADR-0009: Leaflet with OpenStreetMap tiles and Nominatim geocoding

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

Reporting and exploration need real maps, GPS capture, address search and neighbourhood views without paid API keys.

## Decision

We use **Leaflet** (dynamically imported client-side) with **OpenStreetMap** tiles (plus a satellite layer in the society map) and **Nominatim** for reverse/forward geocoding. Distances between reports use the Haversine formula (`calculateDistanceMeters`).

## Consequences

- Free, no keys, good enough for a municipal pilot.
  − Nominatim and OSM tile servers have usage policies (low volume, attribution, caching); heavy production use needs a hosted provider.
  − User coordinates are sent to third parties (privacy).
  − Leaflet requires client-only loading (dynamic import) in an SSR app.

## Alternatives considered

- **Google Maps / Mapbox** — better quality, cost and keys.
- **Illustrated demo map** (original `x`/`y` percent coordinates) — retained only for demo data.
