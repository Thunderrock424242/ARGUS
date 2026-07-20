# Aether and map architecture

## Aether

Aether is ARGUS's analyst-assistance surface. In the MVP it produces deterministic responses from local demonstration data. Aether output is visibly labeled as generated analysis and is never promoted to evidence.

The provider boundary should support chat, event context, source comparison, brief generation, and contradiction analysis. Every response includes an evidence summary, stored report citations, related event IDs, a confidence explanation, generation time, and the `generatedBy: "Aether"` marker.

### Citation invariant

Aether may cite only report IDs already stored in the context it received. The server must resolve those IDs to source metadata after generation and discard unknown citations. A model-supplied URL is not a source citation. Never let Aether browse, fetch, or write merely because a prompt asks it to.

### Future provider flow

```text
validated analyst prompt
  -> permission-scoped retrieval from ARGUS records
  -> minimized context with evidence IDs
  -> AI provider through a server-only adapter
  -> structured schema validation
  -> citation-ID reconciliation
  -> safety/size checks
  -> labeled response and optional audited save
```

Keep model credentials server-side, impose token and time budgets, rate-limit per analyst, prevent prompt text from changing system permissions, and provide a network-free fallback. Sensitive raw payloads and personal data should not be sent to a model without an explicit lawful policy.

## Global map and globe

The visualization is not a separate authority. MapLibre receives events with valid latitude/longitude, category, severity, automated confidence, verification state, status, and update time. It starts in supported globe projection and provides a labeled flat Mercator toggle. Clustering and filtering happen in dedicated map state; selecting a marker opens an event preview and dossier link. Tile failures produce a degraded status while event lists and dossiers remain usable.

Location rules:

- Structured source coordinates are preferred.
- Missing coordinates remain missing; ARGUS does not invent a point.
- Approximate locations must carry precision/provenance metadata in a future durable model.
- Sensitive or personal locations should be generalized or withheld.
- Severity and confidence use shape/text as well as color.

The map can use public style and tile services, but operators must review attribution, usage limits, caching rights, privacy, and regional availability. Tile URLs belong in server/runtime configuration when they include credentials. The worker CSP permits HTTPS images/connections and blob workers needed by MapLibre, but a tighter host allowlist is recommended once a production tile provider is selected.

## Performance and accessibility

Cluster large point sets, paginate non-map lists, lazy-load map code, avoid rebuilding GeoJSON on unrelated UI updates, and keep animations restrained. Provide a synchronized accessible event list because a canvas/WebGL map cannot be the only route to critical information. Respect reduced-motion preferences and retain keyboard navigation outside the map canvas.
