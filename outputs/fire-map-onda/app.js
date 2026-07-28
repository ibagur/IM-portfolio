import {
  RISK_HORIZONS,
  calculateRiskNowcast,
  destinationPoint,
  summarizeForecast,
} from "./risk-model.mjs";
import {
  createWindGrid,
  parseCurrentWindPayload,
  windTravelBearing,
} from "./wind-layer.mjs?v=20260728-2";
import {
  MAP_REFERENCE_COORDS as REFERENCE_COORDS,
  MAP_REFERENCE_ZOOM as REFERENCE_ZOOM,
} from "./monitoring-area.mjs?v=20260728-1";

// Keep the San Francesc boundary data available without rendering it in the monitoring view.
const SHOW_SAN_FRANCESC_PERIMETER = false;
const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const WIND_LAYER_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_SOURCE_URL = "https://open-meteo.com/en/docs";
const WIND_LOCATIONS = createWindGrid(REFERENCE_COORDS);
const translations = {
  es: {
    title: "Focos de incendios sobre Onda",
    heading: "Focos de incendios sobre Onda",
    mapControls: "Controles del mapa",
    showMapControls: "Mostrar controles del mapa",
    hideMapControls: "Ocultar controles del mapa",
    referenceView: "Extensión de referencia de Google",
    nearbyDetections: "Todas las detecciones próximas",
    showHotspots: "Mostrar focos",
    showWindLayer: "Mostrar viento",
    showPlaceLabels: "Mostrar nombres geográficos",
    showRiskCorridors: "Mostrar corredores de riesgo",
    riskCorridorsLoading: "Calculando corredores…",
    riskCorridorsUnavailable: "Corredores no disponibles",
    language: "Idioma",
    legendTitle: "Leyenda e información",
    mapLabel: "Mapa satelital con detecciones de incendios activos",
    lowerFrp: "Foco menos intenso",
    higherFrp: "Foco más intenso",
    windLegend: "Viento: flecha hacia donde se desplaza · velocidad en km/h",
    riskCorridorLegend: "Corredor direccional orientativo",
    legendText: "El tamaño y el color del punto indican la intensidad estimada de cada foco de incendio.",
    howToRead: "Cómo interpretar este visor",
    methodText: "La zona de interés de Sant Francesc procede de Google My Maps. Cada punto de color naranja a rojo es una detección cercana de incendio activo de VIIRS; los puntos con borde blanco quedan dentro de esa zona. Compare sus posiciones con la imagen satelital para valorar la superficie probablemente afectada. Una detección corresponde a un píxel de 375 m, no a un perímetro cartografiado del incendio: los puntos no delimitan por sí solos la extensión exacta. La fecha de la imagen satelital puede no coincidir con la de la detección.",
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
    riskTitle: "Riesgo para Sant Francesc",
    riskIntroduction: "Indicador orientativo: no es una predicción confirmada de propagación ni una instrucción de emergencia.",
    riskLoading: "Calculando riesgo con el viento previsto…",
    riskUnavailableStaleSnapshot: "No disponible: la instantánea de focos tiene más de dos horas.",
    riskUnavailableNoRecent: "No disponible: no hay focos detectados en las últimas seis horas.",
    riskUnavailableWeather: "No disponible: faltan datos meteorológicos previstos para este análisis.",
    riskUnavailableWeatherFetch: "No disponible: no se pudieron cargar los datos meteorológicos.",
    riskCategory: { low: "Bajo", watch: "Vigilancia", elevated: "Elevado", urgent: "Urgente" },
    riskHeading: (hours, category) => `Próximas ${hours} h · ${category}`,
    riskReason: ({ distance, age, windFrom, windSpeed, gusts, alignment }) => `${distance} km hasta Sant Francesc; foco de hace ${age} h. Viento desde ${windFrom}°: ${windSpeed} km/h, rachas ${gusts} km/h; ${alignment ? "dirección favorable hacia Sant Francesc" : "dirección poco favorable hacia Sant Francesc"}.`,
    riskCorridorTooltip: hours => `Corredor direccional orientativo · ${hours} h`,
    weatherSource: time => `Viento, humedad, precipitación y humedad superficial previstos desde <a href="${WEATHER_SOURCE_URL}" target="_blank" rel="noreferrer">Open-Meteo</a> · consulta ${time}.`,
    weatherRetained: "No se pudo actualizar el tiempo; se mantiene la última previsión válida.",
    windLoading: "Cargando viento actual…",
    windSource: time => `Viento actual de <a href="${WEATHER_SOURCE_URL}" target="_blank" rel="noreferrer">Open-Meteo</a> · consulta independiente ${time}.`,
    windLoadError: "No se pudo cargar la capa de viento actual.",
    windRetained: "No se pudo actualizar; se mantiene la última capa válida.",
    windMarkerLabel: ({ speed, direction, gusts }) => `Viento desde ${direction}° a ${speed} km/h; rachas ${gusts} km/h`,
  },
  en: {
    title: "Fire hotspots over Onda",
    heading: "Fire hotspots over Onda",
    mapControls: "Map controls",
    showMapControls: "Show map controls",
    hideMapControls: "Hide map controls",
    referenceView: "Google reference extent",
    nearbyDetections: "All nearby detections",
    showHotspots: "Show hotspots",
    showWindLayer: "Show wind",
    showPlaceLabels: "Show geographic names",
    showRiskCorridors: "Show risk corridors",
    riskCorridorsLoading: "Calculating corridors…",
    riskCorridorsUnavailable: "Corridors unavailable",
    language: "Language",
    legendTitle: "Legend and information",
    mapLabel: "Satellite map with active-fire detections",
    lowerFrp: "Less intense hotspot",
    higherFrp: "More intense hotspot",
    windLegend: "Wind: arrow shows travel direction · speed in km/h",
    riskCorridorLegend: "Indicative directional corridor",
    legendText: "Dot size and colour indicate the estimated intensity of each fire hotspot.",
    howToRead: "How to read this view",
    methodText: "The Sant Francesc area of interest comes from the shared Google My Maps layer. Each orange-to-red point is a nearby VIIRS active-fire detection; white-rimmed points fall inside that area. Compare their positions with the satellite image to assess the likely affected area. A detection is a 375 m pixel, not a mapped fire perimeter: do not interpret the dots alone as the exact boundary of a wildfire. The imagery date may differ from the detection time.",
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
    riskTitle: "Risk to Sant Francesc",
    riskIntroduction: "Indicative awareness signal: this is not a confirmed spread forecast or emergency instruction.",
    riskLoading: "Calculating risk using forecast wind…",
    riskUnavailableStaleSnapshot: "Unavailable: the hotspot snapshot is more than two hours old.",
    riskUnavailableNoRecent: "Unavailable: there are no hotspots detected in the last six hours.",
    riskUnavailableWeather: "Unavailable: forecast weather required for this assessment is missing.",
    riskUnavailableWeatherFetch: "Unavailable: forecast weather could not be loaded.",
    riskCategory: { low: "Low", watch: "Watch", elevated: "Elevated", urgent: "Urgent" },
    riskHeading: (hours, category) => `Next ${hours} h · ${category}`,
    riskReason: ({ distance, age, windFrom, windSpeed, gusts, alignment }) => `${distance} km to Sant Francesc; hotspot detected ${age} h ago. Wind from ${windFrom}°: ${windSpeed} km/h, gusts ${gusts} km/h; ${alignment ? "direction favours movement toward Sant Francesc" : "direction is not favourable toward Sant Francesc"}.`,
    riskCorridorTooltip: hours => `Indicative directional corridor · ${hours} h`,
    weatherSource: time => `Forecast wind, humidity, precipitation and shallow soil moisture from <a href="${WEATHER_SOURCE_URL}" target="_blank" rel="noreferrer">Open-Meteo</a> · queried ${time}.`,
    weatherRetained: "Weather refresh failed; the latest valid forecast is retained.",
    windLoading: "Loading current wind…",
    windSource: time => `Current wind from <a href="${WEATHER_SOURCE_URL}" target="_blank" rel="noreferrer">Open-Meteo</a> · independently queried ${time}.`,
    windLoadError: "Current wind layer could not be loaded.",
    windRetained: "Refresh failed; the latest valid layer is retained.",
    windMarkerLabel: ({ speed, direction, gusts }) => `Wind from ${direction}° at ${speed} km/h; gusts ${gusts} km/h`,
  },
};

