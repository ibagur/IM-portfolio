# Fire hotspots over satellite imagery

A small local web map centred on the supplied Google Maps location (39.9449883, -0.247279). It places an Esri satellite basemap below nearby active-fire detections shown by Earth Nullschool and overlays the shared Google My Maps zone of interest.

## Run the live-updating map

```sh
node scripts/serve-live-map.mjs
```

Open `http://127.0.0.1:8000`. While that process runs, it refreshes the FIRMS fire data every 30 minutes. The Sant Francesc forest boundary is fixed in `data/zone-of-interest.kml`; the open browser checks for a new local snapshot every minute and redraws automatically.

Use `--port=8010` or `--refresh-minutes=15` to change either setting.

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
