import { describe, expect, it } from "vitest";
import { GET as getOrbit } from "@/app/api/orbit/route";
import { POST as syncOrbit } from "@/app/api/admin/orbit/sync/route";
import {
  OrbitalSourceFormatError,
  parseCelestrakOmm,
  parseDonkiEvents,
  parseJplCloseApproaches,
  parseJplSentry,
} from "@/packages/orbital/parsers";
import {
  OrbitalSourceRequestError,
  WorkerOrbitalSourceTransport,
} from "@/packages/orbital/worker-source-transport";
import { readOrbitalSnapshot } from "@/packages/database/orbital-store";
import { FakeD1Database } from "./helpers/fake-d1";

const validOmm = {
  OBJECT_NAME: "TEST STATION",
  OBJECT_ID: "2026-001A",
  EPOCH: "2026-07-21T12:00:00.000Z",
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0004,
  INCLINATION: 51.6,
  RA_OF_ASC_NODE: 90,
  ARG_OF_PERICENTER: 45,
  MEAN_ANOMALY: 120,
  NORAD_CAT_ID: 99001,
  ELEMENT_SET_NO: 7,
  BSTAR: 0.00008,
  MEAN_MOTION_DOT: 0.00001,
  MEAN_MOTION_DDOT: 0,
  REV_AT_EPOCH: 123,
  OBJECT_TYPE: "PAYLOAD",
};

describe("orbital source normalization", () => {
  it("normalizes current CelesTrak OMM records without treating propagation as telemetry", () => {
    const parsed = parseCelestrakOmm([validOmm], new Date("2026-07-21T13:00:00.000Z"));
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      id: "celestrak:99001",
      orbitClass: "LEO",
      objectType: "payload",
      attentionState: "information",
      dataClassification: "public-information",
    });
    expect(parsed.records[0].attentionReason).toContain("propagated");
  });

  it("marks old element sets stale", () => {
    const parsed = parseCelestrakOmm(
      [{ ...validOmm, EPOCH: "2026-07-01T12:00:00.000Z" }],
      new Date("2026-07-21T13:00:00.000Z"),
    );
    expect(parsed.records[0].attentionState).toBe("stale");
  });

  it("maps JPL close-approach fields by name and enforces the documented signature", () => {
    const parsed = parseJplCloseApproaches({
      signature: { version: "1.5", source: "NASA/JPL SBDB Close Approach Data API" },
      fields: ["des", "orbit_id", "jd", "cd", "dist", "dist_min", "dist_max", "v_rel", "fullname", "h"],
      data: [["2026 AB", "12", "2461243.5", "2026-Jul-24 12:00", "0.01", "0.009", "0.011", "8.2", "(2026 AB)", "23.1"]],
    });
    expect(parsed.records[0]).toMatchObject({ designation: "2026 AB", orbitId: "12", nominalDistanceAu: 0.01 });
    expect(parsed.records[0].nominalDistanceLunar).toBeGreaterThan(3);

    expect(() => parseJplCloseApproaches({
      signature: { version: "1.4", source: "NASA/JPL SBDB Close Approach Data API" },
      fields: [],
      data: [],
    })).toThrow(OrbitalSourceFormatError);

    expect(() => parseJplCloseApproaches({
      signature: { version: "1.5", source: "NASA/JPL SBDB Close Approach Data API" },
      fields: ["des"],
      data: [],
    })).toThrow(/reviewed schema/i);
  });

  it("keeps ordinary Sentry listings at watch state rather than asserting an impact", () => {
    const parsed = parseJplSentry({
      signature: { version: "2.0", source: "NASA/JPL Sentry Data API" },
      data: [{ des: "2026 AB", id: "fixture-1", ip: "1.2e-8", n_imp: "2", ts_max: "0", ps_max: "-3.5", ps_cum: "-3.2", range: "2080-2100" }],
    });
    expect(parsed.records[0]).toMatchObject({ attentionState: "watch", maximumTorino: 0 });
    expect(parsed.records[0].attentionReason).toContain("not an expected impact");
  });

  it("normalizes DONKI observations without inventing operational severity", () => {
    const parsed = parseDonkiEvents({
      cme: [{ activityID: "2026-07-21T10:00:00-CME-001", startTime: "2026-07-21T10:00:00Z", note: "Fixture CME", link: "javascript:alert(1)", cmeAnalyses: [{ speed: 650, isMostAccurate: true }] }],
      flares: [{ flrID: "2026-07-21T09:00:00-FLR-001", beginTime: "2026-07-21T09:00:00Z", classType: "M1.2" }],
      storms: [{ gstID: "2026-07-21T08:00:00-GST-001", startTime: "2026-07-21T08:00:00Z", allKpIndex: [{ kpIndex: 5 }] }],
    });
    expect(parsed.records).toHaveLength(3);
    expect(parsed.records.every((record) => record.attentionState === "information")).toBe(true);
    expect(parsed.records.find((record) => record.type === "geomagnetic-storm")?.classType).toBe("Kp 5");
    expect(parsed.records.find((record) => record.type === "cme")?.sourceUrl).toBe("https://api.nasa.gov/");
    expect(() => parseDonkiEvents({ cme: { error: "rate limited" }, flares: [], storms: [] })).toThrow(/shape/i);
  });
});