let currentLanguage = "es";
let latestFireData;
let latestPerimeterData;
let latestWeather;
let latestWeatherError;
let latestRiskResult;
let latestWindObservations;
let windLayerQueriedAt;
let windLayerError;
let riskCorridorsPreferredVisible = false;
let weatherLastAttemptAt = 0;
let weatherFetchInProgress;
let currentSnapshotId;
let currentPerimeterId;
let perimeterBounds;
let localBounds;
let hasSetInitialView = false;

const legendElement = document.querySelector(".legend");
const headerElement = document.querySelector("header");
const mobileControlsToggleElement = document.querySelector("#mobile-controls-toggle");
const riskPanelElement = document.querySelector(".risk-panel");
const riskContentElement = document.querySelector("#risk-content");
const weatherSourceNoteElement = document.querySelector("#weather-source-note");
const windSourceNoteElement = document.querySelector("#wind-source-note");
const riskCorridorControlElement = document.querySelector("#risk-corridors-control");
const riskCorridorToggleElement = document.querySelector("#risk-corridors-toggle");
const riskCorridorLabelElement = document.querySelector("#risk-corridors-label");
const mobileLegendQuery = window.matchMedia("(max-width: 680px)");
const riskColors = { low: "#788a80", watch: "#c68a15", elevated: "#df6724", urgent: "#bc3030" };

