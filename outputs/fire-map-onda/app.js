import {
  RISK_HORIZONS,
  calculateRiskNowcast,
  destinationPoint,
  summarizeForecast,
} from "./risk-model.mjs";

const REFERENCE_COORDS = [39.9449883, -0.247279];
const REFERENCE_ZOOM = 14;
const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_SOURCE_URL = "https://open-meteo.com/en/docs";
const translations = {
  es: {
    title: "Focos de incendio sobre Onda",
    heading: "Focos de incendio sobre Onda",
    mapControls: "Controles del mapa",
    referenceView: "Extensión de referencia de Google",
    nearbyDetections: "Todas las detecciones próximas",
    showHotspots: "Mostrar focos",
    showRiskCorridors: "Mostrar corredores de riesgo",
    language: "Idioma",
    legendTitle: "Leyenda e información",
    mapLabel: "Mapa satelital con detecciones de incendios activos",
    lowerFrp: "Foco menos intenso",
    higherFrp: "Foco más intenso",
    riskCorridorLegend: "Corredor direccional orientativo",
    legendText: "El tamaño y el color del punto indican la intensidad estimada de cada foco de incendio.",
    howToRead: "Cómo interpretar este visor",
    methodText: "El contorno amarillo delimita la zona de interés de Google My Maps. Cada punto de color naranja a rojo es una detección cercana de incendio activo de VIIRS; los puntos con borde blanco quedan dentro del contorno. Compare sus posiciones con la imagen satelital para valorar la superficie probablemente afectada. Una detección corresponde a un píxel de 375 m, no a un perímetro cartografiado del incendio: los puntos no delimitan por sí solos la extensión exacta. La fecha de la imagen satelital puede no coincidir con la de la detección.",
    loading: "Cargando detecciones…",
    count: (nearby, inside) => `${nearby} detecciones de incendios próximas · ${inside} dentro de la zona`,
    noDetections: "No hay detecciones locales en esta instantánea",
    insideZone: "Dentro de la zona",
    outsideZone: "Fuera de la zona",
    firePower: "Intensidad del foco",
    detected: "Detectado",
    sourceNote: (time, url) => `Instantánea exportada el ${time} desde <a href="${url}" target="_blank" rel="noreferrer">el flujo FIRMS actual de Earth Nullschool</a>. La actualización automática se ejecuta cada 30 minutos; esta página busca una instantánea nueva cada minuto.`,
    loadError: "No se pudo cargar la instantánea local de incendios.",
    retryNote: "No se pudo leer la instantánea local. El servidor volverá a intentarlo en la próxima actualización programada.",
    riskTitle: "Riesgo para el bosque",
    riskIntroduction: "Indicador orientativo: no es una predicción confirmada de propagación ni una instrucción de emergencia.",
    riskLoading: "Calculando riesgo con el viento previsto…",
    riskUnavailableStaleSnapshot: "No disponible: la instantánea de focos tiene más de dos horas.",
    riskUnavailableNoRecent: "No disponible: no hay focos detectados en las últimas seis horas.",
    riskUnavailableWeather: "No disponible: faltan datos meteorológicos previstos para este análisis.",
    riskUnavailableWeatherFetch: "No disponible: no se pudieron cargar los datos meteorológicos.",
    riskCategory: { low: "Bajo", watch: "Vigilancia", elevated: "Elevado", urgent: "Urgente" },
    riskHeading: (hours, category) => `Próximas ${hours} h · ${category}`,
    riskReason: ({ distance, age, windFrom, windSpeed, gusts, alignment }) => `${distance} km hasta el bosque; foco de hace ${age} h. Viento desde ${windFrom}°: ${windSpeed} km/h, rachas ${gusts} km/h; ${alignment ? "dirección favorable hacia el bosque" : "dirección poco favorable hacia el bosque"}.`,
    riskCorridorTooltip: hours => `Corredor direccional orientativo · ${hours} h`,
    weatherSource: time => `Viento, humedad, precipitación y humedad superficial previstos desde <a href="${WEATHER_SOURCE_URL}" target="_blank" rel="noreferrer">Open-Meteo</a> · consulta ${time}.`,
    weatherRetained: "No se pudo actualizar el tiempo; se mantiene la última previsión válida.",
  },
  en: {
    title: "Fire hotspots over Onda",
    heading: "Fire hotspots over Onda",
    mapControls: "Map controls",
    referenceView: "Google reference extent",
    nearbyDetections: "All nearby detections",
    showHotspots: "Show hotspots",
    showRiskCorridors: "Show risk corridors",
    language: "Language",
    legendTitle: "Legend and information",
    mapLabel: "Satellite map with active-fire detections",
    lowerFrp: "Less intense hotspot",
    higherFrp: "More intense hotspot",
    riskCorridorLegend: "Indicative directional corridor",
    legendText: "Dot size and colour indicate the estimated intensity of each fire hotspot.",
    howToRead: "How to read this view",
    methodText: "The yellow outline is the area of interest from the shared Google My Maps layer. Each orange-to-red point is a nearby VIIRS active-fire detection; white-rimmed points fall inside the outline. Compare their positions with the satellite image to assess the likely affected area. A detection is a 375 m pixel, not a mapped fire perimeter: do not interpret the dots alone as the exact boundary of a wildfire. The imagery date may differ from the detection time.",
    loading: "Loading detections…",
    count: (nearby, inside) => `${nearby} nearby active-fire detections · ${inside} inside the zone`,
    noDetections: "No local detections in this snapshot",
    insideZone: "Inside zone",
    outsideZone: "Outside zone",
    firePower: "Hotspot intensity",
    detected: "Detected",
    sourceNote: (time, url) => `Snapshot exported ${time} from <a href="${url}" target="_blank" rel="noreferrer">Earth Nullschool’s current FIRMS feed</a>. Automatic refresh runs every 30 minutes; this page checks for a new snapshot every minute.`,
    loadError: "Could not load the local fire snapshot",
    retryNote: "The local snapshot could not be read. The server will retry at its next scheduled refresh.",
    riskTitle: "Risk to forest",
    riskIntroduction: "Indicative awareness signal: this is not a confirmed spread forecast or emergency instruction.",
    riskLoading: "Calculating risk using forecast wind…",
    riskUnavailableStaleSnapshot: "Unavailable: the hotspot snapshot is more than two hours old.",
    riskUnavailableNoRecent: "Unavailable: there are no hotspots detected in the last six hours.",
    riskUnavailableWeather: "Unavailable: forecast weather required for this assessment is missing.",
    riskUnavailableWeatherFetch: "Unavailable: forecast weather could not be loaded.",
    riskCategory: { low: "Low", watch: "Watch", elevated: "Elevated", urgent: "Urgent" },
    riskHeading: (hours, category) => `Next ${hours} h · ${category}`,
    riskReason: ({ distance, age, windFrom, windSpeed, gusts, alignment }) => `${distance} km to forest; hotspot detected ${age} h ago. Wind from ${windFrom}°: ${windSpeed} km/h, gusts ${gusts} km/h; ${alignment ? "direction favours movement toward the forest" : "direction is not favourable toward the forest"}.`,
    riskCorridorTooltip: hours => `Indicative directional corridor · ${hours} h`,
    weatherSource: time => `Forecast wind, humidity, precipitation and shallow soil moisture from <a href="${WEATHER_SOURCE_URL}" target="_blank" rel="noreferrer">Open-Meteo</a> · queried ${time}.`,
    weatherRetained: "Weather refresh failed; the latest valid forecast is retained.",
  },
};

