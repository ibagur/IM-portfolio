const REFERENCE_COORDS = [39.9449883, -0.247279];
const REFERENCE_ZOOM = 15;

const map = L.map("map", { zoomControl: false, preferCanvas: true }).setView(REFERENCE_COORDS, REFERENCE_ZOOM);
L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  maxZoom: 19,
}).addTo(map);

const hotspotLayer = L.layerGroup().addTo(map);
const perimeterLayer = L.geoJSON(null, {
  style: {
    color: "#ffdc36",
    weight: 3,
    opacity: 0.95,
    fillColor: "#ffdc36",
    fillOpacity: 0.09,
  },
}).addTo(map);
let perimeterBounds;
let localBounds;
let currentSnapshotId;
let currentPerimeterId;
let hasSetInitialView = false;

function frpStyle(frp) {
  const capped = Math.min(Math.max(frp, 0), 50);
  const intensity = capped / 50;
  return {
    radius: 4 + Math.sqrt(capped) * 1.1,
    color: "#ffd36a",
    weight: 1,
    opacity: 0.9,
    fillColor: `hsl(${38 - intensity * 30} 93% ${59 - intensity * 9}%)`,
    fillOpacity: 0.72,
  };
}

function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function renderHotspots(data) {
  hotspotLayer.clearLayers();
  const times = [];
  for (const feature of data.features) {
    const [lon, lat] = feature.geometry.coordinates;
    const { frp_mw: frp, detected_at: detectedAt } = feature.properties;
    times.push(new Date(detectedAt).getTime());
    const marker = L.circleMarker([lat, lon], frpStyle(frp));
    if (feature.properties.inside_area_of_interest) marker.setStyle({ color: "#fff", weight: 2 });
    marker
      .bindTooltip(`<strong>${frp.toFixed(2)} MW</strong><br>${formatTime(detectedAt)}<br>${feature.properties.inside_area_of_interest ? "Inside zone" : "Outside zone"}`, { className: "hotspot-tooltip", direction: "top", offset: [0, -7] })
      .addTo(hotspotLayer);
  }

  if (data.features.length) {
    localBounds = L.geoJSON(data).getBounds();
    const earliest = new Date(Math.min(...times)).toISOString();
    const latest = new Date(Math.max(...times)).toISOString();
    document.querySelector("#detection-count").textContent = `${data.features.length} nearby active-fire detections · ${data.detections_inside_area_of_interest ?? 0} inside the zone`;
    document.querySelector("#data-timestamp").textContent = `${formatTime(earliest)} – ${formatTime(latest)}`;
  } else {
    document.querySelector("#detection-count").textContent = "No local detections in this snapshot";
    document.querySelector("#data-timestamp").textContent = "";
  }

  const generatedAt = data.generated_at ? formatTime(data.generated_at) : "unknown";
  document.querySelector("#source-note").innerHTML = `Snapshot exported ${generatedAt} from <a href="${data.source_url}" target="_blank" rel="noreferrer">Earth Nullschool’s current FIRMS feed</a>. The local server refreshes every 30 minutes; this page checks for a new snapshot every minute.`;
}

function renderPerimeter(data) {
  perimeterLayer.clearLayers();
  perimeterLayer.addData(data);
  perimeterBounds = perimeterLayer.getBounds();
  if (!hasSetInitialView && perimeterBounds.isValid()) {
    map.fitBounds(perimeterBounds.pad(0.35), { maxZoom: 16 });
    hasSetInitialView = true;
  }
}

async function refreshMapData() {
  try {
    const [fireData, perimeterData] = await Promise.all([
      fetchJson("data/firms-current.geojson"),
      fetchJson("data/zone-of-interest.geojson"),
    ]);
    const snapshotId = fireData.generated_at ?? JSON.stringify(fireData.features);
    const perimeterId = JSON.stringify(perimeterData.features);
    if (snapshotId !== currentSnapshotId) {
      renderHotspots(fireData);
      currentSnapshotId = snapshotId;
    }
    if (perimeterId !== currentPerimeterId) {
      renderPerimeter(perimeterData);
      currentPerimeterId = perimeterId;
    }
  } catch (error) {
    console.error(error);
    document.querySelector("#detection-count").textContent = "Could not load the local fire snapshot";
    document.querySelector("#source-note").textContent = "The local snapshot could not be read. The server will retry at its next scheduled refresh.";
  }
}

document.querySelector("#reference-view").addEventListener("click", () => map.setView(REFERENCE_COORDS, REFERENCE_ZOOM));
document.querySelector("#detections-view").addEventListener("click", () => {
  if (localBounds?.isValid()) map.fitBounds(localBounds.pad(0.25), { maxZoom: 15 });
});
document.querySelector("#hotspots-toggle").addEventListener("change", (event) => {
  if (event.target.checked) hotspotLayer.addTo(map);
  else map.removeLayer(hotspotLayer);
});

refreshMapData();
window.setInterval(refreshMapData, 60_000);