function syncLegendDefault(event) {
  legendElement.open = !event.matches;
}

function setMobileControlsExpanded(expanded) {
  headerElement.classList.toggle("controls-open", expanded);
  mobileControlsToggleElement.setAttribute("aria-expanded", String(expanded));
  mobileControlsToggleElement.setAttribute("aria-label", t(expanded ? "hideMapControls" : "showMapControls"));
}

function syncMobileControls(event) {
  setMobileControlsExpanded(false);
  mobileControlsToggleElement.tabIndex = event.matches ? 0 : -1;
}

syncLegendDefault(mobileLegendQuery);
mobileLegendQuery.addEventListener("change", syncLegendDefault);
syncMobileControls(mobileLegendQuery);
mobileLegendQuery.addEventListener("change", syncMobileControls);

function syncRiskPanelDefault(event) {
  riskPanelElement.open = !event.matches;
}

syncRiskPanelDefault(mobileLegendQuery);
mobileLegendQuery.addEventListener("change", syncRiskPanelDefault);

const map = L.map("map", { zoomControl: false, preferCanvas: true }).setView(REFERENCE_COORDS, REFERENCE_ZOOM);
L.control.zoom({ position: "bottomright" }).addTo(map);
map.createPane("windPane");
map.getPane("windPane").style.zIndex = "450";

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  maxZoom: 19,
}).addTo(map);

const placeLabelsLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Labels © Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community",
  maxZoom: 19,
}).addTo(map);

const hotspotLayer = L.layerGroup().addTo(map);
const windLayer = L.layerGroup().addTo(map);
const riskCorridorLayer = L.layerGroup().addTo(map);
const perimeterLayer = L.geoJSON(null, {
  style: {
    color: "#ffdc36",
    weight: 3,
    opacity: 0.95,
    fillColor: "#ffdc36",
    fillOpacity: 0.09,
  },
});
if (SHOW_SAN_FRANCESC_PERIMETER) perimeterLayer.addTo(map);

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
  setMobileControlsExpanded(headerElement.classList.contains("controls-open"));
  if (latestFireData) renderHotspots(latestFireData);
  else document.querySelector("#detection-count").textContent = t("loading");
  renderWindLayer();
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

function windIcon(observation) {
  const travelBearing = windTravelBearing(observation.windDirection);
  const speed = Math.round(observation.windSpeedKmh);
  return L.divIcon({
    className: "wind-icon",
    html: `<div class="wind-marker" title="${t("windMarkerLabel")({ speed, direction: Math.round(observation.windDirection), gusts: Math.round(observation.windGustKmh) })}"><span class="wind-arrow" style="transform: rotate(${travelBearing}deg)" aria-hidden="true">↑</span><span class="wind-speed">${speed} km/h</span></div>`,
    iconSize: [64, 46],
    iconAnchor: [32, 23],
  });
}

function renderWindSourceNote() {
  if (!latestWindObservations) {
    windSourceNoteElement.textContent = windLayerError ? t("windLoadError") : t("windLoading");
    return;
  }
  windSourceNoteElement.innerHTML = t("windSource")(formatTime(windLayerQueriedAt.toISOString()));
  if (windLayerError) windSourceNoteElement.append(` ${t("windRetained")}`);
}

