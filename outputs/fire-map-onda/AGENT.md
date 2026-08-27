# Fire Map: guide for future work

## Purpose and boundaries

This is a small, dependency-free static web map of nearby **VIIRS active-fire
detections** over Esri satellite imagery, centred on El Saler, Valencia.
It is intended to show current detections around the user-supplied reference
location; it does **not** show a verified wildfire perimeter. Keep that
distinction in the UI, documentation, and any new copy.

The interface is Spanish-first, with an English toggle. Any user-facing text
change must update both entries in `translations` in `app.js` and preserve the
existing accessibility labels.

## Repository layout

- `index.html`, `styles.css`, `app.js` — the static Leaflet map. Leaflet and its
  stylesheet are intentionally loaded from unpkg; there is no package manager
  or front-end build step.
- `monitoring-area.mjs` — shared fixed El Saler map centre, zoom, and hotspot
  monitoring extent.
- `wind-layer.mjs` — pure wind-grid, direction, and Open-Meteo response helpers.
  The browser requests this current-wind layer around El Saler independently on
  every page load and refreshes it every 10 minutes; it must not depend on
  FIRMS succeeding or changing.
- The transparent Esri `World_Boundaries_and_Places` reference tiles sit above
  World Imagery and below the fire/wind overlays. Keep the geographic-names
  toggle enabled by default so towns and landmarks provide spatial reference.
- `data/zone-of-interest.kml` and `.geojson` — legacy Sant Francesc artifacts
  retained for provenance; the El Saler view does not load or refresh them.
- `data/firms-current.geojson` — browser snapshot of the nearby FIRMS points.
- `data/current-hotspots-nearby.kml` — generated KML intended for import into
  Google My Maps.
- `scripts/export-current-firms.mjs` — fetches Earth Nullschool's packed
  current FIRMS feed, filters the fixed El Saler extent, and atomically rewrites
  the GeoJSON and KML detection snapshots.
- `scripts/serve-live-map.mjs` — local static server plus scheduled exporter
  runner. It binds only to `127.0.0.1` and returns `no-store` responses.
- `.github/workflows/refresh-fire-hotspots.yml` — GitHub Actions equivalent of
  the refresh job. It runs every 30 minutes and commits only the generated
  GeoJSON/KML outputs. Set `MAP_DIRECTORY` if this project is moved into a
  subdirectory of a larger Pages repository.

## Data contract

`firms-current.geojson` is a `FeatureCollection` with snapshot metadata plus
point features. Each feature has `[longitude, latitude]` coordinates and these
properties:

- `detected_at` — ISO 8601 timestamp.
- `frp_mw` — numeric fire radiative power in MW.

The front end also expects `generated_at`, `source_url`, and a valid GeoJSON
feature collection.
Maintain this contract when changing the exporter or substituting a source.

The exporter deliberately parses the specific Earth Nullschool EPAK layout
it uses. Treat an upstream format change as a data-parser change: preserve the
syntax checks below and inspect a refreshed output before publishing.

## Common commands

Run from the repository root:

```sh
# Syntax-only checks for all JavaScript modules.
node --check app.js
node --check monitoring-area.mjs
node --check wind-layer.mjs
node scripts/test-monitoring-area.mjs
node --check scripts/test-wind-layer.mjs
node scripts/test-wind-layer.mjs
node --check scripts/export-current-firms.mjs
node --check scripts/serve-live-map.mjs

# Serve the current checked-in snapshot without changing it.
python3 -m http.server 8000

# Fetch and write a new hotspot snapshot (requires network access).
node scripts/export-current-firms.mjs

# Serve locally and refresh the snapshot immediately and then every 30 minutes.
node scripts/serve-live-map.mjs
```

`serve-live-map.mjs` refreshes once on startup, so use the plain Python server
when visual-checking a fixed snapshot. Use `--port=8010` and/or
`--refresh-minutes=15` with the live server when needed.

## Published portfolio copy

This standalone directory is the working source. Its GitHub Pages publication
is a second copy at:

```text
/Users/inigo/Documents/curro/UNHCR Mozambique/Onedrive - UNHCR/08_tools/01_R/UNHCR_IM_Tools/R/portfolio/outputs/fire-map-onda
```

That `portfolio` checkout is the `main` branch of
`https://github.com/ibagur/IM-portfolio.git`, which supplies the live
GitHub Pages site. **Every completed change to this local map must also be
synced to the matching portfolio directory, committed, and pushed** so the
published map matches the working source. Do not describe a local-only change
as online until the push has succeeded.

For each change, copy the corresponding files (including the generated hotspot
snapshots whenever refreshed), validate in the portfolio copy, check
its Git diff, then stage only the expected `outputs/fire-map-onda` files. Do
not stage unrelated portfolio changes, including an untracked `.codex/`
directory. A user can explicitly request a local-only or deferred-publish
change; otherwise, synchronizing and publishing is part of the task.

## Working conventions

- A normal refresh changes only `firms-current.geojson` and
  `current-hotspots-nearby.kml`. Preserve the legacy zone files unchanged.
- Keep the map usable on mobile: the legend is intentionally collapsed at
  widths of 680 px or less. Check both desktop and narrow/mobile layouts after
  changes to controls, overlays, or map sizing.
- Cache-busting query strings on local CSS/JS assets are deliberate. Bump the
  relevant version in `index.html` when a hosted asset change needs to be
  visible promptly through GitHub Pages or browser caches.
- Do not claim the dots delineate the fire extent. A VIIRS detection represents
  a 375 m pixel and satellite imagery may be older than the detection.
- Do not add secrets to this repository. The source feeds and map dependencies
  are public and require no credentials.
- The root is currently not a Git repository. Do not assume Git history,
  branches, commits, or Pages settings are available locally; inspect the
  actual checkout before relying on them.

## Validation before handoff

For UI or data-contract changes:

1. Run all three `node --check` commands above.
2. Serve the fixed snapshot and open the map. Confirm the El Saler center, the
   count and timestamp appear, toggling hotspots works, both language choices
   render, and the responsive legend behaves at a narrow viewport.
3. If the exporter changed, run it only when a network refresh is intended;
   then inspect the generated GeoJSON metadata, feature count, and coordinates.
   Confirm the KML remains importable.
4. If the workflow changed, ensure its staged file list includes only the two
   generated hotspot snapshots.

There is no automated test suite or build pipeline at present. Do not report a
visual or network refresh as verified unless it was actually run and inspected.
