"use client";

import { ChevronRight, Layers3, LocateFixed, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { EventCategory, IntelligenceEvent } from "@/packages/shared/types";

type MapFilters = {
  category: "all" | EventCategory;
  severity: number;
  confidence: number;
  watchlistOnly: boolean;
};

function toFeatureCollection(events: IntelligenceEvent[]) {
  return {
    type: "FeatureCollection" as const,
    features: events
      .filter((event) => event.latitude !== undefined && event.longitude !== undefined)
      .map((event) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [event.longitude as number, event.latitude as number],
        },
        properties: {
          slug: event.slug,
          title: event.title,
          severity: event.severity,
          confidence: event.automatedConfidence,
          status: event.status,
          category: event.category,
        },
      })),
  };
}

export function OperationsMap({ events }: { events: IntelligenceEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [filters, setFilters] = useState<MapFilters>({
    category: "all",
    severity: 1,
    confidence: 0,
    watchlistOnly: false,
  });

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          (filters.category === "all" || event.category === filters.category) &&
          event.severity >= filters.severity &&
          event.automatedConfidence >= filters.confidence &&
          (!filters.watchlistOnly || event.watchlistIds.length > 0),
      ),
    [events, filters],
  );

  const selectedEvent = selectedSlug
    ? events.find((event) => event.slug === selectedSlug) ?? null
    : null;

  useEffect(() => {
    let disposed = false;
    if (!containerRef.current || mapRef.current) return;

    void import("maplibre-gl")
      .then((module) => {
        if (disposed || !containerRef.current) return;
        const map = new module.Map({
          container: containerRef.current,
          center: [12, 18],
          zoom: 1.35,
          minZoom: 1,
          maxZoom: 8,
          attributionControl: false,
          style: {
            version: 8,
            sources: {
              basemap: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [
              {
                id: "basemap",
                type: "raster",
                source: "basemap",
                paint: {
                  "raster-saturation": -0.9,
                  "raster-contrast": 0.28,
                  "raster-brightness-min": 0.04,
                  "raster-brightness-max": 0.3,
                  "raster-opacity": 0.74,
                },
              },
            ],
          },
        });

        map.addControl(new module.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new module.AttributionControl({ compact: true }), "bottom-right");
        mapRef.current = map;

        map.on("load", () => {
          if (disposed) return;
          map.addSource("argus-events", {
            type: "geojson",
            data: toFeatureCollection(filteredEvents),
            cluster: true,
            clusterMaxZoom: 6,
            clusterRadius: 42,
          });
          map.addLayer({
            id: "event-cluster-halo",
            type: "circle",
            source: "argus-events",
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": ["step", ["get", "point_count"], 19, 8, 24, 18, 31],
              "circle-color": "rgba(76, 201, 232, 0.11)",
              "circle-stroke-color": "rgba(76, 201, 232, 0.42)",
              "circle-stroke-width": 1,
            },
          });
          map.addLayer({
            id: "event-cluster-core",
            type: "circle",
            source: "argus-events",
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": ["step", ["get", "point_count"], 11, 8, 14, 18, 17],
              "circle-color": "#123848",
              "circle-stroke-color": "#68d9ee",
              "circle-stroke-width": 1,
            },
          });
          map.addLayer({
            id: "event-cluster-count",
            type: "symbol",
            source: "argus-events",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 10,
            },
            paint: { "text-color": "#d8f7fb" },
          });
          map.addLayer({
            id: "event-points-halo",
            type: "circle",
            source: "argus-events",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": ["step", ["get", "severity"], 7, 4, 10, 5, 13],
              "circle-color": [
                "match",
                ["get", "severity"],
                5,
                "rgba(239, 98, 98, 0.15)",
                4,
                "rgba(229, 168, 61, 0.14)",
                "rgba(76, 201, 232, 0.12)",
              ],
              "circle-stroke-width": 0,
            },
          });
          map.addLayer({
            id: "event-points",
            type: "circle",
            source: "argus-events",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": ["step", ["get", "severity"], 3.5, 4, 5, 5, 6],
              "circle-color": [
                "match",
                ["get", "severity"],
                5,
                "#ef6262",
                4,
                "#e5a83d",
                3,
                "#63c6d9",
                "#58d39b",
              ],
              "circle-stroke-color": "#d8f7fb",
              "circle-stroke-width": 0.7,
            },
          });

          map.on("click", "event-cluster-core", async (event) => {
            const feature = map.queryRenderedFeatures(event.point, { layers: ["event-cluster-core"] })[0];
            const clusterId = feature?.properties?.cluster_id as number | undefined;
            if (clusterId === undefined) return;
            const source = map.getSource("argus-events") as GeoJSONSource;
            const zoom = await source.getClusterExpansionZoom(clusterId);
            const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coordinates, zoom, duration: 620 });
          });
          map.on("click", "event-points", (event) => {
            const feature = event.features?.[0];
            const slug = feature?.properties?.slug as string | undefined;
            if (slug) setSelectedSlug(slug);
          });
          map.on("mouseenter", "event-points", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "event-points", () => { map.getCanvas().style.cursor = ""; });
          map.on("mouseenter", "event-cluster-core", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "event-cluster-core", () => { map.getCanvas().style.cursor = ""; });
          setMapReady(true);
        });
      })
      .catch(() => setMapFailed(true));

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Map construction must happen once; source updates are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const source = map.getSource("argus-events") as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(filteredEvents));
  }, [filteredEvents, mapReady]);

  function locateHighestPriority() {
    const event = [...filteredEvents].sort(
      (left, right) => right.severity - left.severity || right.automatedConfidence - left.automatedConfidence,
    )[0];
    if (!event || event.longitude === undefined || event.latitude === undefined) return;
    setSelectedSlug(event.slug);
    mapRef.current?.flyTo({ center: [event.longitude, event.latitude], zoom: 4.2, duration: 900 });
  }

  return (
    <div className="operations-map" aria-label="Interactive global event map">
      <div ref={containerRef} className="operations-map-canvas" />
      {mapFailed ? (
        <div className="empty-state">
          <div>
            <Layers3 size={26} />
            <h3>Base map unavailable</h3>
            <p>Event intelligence remains available in priority panels and the Events workspace.</p>
          </div>
        </div>
      ) : null}
      <div className="map-overlay-top">
        <div className="map-filter-row">
          <select
            className="map-filter"
            value={filters.category}
            aria-label="Filter map by category"
            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as MapFilters["category"] }))}
          >
            <option value="all">All categories</option>
            <option value="conflict">Conflict</option>
            <option value="cyber">Cyber</option>
            <option value="disaster">Disaster</option>
            <option value="maritime">Maritime</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="economic">Economic</option>
            <option value="environment">Environment</option>
          </select>
          <select
            className="map-filter"
            value={filters.severity}
            aria-label="Filter map by minimum severity"
            onChange={(event) => setFilters((current) => ({ ...current, severity: Number(event.target.value) }))}
          >
            <option value="1">Severity 1+</option>
            <option value="3">Severity 3+</option>
            <option value="4">Severity 4+</option>
            <option value="5">Critical only</option>
          </select>
          <select
            className="map-filter"
            value={filters.confidence}
            aria-label="Filter map by automated confidence"
            onChange={(event) => setFilters((current) => ({ ...current, confidence: Number(event.target.value) }))}
          >
            <option value="0">Any confidence</option>
            <option value="50">50%+ confidence</option>
            <option value="70">70%+ confidence</option>
            <option value="90">90%+ confidence</option>
          </select>
          <button
            className={`map-filter ${filters.watchlistOnly ? "badge-cyan" : ""}`}
            type="button"
            aria-pressed={filters.watchlistOnly}
            onClick={() => setFilters((current) => ({ ...current, watchlistOnly: !current.watchlistOnly }))}
          >
            Watchlist
          </button>
          <button className="map-filter" type="button" onClick={locateHighestPriority}>
            <LocateFixed size={12} /> Focus priority
          </button>
        </div>
        <div className="map-live-indicator">
          <span className="status-dot online" /> {filteredEvents.length} signals in view
        </div>
      </div>

      <div className="map-legend" aria-label="Map severity legend">
        <span><i className="legend-dot critical" /> Critical</span>
        <span><i className="legend-dot developing" /> Developing</span>
        <span><i className="legend-dot stable" /> Stable</span>
        <span><ShieldCheck size={10} /> Ring size indicates density</span>
      </div>

      {selectedEvent ? (
        <aside className="map-event-drawer" aria-label="Selected event preview">
          <button className="icon-button" type="button" aria-label="Close event preview" onClick={() => setSelectedSlug(null)}>
            <X size={15} />
          </button>
          <div className="map-drawer-meta">
            <span className={`severity severity-${selectedEvent.severity}`}>S{selectedEvent.severity}</span>
            <span className="badge badge-cyan">{selectedEvent.category}</span>
            <span className="badge">{selectedEvent.status}</span>
          </div>
          <h3>{selectedEvent.title}</h3>
          <p>{selectedEvent.summary}</p>
          <div className="map-drawer-meta">
            <span className="badge badge-cyan">{selectedEvent.automatedConfidence}% automated confidence</span>
            <span className="badge">{selectedEvent.supportingSourceCount} sources</span>
          </div>
          <Link className="button button-primary" href={`/events/${selectedEvent.slug}`} style={{ marginTop: 12 }}>
            Open dossier <ChevronRight size={14} />
          </Link>
        </aside>
      ) : null}
    </div>
  );
}