function renderWindLayer() {
  windLayer.clearLayers();
  if (latestWindObservations) {
    for (const observation of latestWindObservations) {
      L.marker([observation.latitude, observation.longitude], {
        icon: windIcon(observation),
        pane: "windPane",
        interactive: false,
        keyboard: false,
      }).addTo(windLayer);
    }
  }
  renderWindSourceNote();
}

async function refreshWindLayer() {
  const parameters = new URLSearchParams({
    latitude: WIND_LOCATIONS.map(location => location.latitude).join(","),
    longitude: WIND_LOCATIONS.map(location => location.longitude).join(","),
    current: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    timezone: "UTC",
    wind_speed_unit: "kmh",
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Open-Meteo current wind: HTTP ${response.status}`);
    latestWindObservations = parseCurrentWindPayload(await response.json(), WIND_LOCATIONS);
    windLayerQueriedAt = new Date();
    windLayerError = undefined;
  } catch (error) {
    console.error(error);
    windLayerError = error;
  }
  renderWindLayer();
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
  if (latestRiskResult?.status !== "ready") {
    syncRiskCorridorControl();
    return;
  }
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
  syncRiskCorridorControl();
}

function unavailableRiskText(reason) {
  return t({ stale_snapshot: "riskUnavailableStaleSnapshot", no_recent_detections: "riskUnavailableNoRecent", weather_incomplete: "riskUnavailableWeather", weather_fetch: "riskUnavailableWeatherFetch" }[reason] ?? "riskUnavailableWeather");
}

function syncRiskCorridorControl() {
  const isReady = latestRiskResult?.status === "ready" && latestRiskResult.assessments?.length > 0;
  riskCorridorToggleElement.disabled = !isReady;
  riskCorridorToggleElement.checked = Boolean(isReady && riskCorridorsPreferredVisible);
  riskCorridorControlElement.classList.toggle("unavailable", !isReady);
  if (!latestRiskResult) {
    riskCorridorLabelElement.textContent = t("riskCorridorsLoading");
    riskCorridorControlElement.title = t("riskLoading");
  } else if (!isReady) {
    riskCorridorLabelElement.textContent = t("riskCorridorsUnavailable");
    riskCorridorControlElement.title = unavailableRiskText(latestRiskResult.reason);
  } else {
    riskCorridorLabelElement.textContent = t("showRiskCorridors");
    riskCorridorControlElement.removeAttribute("title");
  }
  if (isReady && riskCorridorsPreferredVisible) riskCorridorLayer.addTo(map);
  else map.removeLayer(riskCorridorLayer);
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
  syncRiskCorridorControl();
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
mobileControlsToggleElement.addEventListener("click", () => {
  setMobileControlsExpanded(!headerElement.classList.contains("controls-open"));
});
document.querySelector("#detections-view").addEventListener("click", () => {
  if (localBounds?.isValid()) map.fitBounds(localBounds.pad(0.25), { maxZoom: 15 });
});
document.querySelector("#hotspots-toggle").addEventListener("change", event => {
  if (event.target.checked) hotspotLayer.addTo(map);
  else map.removeLayer(hotspotLayer);
});
document.querySelector("#wind-layer-toggle").addEventListener("change", event => {
  if (event.target.checked) windLayer.addTo(map);
  else map.removeLayer(windLayer);
});
document.querySelector("#place-labels-toggle").addEventListener("change", event => {
  if (event.target.checked) placeLabelsLayer.addTo(map);
  else map.removeLayer(placeLabelsLayer);
});
document.querySelector("#risk-corridors-toggle").addEventListener("change", event => {
  riskCorridorsPreferredVisible = event.target.checked;
  if (riskCorridorsPreferredVisible) riskCorridorLayer.addTo(map);
  else map.removeLayer(riskCorridorLayer);
});
document.querySelector("#language-es").addEventListener("click", () => applyLanguage("es"));
document.querySelector("#language-en").addEventListener("click", () => applyLanguage("en"));

applyLanguage("es");
// This request is deliberately independent from FIRMS and runs on every page load.
refreshWindLayer();
refreshMapData();
window.setInterval(refreshWindLayer, WIND_LAYER_REFRESH_MS);
window.setInterval(refreshMapData, 60_000);