describe("orbital source transport", () => {
  it("rejects upstream redirects instead of following an untrusted destination", async () => {
    const transport = new WorkerOrbitalSourceTransport({
      fetcher: async () => new Response(null, { status: 302, headers: { location: "https://example.com" } }),
    });
    await expect(transport.fetchSource("celestrak-stations", new Date())).rejects.toThrow(/redirect/i);
  });

  it("requires a server-side NASA key before requesting DONKI", async () => {
    let calls = 0;
    const transport = new WorkerOrbitalSourceTransport({
      fetcher: async () => {
        calls += 1;
        return Response.json([]);
      },
    });
    await expect(transport.fetchSource("nasa-donki", new Date())).rejects.toBeInstanceOf(OrbitalSourceRequestError);
    expect(calls).toBe(0);
  });

  it("enforces the response byte ceiling before parsing", async () => {
    const transport = new WorkerOrbitalSourceTransport({
      fetcher: async () => new Response("[]", {
        headers: { "content-type": "application/json", "content-length": "3000000" },
      }),
    });
    await expect(transport.fetchSource("celestrak-stations", new Date())).rejects.toThrow(/byte limit/i);
  });
});

describe("public orbital snapshot API", () => {
  it("returns explicitly labeled fixtures when no durable snapshot exists", async () => {
    const response = await getOrbit(new Request("https://argus.example/api/orbit"));
    const payload = await response.json() as {
      data: { dataClassification: string; earthOrbitObjects: unknown[]; sources: Array<{ status: string }> };
      meta: { warning: string };
    };
    expect(response.status).toBe(200);
    expect(payload.data.dataClassification).toBe("demonstration");
    expect(payload.data.earthOrbitObjects.length).toBeGreaterThan(0);
    expect(payload.data.sources.every((source) => source.status === "fixture")).toBe(true);
    expect(payload.meta.warning).toContain("not a flight-safety");
  });

  it("rejects query parameters to keep the public surface bounded", async () => {
    const response = await getOrbit(new Request("https://argus.example/api/orbit?source=all"));
    expect(response.status).toBe(422);
    expect((await response.json() as { error: { code: string } }).error.code).toBe("invalid_query");
  });

  it("does not classify an empty, demo-disabled snapshot as demonstration data", async () => {
    const snapshot = await readOrbitalSnapshot(undefined, {
      enabled: false,
      celestrakEnabled: false,
      jplEnabled: false,
      donkiEnabled: false,
      nasaApiKeyConfigured: false,
    }, { demoEnabled: false, now: new Date("2026-07-21T12:00:00.000Z") });
    expect(snapshot.dataClassification).toBe("public-information");
    expect(snapshot.earthOrbitObjects).toEqual([]);
    expect(snapshot.demoDataLabel).toBe("No orbital source data available");
  });
});

describe("protected orbital synchronization API", () => {
  it("requires authorization and still refuses synchronization while the feature flag is off", async () => {
    const database = new FakeD1Database();
    const baseRequest = { method: "POST", headers: { "content-type": "application/json" }, body: "{}" };
    const unauthorized = await syncOrbit(new Request("https://argus.example/api/admin/orbit/sync", baseRequest), { database });
    expect(unauthorized.status).toBe(401);

    let networkCalls = 0;
    const disabled = await syncOrbit(new Request("https://argus.example/api/admin/orbit/sync", {
      ...baseRequest,
      headers: { ...baseRequest.headers, authorization: "Bearer orbital-test-admin-token" },
    }), {
      database,
      adminToken: "orbital-test-admin-token",
      orbitalConfig: {
        enabled: false,
        celestrakEnabled: true,
        jplEnabled: true,
        donkiEnabled: true,
        nasaApiKeyConfigured: true,
      },
      orbitalTransport: {
        async fetchSource() {
          networkCalls += 1;
          throw new Error("The disabled route must not call a source.");
        },
      },
    });
    expect(disabled.status).toBe(409);
    expect(networkCalls).toBe(0);
  });
});