let currentLanguage = "es";
let latestFireData;
let latestPerimeterData;
let latestWeather;
let latestWeatherError;
let latestRiskResult;
let weatherLastAttemptAt = 0;
let weatherFetchInProgress;
let currentSnapshotId;
let currentPerimeterId;
let perimeterBounds;
let localBounds;
let hasSetInitialView = false;

const legendElement = document.querySelector(".legend");
const riskContentElement = document.querySelector("#risk-content");
const weatherSourceNoteElement = document.querySelector("#weather-source-note");
const mobileLegendQuery = window.matchMedia("(max-width: 680px)");
const riskColors = { low: "#788a80", watch: "#c68a15", elevated: "#df6724", urgent: "#bc3030" };

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
const riskCorridorLayer = L.layerGroup().addTo(map);
const perimeterLayer = L.geoJSON(null, {
  style: {
    color: "#ffdc36",
    weight: 3,
    opacity: 0.95,
    fillColor: "#ffdc36",
    fillOpacity: 0.09,
  },
}).addTo(map);

function t(key) {
  return translations[currentLanguage][key];
}

function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat(currentLanguage === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
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
  renderRisk();
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

function centroidForPerimeter(perimeterData) {
  const geometry = perimeterData.features?.[0]?.geometry;
  const ring = geometry?.type === "Polygon" ? geometry.coordinates[0] : geometry?.type === "MultiPolygon" ? geometry.coordinates[0][0] : undefined;
  if (!ring?.length) return undefined;
  const vertices = ring.slice(0, -1);
  return vertices.reduce((total, [lon, lat]) => [total[0] + lon / vertices.length, total[1] + lat / vertices.length], [0, 0]);
}

function weatherEntriesFromResponse(payload) {
  const data = payload.minutely_15;
  const fields = ["time", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "relative_humidity_2m", "precipitation", "soil_moisture_0_to_1cm"];
  if (!data || fields.some(field => !Array.isArray(data[field]))) throw new Error("Open-Meteo response is missing required 15-minute fields.");
  return data.time.map((time, index) => ({
    time: new Date(time.endsWith("Z") ? time : `${time}Z`),
    windSpeedKmh: Number(data.wind_speed_10m[index]),
    windDirection: Number(data.wind_direction_10m[index]),
    windGustKmh: Number(data.wind_gusts_10m[index]),
    relativeHumidity: Number(data.relative_humidity_2m[index]),
    precipitationMm: Number(data.precipitation[index]),
    soilMoisture: Number(data.soil_moisture_0_to_1cm[index]),
  }));
}

async function refreshWeather(perimeterData) {
  if (Date.now() - weatherLastAttemptAt < WEATHER_REFRESH_MS) {
    if (latestWeather) return latestWeather;
    if (latestWeatherError) throw latestWeatherError;
  }
  if (weatherFetchInProgress) return weatherFetchInProgress;
  const centroid = centroidForPerimeter(perimeterData);
  if (!centroid) throw new Error("The forest perimeter has no usable geometry.");
  const [longitude, latitude] = centroid;
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    minutely_15: "wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm",
    forecast_minutely_15: "25",
    timezone: "UTC",
    wind_speed_unit: "kmh",
  });
  weatherLastAttemptAt = Date.now();
  weatherFetchInProgress = fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`, { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error(`Open-Meteo: HTTP ${response.status}`);
      const payload = await response.json();
      latestWeather = { entries: weatherEntriesFromResponse(payload), queriedAt: new Date() };
      latestWeatherError = undefined;
      return latestWeather;
    })
    .catch(error => {
      latestWeatherError = error;
      if (latestWeather) return latestWeather;
      throw error;
    })
    .finally(() => { weatherFetchInProgress = undefined; });
  return weatherFetchInProgress;
}

function corridorPoints(assessment) {
  const start = assessment.feature.geometry.coordinates;
  const bearing = assessment.downwindBearing;
  const { reachKm } = assessment.horizon;
  return [
    start,
    destinationPoint(start, bearing - 25, reachKm),
    destinationPoint(start, bearing, reachKm),
    destinationPoint(start, bearing + 25, reachKm),
  ].map(([lon, lat]) => [lat, lon]);
}

function renderRiskCorridors() {
  riskCorridorLayer.clearLayers();
  if (latestRiskResult?.status !== "ready") return;
  const drawnFeatures = new Set();
  for (const assessment of latestRiskResult.assessments) {
    const key = `${assessment.feature.geometry.coordinates.join(",")}-${assessment.horizon.hours}`;
    if (drawnFeatures.has(key)) continue;
    drawnFeatures.add(key);
    L.polygon(corridorPoints(assessment), {
      color: riskColors[assessment.category],
      weight: 1.5,
      opacity: 0.85,
      fillColor: riskColors[assessment.category],
      fillOpacity: 0.18,
    }).bindTooltip(t("riskCorridorTooltip")(assessment.horizon.hours), { sticky: true }).addTo(riskCorridorLayer);
  }
}

function unavailableRiskText(reason) {
  return t({ stale_snapshot: "riskUnavailableStaleSnapshot", no_recent_detections: "riskUnavailableNoRecent", weather_incomplete: "riskUnavailableWeather", weather_fetch: "riskUnavailableWeatherFetch" }[reason] ?? "riskUnavailableWeather");
}

function renderWeatherSourceNote() {
  if (!latestWeather) {
    weatherSourceNoteElement.textContent = "";
    return;
  }
  weatherSourceNoteElement.innerHTML = t("weatherSource")(formatTime(latestWeather.queriedAt.toISOString()));
  if (latestWeatherError) weatherSourceNoteElement.append(` ${t("weatherRetained")}`);
}

function renderRisk() {
  if (!latestRiskResult) {
    riskContentElement.textContent = t("riskLoading");
    weatherSourceNoteElement.textContent = "";
    return;
  }
  riskContentElement.replaceChildren();
  if (latestRiskResult.status !== "ready") {
    const message = document.createElement("p");
    message.className = "risk-unavailable";
    message.textContent = unavailableRiskText(latestRiskResult.reason);
    riskContentElement.append(message);
    renderWeatherSourceNote();
    renderRiskCorridors();
    return;
  }

  for (const assessment of latestRiskResult.assessments) {
    const card = document.createElement("article");
    card.className = "risk-card";
    card.dataset.risk = assessment.category;
    const heading = document.createElement("strong");
    heading.textContent = t("riskHeading")(assessment.horizon.hours, t("riskCategory")[assessment.category]);
    const reason = document.createElement("span");
    reason.textContent = t("riskReason")({
      distance: formatNumber(assessment.distanceKm),
      age: formatNumber(assessment.ageHours),
      windFrom: Math.round(assessment.weather.windDirection),
      windSpeed: Math.round(assessment.weather.windSpeedKmh),
      gusts: Math.round(assessment.weather.windGustKmh),
      alignment: assessment.components.alignment > 0,
    });
    card.append(heading, reason);
    riskContentElement.append(card);
  }
  renderWeatherSourceNote();
  renderRiskCorridors();
}

async function refreshRiskNowcast(fireData, perimeterData) {
  const now = new Date();
  try {
    const weather = await refreshWeather(perimeterData);
    const weatherByHorizon = Object.fromEntries(RISK_HORIZONS.map(({ hours }) => [hours, summarizeForecast(weather.entries, now, hours)]));
    latestRiskResult = calculateRiskNowcast({
      features: fireData.features,
      perimeterGeometry: perimeterData.features?.[0]?.geometry,
      weatherByHorizon,
      snapshotGeneratedAt: fireData.generated_at,
      now,
    });
  } catch (error) {
    console.error(error);
    latestRiskResult = { status: "unavailable", reason: "weather_fetch" };
  }
  renderRisk();
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
      latestPerimeterData = perimeterData;
      renderPerimeter(perimeterData);
      currentPerimeterId = perimeterId;
    }
    if (latestFireData && latestPerimeterData) refreshRiskNowcast(latestFireData, latestPerimeterData);
  } catch (error) {
    console.error(error);
    document.querySelector("#detection-count").textContent = t("loadError");
    document.querySelector("#source-note").textContent = t("retryNote");
    latestRiskResult = { status: "unavailable", reason: "weather_fetch" };
    renderRisk();
  }
}

document.querySelector("#reference-view").addEventListener("click", () => map.setView(REFERENCE_COORDS, REFERENCE_ZOOM));
document.querySelector("#detections-view").addEventListener("click", () => {
  if (localBounds?.isValid()) map.fitBounds(localBounds.pad(0.25), { maxZoom: 15 });
});
document.querySelector("#hotspots-toggle").addEventListener("change", event => {
  if (event.target.checked) hotspotLayer.addTo(map);
  else map.removeLayer(hotspotLayer);
});
document.querySelector("#risk-corridors-toggle").addEventListener("change", event => {
  if (event.target.checked) riskCorridorLayer.addTo(map);
  else map.removeLayer(riskCorridorLayer);
});
document.querySelector("#language-es").addEventListener("click", () => applyLanguage("es"));
document.querySelector("#language-en").addEventListener("click", () => applyLanguage("en"));

applyLanguage("es");
refreshMapData();
window.setInterval(refreshMapData, 60_000);
