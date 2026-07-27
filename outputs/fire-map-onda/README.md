# Fire hotspots over satellite imagery

A small local web map centred on the supplied Google Maps location (39.9449883, -0.247279). It places an Esri satellite basemap below nearby active-fire detections shown by Earth Nullschool, overlays the shared Google My Maps zone of interest, and draws a current-wind grid from Open-Meteo.

## Run the live-updating map

```sh
node scripts/serve-live-map.mjs
```

Open `http://127.0.0.1:8000`. While that process runs, it refreshes the FIRMS fire data every 30 minutes. The Sant Francesc forest boundary is fixed in `data/zone-of-interest.kml`; the open browser checks for a new local snapshot every minute and redraws automatically.

The wind overlay is independent from the hotspot snapshot. Every page load requests current 10 m wind direction, speed, and gusts for a fixed 5×5 grid covering Sant Francesc and the southern fire front, and the open page refreshes that layer every 10 minutes. The arrows point in the direction the wind is travelling; labels show speed in km/h.

Use `--port=8010` or `--refresh-minutes=15` to change either setting.

## Publish with automatic updates on GitHub Pages

GitHub Pages serves the map but cannot run the refresh script itself. The included GitHub Actions workflow at `.github/workflows/refresh-fire-hotspots.yml` runs it every 30 minutes, commits the latest GeoJSON and My Maps KML, and lets GitHub Pages publish those new files.

If this map is placed in a subfolder of the portfolio repository, set `MAP_DIRECTORY` near the top of that workflow to the map's repository-relative folder, for example `projects/fire-map`. Keep `data/zone-of-interest.kml` with the map: it is the fixed Sant Francesc forest boundary used for every refresh.

After pushing the workflow, open **Actions → Refresh fire hotspots → Run workflow** once to publish the first updated snapshot. The hosted `index.html` then checks the published data every minute and redraws when GitHub Pages serves a newer snapshot.

## Serve a fixed snapshot

Run a local static server from this folder, then open the shown address:

```sh
python3 -m http.server 8000
```

The map opens on the shared perimeter. Use **All nearby detections** to see the surrounding clusters and **Show hotspots** to compare the imagery alone. White-rimmed detections are inside the perimeter.

## Refresh the detections

The checked-in snapshot is intentionally local and reproducible. To refresh it from the public Earth Nullschool FIRMS payload and the shared My Maps boundary:

```sh
node scripts/export-current-firms.mjs
```

The script downloads the `current-firms.epak` payload, decodes a local fire extent, and marks each detection against the exact My Maps polygon. It writes both the HTML map data and `data/current-hotspots-nearby.kml`.

## Import into Google My Maps

1. In My Maps, select **Add layer** and then **Import**.
2. Choose `data/current-hotspots-nearby.kml`.
3. Name the layer **Current hotspots**.

The KML contains all latest detections in the surrounding fire area, with each point description stating whether it is inside the zone already drawn in My Maps. Refresh it with the command above whenever you need a newer snapshot. Active-fire detections identify burning pixels; they do not provide a verified fire perimeter. Satellite imagery can also pre-date the event.
