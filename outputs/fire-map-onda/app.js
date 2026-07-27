const REFERENCE_COORDS = [39.9449883, -0.247279];
const REFERENCE_ZOOM = 13;
const translations = {
  es: {
    title: "Focos de incendio sobre imagen satelital",
    eyebrow: "VISOR DE DETECCIONES DE INCENDIOS",
    heading: "Focos de incendio sobre imagen satelital",
    subtitle: "39.9449883° N, 0.247279° O · ubicación de referencia del enlace de Google Maps",
    mapControls: "Controles del mapa",
    referenceView: "Extensión de referencia de Google",
    nearbyDetections: "Todas las detecciones próximas",
    showHotspots: "Mostrar focos",
    language: "Idioma",
    legendTitle: "Leyenda e información",
    mapLabel: "Mapa satelital con detecciones de incendios activos",
    lowerFrp: "FRP menor",
    higherFrp: "FRP mayor",
    legendText: "El tamaño y el color del punto indican la potencia radiativa del fuego (MW).",
    howToRead: "Cómo interpretar este visor",
    methodText: "El contorno amarillo delimita la zona de interés de Google My Maps. Cada punto de color naranja a rojo es una detección cercana de incendio activo de VIIRS; los puntos con borde blanco quedan dentro del contorno. Compare sus posiciones con la imagen satelital para valorar la superficie probablemente afectada. Una detección corresponde a un píxel de 375 m, no a un perímetro cartografiado del incendio: los puntos no delimitan por sí solos la extensión exacta. La fecha de la imagen satelital puede no coincidir con la de la detección.",
    loading: "Cargando detecciones…",
    count: (nearby, inside) => `${nearby} detecciones de incendios próximas · ${inside} dentro de la zona`,
    noDetections: "No hay detecciones locales en esta instantánea",
    insideZone: "Dentro de la zona",
    outsideZone: "Fuera de la zona",
    firePower: "Potencia radiativa del fuego",
    detected: "Detectado",
    sourceNote: (time, url) => `Instantánea exportada el ${time} desde <a href="${url}" target="_blank" rel="noreferrer">el flujo FIRMS actual de Earth Nullschool</a>. La actualización automática se ejecuta cada 30 minutos; esta página busca una instantánea nueva cada minuto.`,
    loadError: "No se pudo cargar la instantánea local de incendios.",
    retryNote: "No se pudo leer la instantánea local. El servidor volverá a intentarlo en la próxima actualización programada.",
  },
  en: {
    title: "Fire hotspots over satellite imagery",
    eyebrow: "FIRE DETECTION VIEWER",
    heading: "Hotspots over satellite imagery",
    subtitle: "39.9449883° N, 0.247279° W · reference position from the supplied Google Maps link",
    mapControls: "Map controls",
    referenceView: "Google reference extent",
    nearbyDetections: "All nearby detections",
    showHotspots: "Show hotspots",
    language: "Language",
    legendTitle: "Legend and information",
    mapLabel: "Satellite map with active-fire detections",
    lowerFrp: "lower FRP",
    higherFrp: "higher FRP",
    legendText: "Dot size and colour indicate fire radiative power (MW).",
    howToRead: "How to read this view",
    methodText: "The yellow outline is the area of interest from the shared Google My Maps layer. Each orange-to-red point is a nearby VIIRS active-fire detection; white-rimmed points fall inside the outline. Compare their positions with the satellite image to assess the likely affected area. A detection is a 375 m pixel, not a mapped fire perimeter: do not interpret the dots alone as the exact boundary of a wildfire. The imagery date may differ from the detection time.",
    loading: "Loading detections…",
    count: (nearby, inside) => `${nearby} nearby active-fire detections · ${inside} inside the zone`,
    noDetections: "No local detections in this snapshot",
    insideZone: "Inside zone",
    outsideZone: "Outside zone",
    firePower: "Fire radiative power",
    detected: "Detected",
    sourceNote: (time, url) => `Snapshot exported ${time} from <a href="${url}" target="_blank" rel="noreferrer">Earth Nullschool’s current FIRMS feed</a>. Automatic refresh runs every 30 minutes; this page checks for a new snapshot every minute.`,
    loadError: "Could not load the local fire snapshot",
    retryNote: "The local snapshot could not be read. The server will retry at its next scheduled refresh.",
  },
};
let currentLanguage = "es";
const legendElement = document.querySelector(".legend");
const mobileLegendQuery = window.matchMedia("(max-width: 680px)");

function syncLegendDefault(event) {
  legendElement.open = !event.matches;
}

syncLegendDefault(mobileLegendQuery);
mobileLegendQuery.addEventListener("change", syncLegendDefault);

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
let latestFireData;

function t(key) {
  return translations[currentLanguage][key];
}

function applyLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach(element => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  document.querySelectorAll(".language-button").forEach(button => {
    const isActive = button.id === `language-${language}`;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  if (latestFireData) renderHotspots(latestFireData);
  else document.querySelector("#detection-count").textContent = t("loading");
}

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
  const locale = currentLanguage === "es" ? "es-ES" : "en-GB";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
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
      .bindTooltip(`<strong>${t("firePower")}: ${frp.toFixed(2)} MW</strong><br>${t("detected")}: ${formatTime(detectedAt)}<br>${feature.properties.inside_area_of_interest ? t("insideZone") : t("outsideZone")}`, { className: "hotspot-tooltip", direction: "top", offset: [0, -7] })
      .addTo(hotspotLayer);
  }

  if (data.features.length) {
    localBounds = L.geoJSON(data).getBounds();
    const earliest = new Date(Math.min(...times)).toISOString();
    const latest = new Date(Math.max(...times)).toISOString();
    document.querySelector("#detection-count").textContent = t("count")(data.features.length, data.detections_inside_area_of_interest ?? 0);
    document.querySelector("#data-timestamp").textContent = `${formatTime(earliest)} – ${formatTime(latest)}`;
  } else {
    document.querySelector("#detection-count").textContent = t("noDetections");
    document.querySelector("#data-timestamp").textContent = "";
  }

  const generatedAt = data.generated_at ? formatTime(data.generated_at) : "unknown";
  document.querySelector("#source-note").innerHTML = t("sourceNote")(generatedAt, data.source_url);
}

function renderPerimeter(data) {
  perimeterLayer.clearLayers();
  perimeterLayer.addData(data);
  perimeterBounds = perimeterLayer.getBounds();
  if (!hasSetInitialView && perimeterBounds.isValid()) {
    hasSetInitialView = true;
    requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      map.fitBounds(perimeterBounds.pad(0.35), { animate: false, maxZoom: 16 });
      map.setZoom(REFERENCE_ZOOM, { animate: false });
    });
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
      latestFireData = fireData;
      renderHotspots(fireData);
      currentSnapshotId = snapshotId;
    }
    if (perimeterId !== currentPerimeterId) {
      renderPerimeter(perimeterData);
      currentPerimeterId = perimeterId;
    }
  } catch (error) {
    console.error(error);
    document.querySelector("#detection-count").textContent = t("loadError");
    document.querySelector("#source-note").textContent = t("retryNote");
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
document.querySelector("#language-es").addEventListener("click", () => applyLanguage("es"));
document.querySelector("#language-en").addEventListener("click", () => applyLanguage("en"));

applyLanguage("es");
refreshMapData();
window.setInterval(refreshMapData, 60_000);
